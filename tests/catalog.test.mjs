import test from 'node:test';
import assert from 'node:assert/strict';
import { createService } from '../netlify/functions/_shared/service.mjs';
import { applyOperations, emptyData, visibleData } from '../netlify/functions/_shared/records.mjs';
import { changeCatalog } from '../netlify/functions/_shared/catalog.mjs';

const admin = { id: 'admin', name: 'Administrador', roles: ['admin'] };
const member = { id: 'one', name: 'Usuario uno', roles: ['member'] };
const other = { id: 'two', name: 'Usuario dos', roles: ['member'] };
const request = body => new Request('https://example.test/api/support', { method: body ? 'POST' : 'GET',
  headers: { origin: 'https://example.test', 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
const cooperative = (id, name, contacts = []) => ({ id, name, contacts, _version: 'catalog-' + id });
const contact = (id, name, phone = '', position = '') => ({ id, name, phone, position });
const casePut = (id, ownerId, cooperativeId, contactId) => ({ collection: 'cases', id, action: 'put', record: {
  title: 'Caso ' + id, owner: ownerId, ownerId, status: 'Abierto', priority: 'Media', cooperativeId, contactId,
  cooperative: 'dato manipulable', requester: 'dato manipulable', requesterPhone: 'inventado', requesterPosition: 'inventado',
} });
function fixture(initial = emptyData()) {
  let data = structuredClone(initial); let etag = 0;
  const store = { get: async () => data, getWithMetadata: async () => ({ data, etag: String(etag) }),
    setJSON: async (_, next, condition) => {
      if (condition.onlyIfMatch !== String(etag)) return { modified: false };
      data = next; etag++; return { modified: true };
    } };
  return { data: () => data, as: actor => createService({ getUser: async () => actor,
    admin: { getUser: async () => actor, listUsers: async () => [admin, member, other] }, getStore: () => store }) };
}

test('un usuario comun crea cooperativa y cliente compartidos sin inventar cargo ni telefono', async () => {
  const h = fixture();
  const created = await (await h.as(member)(request({ action: 'catalog-create-cooperative', name: 'Nueva cooperativa' }))).json();
  const id = created.created.cooperativeId;
  const added = await h.as(member)(request({ action: 'catalog-create-contact', cooperativeId: id, name: 'Cliente nuevo' }));
  assert.equal(added.status, 200);
  const shared = await (await h.as(other)(request())).json();
  assert.deepEqual(shared.cooperatives[0].contacts[0], { id: (await added.json()).created.contactId, name: 'Cliente nuevo', phone: '', position: '' });
  assert.equal(shared.cooperatives[0].id, id);
});

test('reintentar creaciones no duplica ni modifica clientes existentes', () => {
  let data = emptyData();
  const first = changeCatalog(data, { action: 'catalog-create-cooperative', name: 'Cooperativa QA' }, member);
  const repeated = changeCatalog(first.next, { action: 'catalog-create-cooperative', name: ' cooperativa  qa ' }, member);
  assert.equal(repeated.created.cooperativeId, first.created.cooperativeId); assert.equal(repeated.next.cooperatives.length, 1);
  const body = { action: 'catalog-create-contact', cooperativeId: first.created.cooperativeId, name: 'Ana', phone: '70000001', position: 'Gerente' };
  const added = changeCatalog(repeated.next, body, member);
  const duplicate = changeCatalog(added.next, { ...body, position: 'Otro cargo' }, member);
  assert.equal(duplicate.next.cooperatives[0].contacts.length, 1);
  assert.equal(duplicate.next.cooperatives[0].contacts[0].position, 'Gerente');
  assert.equal(duplicate.created.contactId, added.created.contactId);
});

test('el caso usa los valores del catalogo y rechaza un cliente de otra cooperativa', () => {
  const data = { ...emptyData(), cooperatives: [cooperative('a', 'A', [contact('alice', 'Alicia')]), cooperative('b', 'B', [contact('bob', 'Beto')])] };
  const saved = applyOperations(data, [casePut('one', member.id, 'a', 'alice')], member);
  assert.equal(saved.cases[0].requester, 'Alicia'); assert.equal(saved.cases[0].requesterPhone, '');
  assert.equal(saved.cases[0].requesterPosition, ''); assert.equal(saved.cases[0].cooperative, 'A');
  assert.throws(() => applyOperations(data, [casePut('bad', member.id, 'a', 'bob')], member), { status: 400 });
  assert.equal(data.cases.length, 0);
});

test('editar un cliente actualiza en almacenamiento todos sus historicos, manteniendo el aislamiento de cuentas', async () => {
  const initial = { ...emptyData(), cooperatives: [cooperative('a', 'A', [contact('alice', 'Alicia', '70000001', 'Analista')])] };
  const data = applyOperations(initial, [casePut('one', member.id, 'a', 'alice'), casePut('two', other.id, 'a', 'alice')], admin, new Set([member.id, other.id]));
  const oldVersion = data.cases[0]._version;
  const h = fixture(data);
  const edit = { action: 'catalog-update-contact', cooperativeId: 'a', contactId: 'alice', version: 'catalog-a', name: 'Alicia actualizada', phone: '70000002', position: 'Gerente' };
  assert.equal((await h.as(member)(request(edit))).status, 403);
  const result = await h.as(admin)(request(edit)); assert.equal(result.status, 200);
  for (const row of h.data().cases) { assert.equal(row.requesterPhone, '70000002'); assert.equal(row.requesterPosition, 'Gerente'); assert.equal(row.requester, 'Alicia actualizada'); }
  assert.notEqual(h.data().cases[0]._version, oldVersion);
  const own = await (await h.as(member)(request())).json(); assert.equal(own.cases.length, 1); assert.equal(own.cases[0].ownerId, member.id);
  const stale = { ...casePut('one', member.id, 'a', 'alice'), version: oldVersion };
  assert.equal((await h.as(member)(request({ operations: [stale] }))).status, 409);
});

test('los historicos antiguos se vinculan por nombre unico antes de renombrar cooperativa o cliente', () => {
  const old = { ...emptyData(), cooperatives: [cooperative('a', 'Cooperativa antigua', [contact('x', 'Ana', '70000001', 'Analista')])],
    cases: [{ id: 'old', ownerId: member.id, cooperative: 'Cooperativa antigua', requester: 'Ana', requesterPhone: '70000001', _version: 'old' }] };
  const renamed = applyOperations(old, [{ collection: 'cooperatives', id: 'a', action: 'put', version: 'catalog-a',
    record: { name: 'Cooperativa nueva', contacts: [contact('x', 'Ana nueva', '', '')] } }], admin);
  assert.equal(renamed.cases[0].cooperativeId, 'a'); assert.equal(renamed.cases[0].contactId, 'x');
  assert.equal(renamed.cases[0].cooperative, 'Cooperativa nueva'); assert.equal(renamed.cases[0].requester, 'Ana nueva');
  assert.equal(renamed.cases[0].requesterPhone, ''); assert.equal(renamed.cases[0].requesterPosition, '');
});

test('clientes con el mismo nombre en cooperativas diferentes no se mezclan; coincidencias ambiguas no se adivinan', () => {
  const data = { ...emptyData(), cooperatives: [cooperative('a', 'A', [contact('one', 'Ana', '70000001'), contact('two', 'Ana', '70000002')]),
    cooperative('b', 'B', [contact('three', 'Ana', '70000003')])], cases: [
    { id: 'first', ownerId: member.id, cooperative: 'A', requester: 'Ana', requesterPhone: '70000001' },
    { id: 'second', ownerId: member.id, cooperative: 'B', requester: 'Ana' },
    { id: 'ambiguous', ownerId: member.id, cooperative: 'A', requester: 'Ana', requesterPhone: '' },
  ] };
  const rows = visibleData(data, member).cases;
  assert.equal(rows[0].contactId, 'one'); assert.equal(rows[1].contactId, 'three');
  assert.equal(rows[2].contactId, undefined); assert.equal(rows[2].requesterPhone, '');
});

test('al eliminar un contacto, sus datos no quedan obsoletos en historicos ni se enlazan a otro homonimo', () => {
  let data = { ...emptyData(), cooperatives: [cooperative('a', 'A', [contact('x', 'Ana', '70000001', 'Gerente')])] };
  data = applyOperations(data, [casePut('one', member.id, 'a', 'x')], member);
  data = applyOperations(data, [{ collection: 'cooperatives', id: 'a', action: 'put', version: 'catalog-a', record: { name: 'A', contacts: [] } }], admin);
  assert.equal(data.cases[0].requesterPhone, ''); assert.equal(data.cases[0].requesterPosition, '');
  data = changeCatalog(data, { action: 'catalog-create-contact', cooperativeId: 'a', name: 'Ana', phone: '70000009' }, member).next;
  assert.equal(data.cases[0].contactId, 'x'); assert.equal(data.cases[0].requesterPhone, '');
});

test('validacion de catalogo y version de edicion impiden cambios incompletos o simultaneos', () => {
  const data = { ...emptyData(), cooperatives: [cooperative('a', 'A', [contact('x', 'Ana')])] };
  assert.throws(() => changeCatalog(data, { action: 'catalog-create-contact', cooperativeId: 'a', name: '' }, member), { status: 400 });
  assert.throws(() => changeCatalog(data, { action: 'catalog-update-contact', cooperativeId: 'a', contactId: 'x', version: 'stale', name: 'Ana' }, admin), { status: 409 });
  assert.throws(() => changeCatalog(data, { action: 'catalog-create-contact', cooperativeId: 'other', name: 'Ana' }, member), { status: 409 });
});

