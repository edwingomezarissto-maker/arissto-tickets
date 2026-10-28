import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import assert from 'node:assert/strict';
import { createService } from '../netlify/functions/_shared/service.mjs';

// These accounts and records exist only in this isolated browser test.
const accounts = [{ id: 'root', email: 'egomez@arissto.invalid', name: 'Edwin Gomez',
  password: 'qa-password-123456', roles: ['admin'], appMetadata: { username: 'EGOMEZ', arisstoPrimaryAdmin: true } },
  { id: 'principal-admin', email: 'admin@arissto.invalid', name: 'Administrador', password: 'qa-password-123456',
    roles: ['admin'], appMetadata: { username: 'ADMIN', arisstoPrimaryAdmin: true } }];
let nextAccountId = 1;
let data = null;
let etag = 0;
let failNextWrite = false;
const store = {
  get: async () => data,
  getWithMetadata: async () => data ? { data, etag: String(etag) } : null,
  setJSON: async (_, next, condition) => {
    if (data && condition.onlyIfMatch !== String(etag)) return { modified: false };
    data = next; etag++; return { modified: true };
  },
};
const admin = {
  listUsers: async () => accounts,
  getUser: async id => {
    const account = accounts.find(user => user.id === id);
    if (!account) throw Object.assign(new Error('not found'), { status: 404 });
    return account;
  },
  createUser: async input => {
    const account = { id: 'u' + nextAccountId++, email: input.email, password: input.password,
      name: input.data.user_metadata.full_name, roles: input.data.app_metadata.roles,
      appMetadata: input.data.app_metadata, userMetadata: input.data.user_metadata };
    accounts.push(account); return account;
  },
  updateUser: async (id, updates) => {
    const account = accounts.find(user => user.id === id);
    account.name = updates.user_metadata.full_name;
    account.userMetadata = updates.user_metadata;
    account.appMetadata = updates.app_metadata;
    account.roles = updates.app_metadata.roles;
    account.email = updates.email;
    if (updates.password) account.password = updates.password;
    return account;
  },
  deleteUser: async id => { accounts.splice(accounts.findIndex(account => account.id === id), 1); },
};
const root = resolve('dist');
const server = createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const file = resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!file.startsWith(root + sep)) { res.writeHead(403).end(); return; }
    const content = await readFile(file);
    res.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : file.endsWith('.html') ? 'text/html' : 'image/jpeg');
    res.end(content);
  } catch { res.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const url = 'http://127.0.0.1:' + server.address().port;
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const errors = [];
const token = user => Buffer.from('{}').toString('base64url') + '.' + Buffer.from(JSON.stringify({ sub: user.id,
  email: user.email, exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url') + '.test';
const rawUser = user => ({ id: user.id, email: user.email, confirmed_at: '2026-01-01T00:00:00Z',
  app_metadata: { roles: user.roles, ...user.appMetadata }, user_metadata: { full_name: user.name } });

async function context() {
  const context = await browser.newContext();
  context.on('page', page => page.on('pageerror', error => errors.push(error.message)));
  await context.route('https://cdn.jsdelivr.net/**', route => route.fulfill({ contentType: 'text/javascript', body: 'window.Chart = class { constructor(){} destroy(){} };' }));
  await context.route('**/.netlify/identity/**', async route => {
    const req = route.request();
    const path = new URL(req.url()).pathname;
    let payload = {};
    let status = 200;
    if (path.endsWith('/settings')) payload = { disable_signup: true, external: { email: true } };
    else if (path.endsWith('/token')) {
      const form = new URLSearchParams(req.postData());
      const account = accounts.find(item => item.email === form.get('username') && item.password === form.get('password'));
      if (!account) { status = 400; payload = { error: 'invalid_grant', error_description: 'Invalid credentials' }; }
      else payload = { access_token: token(account), token_type: 'bearer', expires_in: 3600, refresh_token: 'test-refresh', user: rawUser(account) };
    } else if (path.endsWith('/user')) {
      const auth = req.headers().authorization?.split(' ')[1];
      const id = auth ? JSON.parse(Buffer.from(auth.split('.')[1], 'base64url').toString()).sub : null;
      const account = accounts.find(item => item.id === id);
      if (account) {
        if (req.method() === 'PUT') { const body = req.postDataJSON(); if (body.password) account.password = body.password; }
        payload = rawUser(account);
      } else status = 401;
    }
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(payload) });
  });
  await context.route('**/api/**', async route => {
    const req = route.request();
    if (failNextWrite && req.method() === 'POST' && req.url().endsWith('/api/support')) {
      failNextWrite = false;
      await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Prueba de perdida de conexion.' }) }); return;
    }
    const cookie = (await context.cookies()).find(item => item.name === 'nf_jwt');
    let actor = null;
    if (cookie) { try { const id = JSON.parse(Buffer.from(cookie.value.split('.')[1], 'base64url').toString()).sub; actor = accounts.find(item => item.id === id); } catch {} }
    const service = createService({ getUser: async () => actor, admin, getStore: () => store });
    const result = await service(new Request(req.url(), { method: req.method(), headers: req.headers(), body: req.postData() }));
    await route.fulfill({ status: result.status, headers: Object.fromEntries(result.headers), body: await result.text() });
  });
  return context;
}
const login = async (page, username, password = 'qa-password-123456') => {
  await page.locator('#loginForm').waitFor({ state: 'visible' });
  await page.locator('#loginEmail').fill(username);
  await page.locator('#loginPassword').fill(password);
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
  await page.locator('#appShell').waitFor({ state: 'visible' });
};
try {
  const adminContext = await context();
  const page = await adminContext.newPage();
  await page.goto(url);
  await page.locator('#loginForm').waitFor({ state: 'visible' });
  await mkdir('qa-output', { recursive: true });
  await page.screenshot({ path: 'qa-output/login-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.screenshot({ path: 'qa-output/login-mobile.png', fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await login(page, 'EGOMEZ');
  await page.locator('#usersTab').click();
  for (const name of ['UsuarioA', 'UsuarioB']) {
    await page.locator('#userName').fill(name);
    await page.locator('#userUsername').fill(name);
    await page.locator('#userPassword').fill('qa-password-123456');
    await page.locator('#saveUserButton').click();
    await page.locator('#usersBody tr').filter({ hasText: name }).waitFor();
  }
  const row = page.locator('#usersBody tr').filter({ hasText: 'UsuarioA' });
  await row.getByRole('button', { name: 'Editar' }).click();
  await page.locator('#userName').fill('Persona A');
  await page.locator('#userPassword').fill('changed-password-12345');
  await page.locator('#saveUserButton').click();
  await page.getByText('Cuenta actualizada.', { exact: true }).waitFor();
  await page.locator('#openCreateTask').click();
  await page.locator('#taskTitle').fill('Tarea privada A');
  await page.locator('#taskAccount').selectOption('u1');
  await page.locator('#taskForm button[type="submit"]').click();
  await page.locator('#taskModal').waitFor({ state: 'hidden' });
  assert.equal(data.tasks[0].ownerId, 'u1');
  const ca = await context(); const pa = await ca.newPage(); await pa.goto(url);
  await login(pa, 'UsuarioA', 'changed-password-12345');
  assert.equal(await pa.locator('#usersTab').isVisible(), false);
  await pa.locator('[data-tab-target="tasksSection"]').click();
  await pa.getByText('Tarea privada A', { exact: true }).waitFor();
  await pa.locator('#openCreateTask').click();
  assert.equal(await pa.locator('#taskAccountLabel').isVisible(), false);
  await pa.locator('#taskTitle').fill('Tarea desde otro equipo');
  failNextWrite = true;
  await pa.locator('#taskForm button[type="submit"]').click();
  await pa.locator('#taskAlert').getByText('Prueba de perdida de conexion.').waitFor();
  assert.equal(await pa.locator('#taskTitle').inputValue(), 'Tarea desde otro equipo');
  assert.equal(data.tasks.length, 1);
  await pa.locator('#taskForm button[type="submit"]').click();
  await pa.locator('#taskModal').waitFor({ state: 'hidden' });
  await pa.reload();
  await pa.locator('#appShell').waitFor({ state: 'visible' });
  await pa.locator('[data-tab-target="tasksSection"]').click();
  await pa.getByText('Tarea desde otro equipo', { exact: true }).waitFor();
  await pa.locator('#logoutButton').click();
  await pa.locator('#loginForm').waitFor({ state: 'visible' });
  assert.equal(await pa.locator('#tasksTableBody').textContent(), '');
  await login(pa, 'UsuarioB');
  await pa.locator('[data-tab-target="tasksSection"]').click();
  assert.equal(await pa.locator('#tasksTableBody tr').count(), 0);
  const forbidden = await pa.evaluate(() => fetch('/api/users').then(r => r.status));
  assert.equal(forbidden, 403);
  await page.locator('#refreshCloud').click();
  await page.locator('[data-tab-target="tasksSection"]').click();
  await page.getByText('Tarea desde otro equipo', { exact: true }).waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.locator('[data-tab-target="migrationSection"]').click();
  const upload = (selector, contents) => page.locator(selector).setInputFiles({
    name: 'respaldo.json', mimeType: 'application/json', buffer: Buffer.from(contents),
  });
  page.on('dialog', dialog => dialog.accept());
  await upload('#importFile', '{invalid');
  await page.locator('#importCasesTasks').click();
  await page.locator('#migrationAlert').getByText('El archivo no es un JSON valido.').waitFor();
  assert.equal(await page.locator('#importCasesTasks').isEnabled(), true);
  const backup = JSON.stringify({ tasks: [{ id: 'json-task', title: 'Tarea importada JSON', owner: 'Edwin Gomez' }],
    cases: [{ id: 'json-case', title: 'Caso importado JSON', owner: 'Edwin Gomez' }] });
  await upload('#importFile', backup);
  failNextWrite = true;
  await page.locator('#importCasesTasks').click();
  await page.locator('#migrationAlert').getByText('No se pudo importar. Revise la conexion e intente nuevamente.').waitFor();
  assert.equal(await page.locator('#importCasesTasks').isEnabled(), true);
  assert.equal(data.tasks.some(task => task.id === 'json-task'), false);
  await page.locator('#importCasesTasks').click();
  await page.locator('#migrationStatus').filter({ hasText: 'Importacion completada.' }).waitFor();
  assert.equal(data.tasks.filter(task => task.id === 'json-task').length, 1);
  assert.equal(data.cases.filter(row => row.id === 'json-case').length, 1);
  assert.equal(await page.locator('#importCasesTasks').isEnabled(), true);
  await upload('#importCooperativesFile', '{invalid');
  await page.locator('#importCooperativesContacts').click();
  await page.locator('#migrationAlert').getByText('El archivo seleccionado no contiene JSON válido.').waitFor();
  assert.equal(await page.locator('#importCooperativesContacts').isEnabled(), true,
    'invalid JSON must release the button so the user can retry');
  const cooperatives = JSON.stringify({ cooperatives: [{ name: 'Cooperativa QA', contacts: [{ name: 'Cliente QA' }] }] });
  await upload('#importCooperativesFile', cooperatives);
  failNextWrite = true;
  await page.locator('#importCooperativesContacts').click();
  await page.locator('#migrationAlert').getByText('Prueba de perdida de conexion.').waitFor();
  assert.equal(await page.locator('#importCooperativesContacts').isEnabled(), true);
  await page.locator('#importCooperativesContacts').click();
  await page.locator('#migrationStatus').filter({ hasText: 'Importación completada.' }).waitFor();
  assert.equal(data.cooperatives.length, 1);
  assert.equal(await page.locator('#importCooperativesContacts').isEnabled(), true);
  await upload('#importCooperativesFile', cooperatives);
  await page.locator('#importCooperativesContacts').click();
  await page.locator('#migrationStatus').getByText('No se encontraron cooperativas o clientes nuevos para importar.').waitFor();
  assert.equal(data.cooperatives.length, 1);
  assert.equal(await page.locator('#importCooperativesContacts').isEnabled(), true);
  const download = page.waitForEvent('download');
  await page.locator('#exportCooperativesContacts').click();
  await download;
  await page.locator('#migrationStatus').filter({ hasText: 'Respaldo generado:' }).waitFor();
  assert.equal(await page.locator('#exportCooperativesContacts').isEnabled(), true);
  for (const section of ['graphicDashboardSection', 'tasksSection', 'casesSection', 'migrationSection']) {
    await page.locator(`[data-tab-target="${section}"]`).click();
    assert.equal(await page.locator('#' + section).isVisible(), true);
  }
  // Existing Identity accounts must remain visible even if their old role is missing.
  accounts.push({ id: 'mardo', email: 'mcordero@arissto.invalid', name: 'Mardoqueo Cordero',
    password: 'qa-password-123456', roles: [], appMetadata: { username: 'MCORDERO' } });
  await page.locator('#usersTab').click();
  const mardoRow = page.locator('#usersBody tr').filter({ hasText: 'MCORDERO' });
  await mardoRow.waitFor();
  assert.match(await mardoRow.textContent(), /Sin acceso/);
  await page.locator('#userName').fill('Mardoqueo Cordero');
  await page.locator('#userUsername').fill('MCORDERO');
  await page.locator('#userPassword').fill('qa-password-123456');
  await page.locator('#saveUserButton').click();
  await page.locator('#usersMessage').filter({ hasText: 'ya existe. Use Editar' }).waitFor();
  assert.equal(await mardoRow.count(), 1);
  await mardoRow.getByRole('button', { name: 'Editar', exact: true }).click();
  await page.locator('#userRole').selectOption('member');
  await page.locator('#saveUserButton').click();
  await page.locator('#usersMessage').getByText('Cuenta actualizada.', { exact: true }).waitFor();
  assert.match(await mardoRow.textContent(), /Usuario comun/);
  const rootRow = page.locator('#usersBody tr').filter({ hasText: 'EGOMEZ' });
  await rootRow.getByRole('button', { name: 'Editar', exact: true }).click();
  assert.equal(await page.locator('#userRole').isDisabled(), true);
  assert.equal(await rootRow.getByRole('button', { name: 'Eliminar', exact: true }).count(), 0);
  await page.locator('#cancelUserEdit').click();

  // All three account types can change their own password and use it in a fresh login.
  for (const username of ['MCORDERO', 'EGOMEZ', 'ADMIN']) {
    const ownContext = await context(); const ownPage = await ownContext.newPage();
    await ownPage.goto(url); await login(ownPage, username);
    assert.equal(await ownPage.locator('#usersTab').isVisible(), username !== 'MCORDERO');
    await ownPage.locator('#changePassword').click();
    await ownPage.locator('#cancelPasswordChange').click();
    assert.equal(await ownPage.locator('#appShell').isVisible(), true);
    await ownPage.locator('#changePassword').click();
    await ownPage.locator('#newPassword').fill('new-password-' + username);
    await ownPage.locator('#confirmPassword').fill('new-password-' + username);
    await ownPage.locator('#passwordForm button[type="submit"]').click();
    await ownPage.locator('#accessMessage').filter({ hasText: 'Credenciales actualizadas.' }).waitFor();
    await login(ownPage, username, 'new-password-' + username);
    assert.equal(await ownPage.locator('#usersTab').isVisible(), username !== 'MCORDERO');
    await ownContext.close();
  }
  const mardoContext = await context(); const mardoPage = await mardoContext.newPage();
  await mardoPage.goto(url); await login(mardoPage, 'MCORDERO', 'new-password-MCORDERO');
  assert.equal(await mardoPage.evaluate(() => fetch('/api/users').then(response => response.status)), 403);
  await mardoRow.getByRole('button', { name: 'Editar', exact: true }).click();
  await page.locator('#userRole').selectOption('admin');
  await page.locator('#saveUserButton').click();
  await page.locator('#usersMessage').getByText('Cuenta actualizada.', { exact: true }).waitFor();
  await mardoPage.locator('#refreshCloud').click();
  await mardoPage.locator('#usersTab').waitFor({ state: 'visible' });
  await mardoPage.locator('#usersTab').click();
  await mardoRow.getByRole('button', { name: 'Editar', exact: true }).click();
  await page.locator('#userRole').selectOption('member');
  await page.locator('#saveUserButton').click();
  await page.locator('#usersMessage').getByText('Cuenta actualizada.', { exact: true }).waitFor();
  await mardoPage.locator('#refreshCloud').click();
  await mardoPage.locator('#usersTab').waitFor({ state: 'hidden' });
  assert.equal(await mardoPage.locator('#usersBody tr').count(), 0);
  await mardoRow.getByRole('button', { name: 'Eliminar', exact: true }).click();
  await page.locator('#usersMessage').filter({ hasText: 'Cuenta eliminada del servidor.' }).waitFor();
  assert.equal(await mardoRow.count(), 0);
  assert.equal(accounts.some(account => account.id === 'mardo'), false);
  await mardoPage.locator('#refreshCloud').click();
  await mardoPage.locator('#loginForm').waitFor({ state: 'visible' });
  await mardoContext.close();
  await page.locator('[data-tab-target="tasksSection"]').click();
  await page.locator('[data-action="delete-task"][data-id="json-task"]').click();
  await page.locator('[data-action="delete-task"][data-id="json-task"]').waitFor({ state: 'detached' });
  assert.equal(data.tasks.some(task => task.id === 'json-task'), false);
  assert.ok(!JSON.stringify(data).includes('Tarea importada JSON'));
  await page.locator('[data-tab-target="casesSection"]').click();
  await page.locator('[data-action="delete"][data-id="json-case"]').click();
  await page.locator('[data-action="delete"][data-id="json-case"]').waitFor({ state: 'detached' });
  assert.equal(data.cases.some(row => row.id === 'json-case'), false);
  assert.ok(!JSON.stringify(data).includes('Caso importado JSON'));
  assert.deepEqual(errors, []);
  console.log('PASS: cuentas principales, roles, usuarios ocultos, claves propias, eliminacion en servidor, JSON y navegacion.');
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
