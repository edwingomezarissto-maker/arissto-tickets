import test from 'node:test';
import assert from 'node:assert/strict';
import { createService } from '../netlify/functions/_shared/service.mjs';
import { ensureAccountPolicy } from '../netlify/functions/_shared/accounts.mjs';
import { ensureInitialAdmin } from '../netlify/functions/_shared/bootstrap.mjs';
import { emptyData, applyOperations, compactData } from '../netlify/functions/_shared/records.mjs';

const request = (path, body) => new Request('https://example.test' + path, {
  method: body ? 'POST' : 'GET', headers: { origin: 'https://example.test', 'Content-Type': 'application/json' },
  body: body ? JSON.stringify(body) : undefined,
});
const makeAccount = (id, role = 'member') => ({ id, email: id.toLowerCase() + '@arissto.invalid', name: id,
  roles: role ? [role] : [], appMetadata: { username: id, roles: role ? [role] : [] } });

function fixture() {
  const accounts = [makeAccount('EGOMEZ', 'admin'), makeAccount('ADMIN', 'admin'), makeAccount('MCORDERO', '')];
  const blobs = new Map();
  let etag = 0;
  const store = {
    get: async key => blobs.get(key) || null,
    getWithMetadata: async key => blobs.has(key) ? { data: structuredClone(blobs.get(key)), etag: String(etag) } : null,
    setJSON: async (key, value, condition = {}) => {
      if ((condition.onlyIfNew && blobs.has(key)) || (condition.onlyIfMatch && condition.onlyIfMatch !== String(etag))) return { modified: false };
      blobs.set(key, structuredClone(value)); etag++; return { modified: true };
    },
  };
  const admin = {
    listUsers: async ({ page = 1, perPage = 100 } = {}) => accounts.slice((page - 1) * perPage, page * perPage),
    getUser: async id => {
      const account = accounts.find(item => item.id === id);
      if (!account) throw Object.assign(new Error('not found'), { status: 404 });
      return account;
    },
    updateUser: async (id, updates) => {
      const account = await admin.getUser(id);
      if (updates.email) account.email = updates.email;
      if (updates.user_metadata) { account.userMetadata = updates.user_metadata; account.name = updates.user_metadata.full_name; }
      if (updates.app_metadata) { account.appMetadata = updates.app_metadata; account.roles = updates.app_metadata.roles; }
      if (updates.password) account.password = updates.password;
      return account;
    },
    createUser: async input => {
      const account = makeAccount('new-' + accounts.length);
      account.email = input.email; account.password = input.password;
      accounts.push(account);
      return admin.updateUser(account.id, { user_metadata: input.data.user_metadata, app_metadata: input.data.app_metadata });
    },
    deleteUser: async id => { accounts.splice(accounts.findIndex(item => item.id === id), 1); },
  };
  const deps = { admin, getStore: () => store };
  const as = id => createService({ ...deps, getUser: async () => ({ id }) });
  return { accounts, blobs, store, admin, deps, as };
}

test('la lista incluye MCORDERO sin rol y el duplicado se explica sin ocultarlo', async () => {
  const h = fixture();
  const response = await h.as('ADMIN')(request('/api/users'));
  const users = (await response.json()).users;
  assert.equal(users.length, 3);
  assert.deepEqual(users.find(user => user.username === 'MCORDERO').roles, []);
  const duplicate = await h.as('ADMIN')(request('/api/users', { name: 'Mardoqueo', username: 'MCORDERO', password: '123' }));
  assert.equal(duplicate.status, 409);
  assert.match((await duplicate.json()).error, /ya existe.*Editar/);
  assert.equal(h.accounts.length, 3);
});

test('politica inicial: EGOMEZ y ADMIN administran; Mardoqueo es comun; se conserva el cambio posterior', async () => {
  const h = fixture();
  h.accounts.push(makeAccount('OtroAdmin', 'admin'));
  await ensureAccountPolicy(h.deps);
  for (const id of ['EGOMEZ', 'ADMIN']) {
    const account = await h.admin.getUser(id);
    assert.deepEqual(account.roles, ['admin']);
    assert.equal(account.appMetadata.arisstoPrimaryAdmin, true);
  }
  assert.deepEqual((await h.admin.getUser('MCORDERO')).roles, ['member']);
  assert.deepEqual((await h.admin.getUser('OtroAdmin')).roles, ['member']);
  await h.admin.updateUser('MCORDERO', { app_metadata: { roles: ['admin'], username: 'MCORDERO' } });
  await ensureAccountPolicy(h.deps);
  assert.deepEqual((await h.admin.getUser('MCORDERO')).roles, ['admin']);
});

