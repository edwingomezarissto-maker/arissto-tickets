import test from 'node:test';
import assert from 'node:assert/strict';
import { createService } from '../netlify/functions/_shared/service.mjs';
import { emptyData, visibleData, applyOperations } from '../netlify/functions/_shared/records.mjs';
import { makeOperations } from '../src/sync.mjs';
import { ensureInitialAdmin } from '../netlify/functions/_shared/bootstrap.mjs';

const a = { id: 'a', name: 'A', email: 'usuarioa@arissto.invalid', roles: ['member'] };
const b = { id: 'b', name: 'B', email: 'usuariob@arissto.invalid', roles: ['member'] };
const root = { id: 'root', name: 'Admin', email: 'edwingomez@arissto.invalid', roles: ['admin'] };
const owners = new Set(['a', 'b', 'root']);
const put = (id, ownerId = 'a') => ({ collection: 'tasks', action: 'put', id,
  record: { title: 'Revision', owner: 'A', progress: '', details: '', ownerId } });

test('cada usuario ve solo sus registros; administrador ve todos', () => {
  const data = applyOperations(emptyData(), [put('one', 'a'), put('two', 'b')], root, owners);
  assert.deepEqual(visibleData(data, a).tasks.map(row => row.id), ['one']);
  assert.deepEqual(visibleData(data, b).tasks.map(row => row.id), ['two']);
  assert.equal(visibleData(data, root).tasks.length, 2);
});
test('no se pueden editar, eliminar ni reasignar registros ajenos', () => {
  const data = applyOperations(emptyData(), [put('one', 'b')], root, owners);
  const op = { ...put('one'), version: data.tasks[0]._version };
  assert.throws(() => applyOperations(data, [op], a, owners), { status: 403 });
  assert.throws(() => applyOperations(data, [{ ...op, action: 'delete' }], a, owners), { status: 403 });
  assert.throws(() => applyOperations(emptyData(), [put('new', 'b')], a, owners), { status: 403 });
});
test('los usuarios no editan cooperativas', () => {
  assert.throws(() => applyOperations(emptyData(), [{ collection: 'cooperatives', action: 'put', id: 'c', record: { name: 'C', contacts: [] } }], a), { status: 403 });
});
test('una edicion obsoleta no sobrescribe cambios y la escritura es atomica', () => {
  const before = applyOperations(emptyData(), [put('one')], a, owners);
  const op = { ...put('one'), version: before.tasks[0]._version };
  const latest = applyOperations(before, [op], a, owners);
  assert.throws(() => applyOperations(latest, [put('new'), op], a, owners), { status: 409 });
  assert.equal(latest.tasks.length, 1);
});
test('la migracion es exclusiva del administrador y no duplica ni resucita eliminados', () => {
  assert.throws(() => applyOperations(emptyData(), [put('one')], a, owners, true), { status: 403 });
  let data = applyOperations(emptyData(), [put('one')], root, owners, true);
  data = applyOperations(data, [put('one')], root, owners, true);
  assert.equal(data.tasks.length, 1);
  data = applyOperations(data, [{ collection: 'tasks', action: 'delete', id: 'one', version: data.tasks[0]._version }], root, owners);
  data = applyOperations(data, [put('one')], root, owners, true);
  assert.equal(visibleData(data, root).tasks.length, 0);
});
test('los campos opcionales de tareas y compromiso vacio se conservan', () => {
  const data = applyOperations(emptyData(), [{ collection: 'cases', action: 'put', id: 'c', record: {
    title: 'Caso', owner: 'A', ownerId: 'a', status: 'Abierto', priority: 'Media', commitmentDate: '',
  } }, put('one')], a, owners);
  assert.equal(data.cases[0].commitmentDate, '');
  assert.equal(data.tasks[0].progress, '');
  const op = { collection: 'cases', action: 'put', id: 'c', version: data.cases[0]._version,
    record: { ...data.cases[0], status: 'Finalizado', updatedAt: '1900-01-01' } };
  const finished = applyOperations(data, [op], a, owners);
  assert.equal(finished.cases[0].status, 'Finalizado');
  assert.notEqual(finished.cases[0].updatedAt, '1900-01-01');
});
test('el cliente envia solo diferencias y conserva la version que leyo', () => {
  const before = applyOperations(emptyData(), [put('one'), put('two')], a, owners);
  const after = structuredClone(before);
  after.tasks[0].title = 'Cambio';
  const ops = makeOperations(before, after);
  assert.equal(ops.length, 1);
  assert.equal(ops[0].version, before.tasks[0]._version);
});

