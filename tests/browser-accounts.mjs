import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import assert from 'node:assert/strict';
import { createService } from '../netlify/functions/_shared/service.mjs';

// These accounts and records exist only in this isolated browser test.
const accounts = [{ id: 'root', email: 'edwingomez@arissto.invalid', name: 'Edwin Gomez',
  password: 'qa-password-123456', roles: ['admin'], appMetadata: { username: 'EdwinGomez' } }];
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
  getUser: async id => accounts.find(user => user.id === id),
  createUser: async input => {
    const account = { id: 'u' + accounts.length, email: input.email, password: input.password,
      name: input.data.user_metadata.full_name, roles: input.data.app_metadata.roles,
      appMetadata: input.data.app_metadata, userMetadata: input.data.user_metadata };
    accounts.push(account); return account;
  },
  updateUser: async (id, updates) => {
    const account = accounts.find(user => user.id === id);
    account.name = updates.user_metadata.full_name;
    if (updates.password) account.password = updates.password;
    return account;
  },
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
  await login(page, 'EdwinGomez');
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
  assert.deepEqual(errors, []);
  console.log('PASS: ingreso, usuarios, cambio de clave, asignacion, aislamiento, reintento, recarga, cierre y responsive.');
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