test('solo un administrador cambia roles; los nuevos son comunes por defecto', async () => {
  const h = fixture(); await ensureAccountPolicy(h.deps);
  const body = { id: 'MCORDERO', name: 'Mardoqueo', username: 'MCORDERO', password: '', role: 'admin' };
  assert.equal((await h.as('MCORDERO')(request('/api/users', body))).status, 403);
  assert.equal((await h.as('ADMIN')(request('/api/users', body))).status, 200);
  assert.deepEqual((await h.admin.getUser('MCORDERO')).roles, ['admin']);
  assert.equal((await h.as('ADMIN')(request('/api/users', { ...body, role: 'member' }))).status, 200);
  assert.equal((await h.as('MCORDERO')(request('/api/users'))).status, 403);
  const result = await h.as('ADMIN')(request('/api/users', { name: 'Nuevo', username: 'Nuevo', password: '123' }));
  assert.equal(result.status, 201);
  assert.deepEqual((await result.json()).user.roles, ['member']);
});

test('las cuentas principales no pierden su rol ni un comun puede adoptar sus usuarios', async () => {
  const h = fixture(); await ensureAccountPolicy(h.deps);
  assert.equal((await h.as('ADMIN')(request('/api/users', {
    id: 'EGOMEZ', name: 'Edwin', username: 'EGOMEZ', password: '', role: 'member',
  }))).status, 403);
  assert.equal((await h.as('MCORDERO')(request('/api/profile', { username: 'ADMIN', password: '123' }))).status, 409);
  assert.equal((await h.as('MCORDERO')(request('/api/profile', { role: 'admin', password: '123' }))).status, 403);
});

test('cada cuenta cambia su propia clave sin alterar su rol ni las otras cuentas', async () => {
  const h = fixture(); await ensureAccountPolicy(h.deps);
  for (const id of ['EGOMEZ', 'ADMIN', 'MCORDERO']) {
    const beforeRole = [...(await h.admin.getUser(id)).roles];
    const result = await h.as(id)(request('/api/profile', { password: 'new-' + id }));
    assert.equal(result.status, 200);
    assert.deepEqual((await h.admin.getUser(id)).roles, beforeRole);
    assert.equal((await h.admin.getUser(id)).password, 'new-' + id);
    assert.ok(!(await result.text()).includes('new-' + id));
  }
});

test('eliminar una cuenta la quita de Identity, invalida su acceso y permite recrear el usuario', async () => {
  const h = fixture(); await ensureAccountPolicy(h.deps);
  h.blobs.set('records', applyOperations(emptyData(), [{ collection: 'tasks', id: 'task', action: 'put',
    record: { title: 'Trabajo', owner: 'Mardoqueo', ownerId: 'MCORDERO' } }], { id: 'MCORDERO', roles: ['member'] }));
  const response = await h.as('ADMIN')(request('/api/users', { action: 'delete', id: 'MCORDERO' }));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).transferred, 1);
  assert.equal(h.accounts.some(account => account.id === 'MCORDERO'), false);
  assert.equal((await h.as('MCORDERO')(request('/api/support'))).status, 401);
  assert.equal(h.blobs.get('records').tasks[0].ownerId, 'ADMIN');
  const recreated = await h.as('ADMIN')(request('/api/users', { name: 'Mardoqueo', username: 'MCORDERO', password: '123' }));
  assert.equal(recreated.status, 201);
});