function harness(currentUser) {
  let data = null;
  let etag = '0';
  let storeCalls = 0;
  let failOnce = false;
  let created = null;
  const service = createService({ getUser: async () => currentUser,
    admin: { getUser: async () => currentUser, listUsers: async () => [a, b, root], createUser: async input => {
      created = input; return { id: 'new', email: input.email, roles: input.data.app_metadata.roles };
    } },
    getStore: () => { storeCalls++; return {
      get: async () => data,
      getWithMetadata: async () => data ? { data, etag } : null,
      setJSON: async (_, next, options) => {
        if (failOnce) { failOnce = false; return { modified: false }; }
        assert.ok(data ? options.onlyIfMatch === etag : options.onlyIfNew);
        data = next; etag = String(Number(etag) + 1); return { modified: true, etag };
      },
    }; },
  });
  return { service, storeCalls: () => storeCalls, created: () => created, conflict: () => { failOnce = true; } };
}
const request = (path = '/api/support', body, origin = 'https://example.test') => new Request('https://example.test' + path,
  { method: body ? 'POST' : 'GET', headers: { origin, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });

test('API rechaza anonimos y cuentas sin rol sin leer el almacenamiento', async () => {
  for (const actor of [null, { id: 'x', roles: [] }, { id: 'x', userMetadata: { roles: ['admin'] } }]) {
    const h = harness(actor);
    const result = await h.service(request());
    assert.equal(result.status, actor ? 403 : 401);
    assert.equal(h.storeCalls(), 0);
    assert.equal(result.headers.get('Cache-Control'), 'no-store');
  }
});
test('API rechaza POST desde otro origen y usuarios normales no crean cuentas', async () => {
  const h = harness(a);
  assert.equal((await h.service(request('/api/support', { operations: [] }, 'https://other.test'))).status, 403);
  assert.equal((await h.service(request('/api/users', { name: 'X' }))).status, 403);
  assert.equal(h.created(), null);
});
test('API permite guardar, leer desde otro equipo y reintenta escrituras concurrentes', async () => {
  const h = harness(a); h.conflict();
  assert.equal((await h.service(request('/api/support', { operations: [put('one')] }))).status, 200);
  const second = await (await h.service(request())).json();
  assert.equal(second.tasks.length, 1);
  assert.equal(second.tasks[0].ownerId, 'a');
});
test('crear cuenta solo retorna datos de perfil, nunca la contrasena', async () => {
  const h = harness(root);
  const response = await h.service(request('/api/users', { name: 'Persona', username: 'Persona', password: '123', role: 'admin' }));
  assert.equal(response.status, 201);
  assert.deepEqual(h.created().data.app_metadata.roles, ['member']);
  assert.equal(h.created().email, 'persona@arissto.invalid');
  assert.ok(!(await response.text()).includes('123'));
});

test('el administrador puede editar el perfil y restablecer una clave sin cambiar permisos', async () => {
  let updated;
  const service = createService({ getUser: async () => root,
    admin: { getUser: async id => id === root.id ? root : a,
      updateUser: async (id, attributes) => { updated = { id, attributes }; return { ...a, name: attributes.user_metadata.full_name }; } },
    getStore: () => { throw new Error('No debe consultar los casos'); },
  });
  const result = await service(request('/api/users', { id: a.id, name: 'Nombre corregido', username: 'edwin', password: '456', role: 'admin' }));
  assert.equal(result.status, 200);
  assert.equal(updated.id, a.id);
  assert.equal(updated.attributes.password, '456');
  assert.equal(updated.attributes.email, 'edwin@arissto.invalid');
  assert.equal(updated.attributes.app_metadata.username, 'edwin');
  assert.ok(!(await result.text()).includes('456'));
});

test('sin secreto privado no se crea administrador; activacion es idempotente y no publica la clave', async () => {
  let calls = 0;
  let marker = null;
  let created;
  const dependencies = { admin: { listUsers: async () => [], createUser: async value => {
    calls++; created = value; return root;
  } }, getStore: () => ({ get: async () => marker, setJSON: async (_, value) => { marker = value; } }) };
  await ensureInitialAdmin({ ...dependencies });
  assert.equal(calls, 0);
  await ensureInitialAdmin({ ...dependencies, password: 'initial-test-password' });
  await ensureInitialAdmin({ ...dependencies, password: 'initial-test-password' });
  assert.equal(calls, 1);
  assert.equal(created.data.app_metadata.username, 'EdwinGomez');
  assert.deepEqual(marker, { id: root.id });
});

test('activar la cuenta inicial no asciende a un registro preexistente sin autorizacion', async () => {
  await assert.rejects(ensureInitialAdmin({ password: 'initial-test-password',
    getStore: () => ({ get: async () => null }),
    admin: { listUsers: async () => [{ ...a, email: 'edwingomez@arissto.invalid' }] },
  }), /requiere revision/);
});





test('el usuario actual puede cambiar usuario y contrasena desde una sola fuente', async () => {
  let account = { ...a, appMetadata: { username: 'admin' } };
  const service = createService({ getUser: async () => account,
    admin: { getUser: async () => account,
      updateUser: async (id, attributes) => { account = { ...account, email: attributes.email, name: attributes.user_metadata.full_name,
        roles: attributes.app_metadata.roles, appMetadata: { username: attributes.app_metadata.username } };
        return account; } },
    getStore: () => { throw new Error('No debe consultar los casos'); },
  });
  const short = await service(request('/api/profile', { username: 'edwin', password: '12' }));
  assert.equal(short.status, 400);
  const result = await service(request('/api/profile', { username: 'edwin', password: '123' }));
  assert.equal(result.status, 200);
  assert.equal(account.email, 'edwin@arissto.invalid');
  assert.equal(account.appMetadata.username, 'edwin');
});