test('eliminar no deja el contenido del registro en la coleccion ni permite que reaparezca por una migracion', () => {
  const actor = makeAccount('MCORDERO');
  const put = { collection: 'tasks', id: 'one', action: 'put', record: { title: 'Contenido privado', owner: 'Mardoqueo' } };
  let data = applyOperations(emptyData(), [put], actor);
  data = applyOperations(data, [{ collection: 'tasks', id: 'one', action: 'delete', version: data.tasks[0]._version }], actor);
  assert.equal(data.tasks.length, 0);
  assert.ok(!JSON.stringify(data).includes('Contenido privado'));
  assert.deepEqual(data.deletedIds.tasks, ['one']);
  assert.throws(() => applyOperations(data, [put], actor), { status: 409 });
  assert.equal(applyOperations(data, [put], makeAccount('ADMIN', 'admin'), new Set(), true).tasks.length, 0);
  const legacy = compactData({ ...emptyData(), tasks: [{ id: 'old', deleted: true, details: 'Borrado antiguo' }] });
  assert.equal(legacy.tasks.length, 0);
  assert.ok(!JSON.stringify(legacy).includes('Borrado antiguo'));
});

test('una cuenta eliminada no se recrea automaticamente al activar ni permite borrar la sesion actual', async () => {
  const h = fixture(); await ensureAccountPolicy(h.deps);
  h.blobs.set('initial-admin', { id: 'EGOMEZ' });
  assert.equal((await h.as('ADMIN')(request('/api/users', { action: 'delete', id: 'ADMIN' }))).status, 403);
  assert.equal((await h.as('ADMIN')(request('/api/users', { action: 'delete', id: 'EGOMEZ' }))).status, 200);
  await ensureInitialAdmin({ ...h.deps, password: 'existing-secret' });
  assert.equal(h.accounts.some(account => account.id === 'EGOMEZ'), false);
});

test('EGOMEZ no se apropia de registros de ADMIN aunque ambos tengan el mismo nombre', async () => {
  const h = fixture(); await ensureAccountPolicy(h.deps);
  h.blobs.set('records', { ...emptyData(), tasks: [{ id: 'admin-task', title: 'Registro de ADMIN', owner: 'Edwin Gomez', ownerId: 'ADMIN' }] });
  const result = await h.as('EGOMEZ')(request('/api/support'));
  assert.equal(result.status, 200);
  assert.equal((await result.json()).tasks[0].ownerId, 'ADMIN');
  assert.equal(h.blobs.get('records').tasks[0].ownerId, 'ADMIN');
});

test('la actualizacion limpia del servidor el contenido de registros eliminados anteriormente', async () => {
  const h = fixture();
  h.blobs.set('records', { ...emptyData(), cases: [{ id: 'old-deleted', deleted: true, title: 'Contenido viejo eliminado' }] });
  await ensureAccountPolicy(h.deps);
  const saved = h.blobs.get('records');
  assert.equal(saved.cases.length, 0);
  assert.deepEqual(saved.deletedIds.cases, ['old-deleted']);
  assert.ok(!JSON.stringify(saved).includes('Contenido viejo eliminado'));
});

test('cooperativas y telefonos se comparten entre cuentas; solo el administrador modifica el catalogo', async () => {
  const h = fixture(); await ensureAccountPolicy(h.deps);
  const account = await h.admin.getUser('ADMIN');
  const operation = { collection: 'cooperatives', id: 'shared', action: 'put', record: {
    name: 'Cooperativa compartida', contacts: [{ id: 'client', name: 'Cliente QA', phone: '70000001', position: 'Contacto' }],
  } };
  h.blobs.set('records', applyOperations(emptyData(), [operation], account));
  const snapshots = [];
  for (const id of ['EGOMEZ', 'ADMIN', 'MCORDERO']) {
    const response = await h.as(id)(request('/api/support'));
    assert.equal(response.status, 200);
    snapshots.push((await response.json()).cooperatives);
  }
  assert.deepEqual(snapshots[0], snapshots[2]);
  assert.deepEqual(snapshots[1], snapshots[2]);
  const changed = { ...operation, version: snapshots[0][0]._version,
    record: { ...operation.record, contacts: [{ ...operation.record.contacts[0], phone: '70000002' }] } };
  assert.equal((await h.as('MCORDERO')(request('/api/support', { operations: [changed] }))).status, 403);
  assert.equal((await h.as('ADMIN')(request('/api/support', { operations: [changed] }))).status, 200);
  const fresh = await (await h.as('MCORDERO')(request('/api/support'))).json();
  assert.equal(fresh.cooperatives[0].contacts[0].phone, '70000002');
});

