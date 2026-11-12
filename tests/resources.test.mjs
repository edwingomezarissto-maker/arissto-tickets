import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createService } from '../netlify/functions/_shared/service.mjs';
import { memoryResourceStore } from './fixtures/resource-store.mjs';
import { newVaultSalt, openVault, sealVault, vaultKey } from '../src/vault-crypto.mjs';

function fixture() {
  const resources = memoryResourceStore(), support = memoryResourceStore();
  const accounts = ['ana', 'luis', 'admin', 'revoked'].map(id => ({
    id, name: id, roles: id === 'revoked' ? [] : [id === 'admin' ? 'admin' : 'member'], appMetadata: { permissions: [] },
  }));
  const admin = { getUser: async id => accounts.find(user => user.id === id), listUsers: async () => accounts };
  const send = (actor, path, body, options = {}) => {
    const headers = { origin: 'https://test.example', 'Content-Type': 'application/json', 'X-Arissto-Account': actor || '', ...options.headers };
    const service = createService({ admin, getUser: async () => actor && { id: actor }, getStore: ({ name }) => name === 'arissto-resources-v1' ? resources : support });
    return service(new Request('https://test.example' + path, { method: body ? 'POST' : 'GET', headers, body: body && JSON.stringify(body) }));
  };
  return { send, resources };
}

const newLink = () => ({ id: randomUUID(), version: null, action: 'save', title: 'Manual', description: 'Procedimiento de soporte',
  category: 'Documento', url: 'https://docs.example.org/guia?seccion=cierre' });

test('library and vault require a current member session, the expected account and same origin on writes', async () => {
  const { send } = fixture();
  for (const path of ['/api/links', '/api/vault']) {
    assert.equal((await send(null, path)).status, 401);
    assert.equal((await send('revoked', path)).status, 403);
    assert.equal((await send('admin', path, null, { headers: { 'X-Arissto-Account': 'ana' } })).status, 403);
    assert.equal((await send('ana', path, {}, { headers: { origin: 'https://elsewhere.example' } })).status, 403);
    assert.equal((await send('admin', path + '?ownerId=ana')).status, 400);
    assert.match((await send('ana', path)).headers.get('cache-control'), /no-store/);
  }
});

test('links can be read by the whole team, changed by their author or admin, and deleted without revival', async () => {
  const { send, resources } = fixture();
  const input = newLink();
  const { link } = await (await send('ana', '/api/links', input)).json();
  assert.equal(link.ownerId, 'ana');
  const { links } = await (await send('luis', '/api/links')).json();
  assert.deepEqual(links, [link]);
  assert.equal((await send('ana', '/api/links', input)).status, 200, 'retry of the same create is idempotent');
  const edit = { ...input, title: 'Manual actualizado', version: link.version };
  const del = { action: 'delete', id: link.id, version: link.version };
  assert.equal((await send('luis', '/api/links', edit)).status, 403);
  assert.equal((await send('luis', '/api/links', del)).status, 403);
  const { link: changed } = await (await send('admin', '/api/links', edit)).json();
  assert.equal(changed.ownerId, 'ana'); assert.notEqual(changed.version, link.version);
  assert.equal((await send('ana', '/api/links', { ...edit, title: 'Conflicto' })).status, 409);
  assert.equal((await send('ana', '/api/links', del)).status, 409);
  assert.equal((await send('ana', '/api/links', { ...del, version: changed.version })).status, 200);
  assert.deepEqual(await resources.get('team/' + input.id), { deleted: true });
  assert.deepEqual((await (await send('admin', '/api/links')).json()).links, []);
  assert.equal((await send('ana', '/api/links', input)).status, 404);
});

test('shared links reject credential fields, unsafe URLs, embedded credentials and recognized secret parameters', async () => {
  const { send } = fixture();
  const input = newLink();
  for (const url of ['javascript:alert(1)', '/relative', 'https://user:pass@docs.example/', 'https://docs.example/?api_key=secret',
    'https://docs.example/#access_token=secret', 'https://docs.example/#/go?X-Amz-Signature=secret']) {
    assert.equal((await send('ana', '/api/links', { ...input, url })).status, 400);
  }
  for (const extra of [{ password: 'private' }, { username: 'private' }, { ownerId: 'admin' }, { category: 'Credencial' }]) {
    assert.equal((await send('ana', '/api/links', { ...input, ...extra })).status, 400);
  }
  assert.equal((await send('ana', '/api/links', { ...input, url: 'https://drive.google.com/open?id=documento' })).status, 200);
});

test('encryption binds entries to their owner, authenticates contents and uses a fresh IV on every save', async () => {
  const salt = newVaultSalt(), key = await vaultKey('una frase solo de ensayo', salt);
  const rows = [{ title: 'Portal', username: 'empleado-de-prueba', password: 'solo de prueba' }];
  const encrypted = await sealVault(rows, key, salt, 'ana');
  assert.deepEqual(await openVault(encrypted, key, 'ana'), rows);
  const other = await sealVault(rows, key, salt, 'ana');
  assert.notEqual(other.iv, encrypted.iv); assert.notEqual(other.ciphertext, encrypted.ciphertext);
  assert.equal(key.extractable, false);
  await assert.rejects(openVault(encrypted, key, 'luis'));
  await assert.rejects(openVault(encrypted, await vaultKey('otra frase de ensayo', salt), 'ana'));
  const flipped = Buffer.from(encrypted.ciphertext, 'base64'); flipped[0] ^= 1;
  await assert.rejects(openVault({ ...encrypted, ciphertext: flipped.toString('base64') }, key, 'ana'));
});

test('vault files remain owner-only including for admins and do not enter support, links, or account responses', async () => {
  const { send, resources } = fixture();
  const salt = newVaultSalt(), key = await vaultKey('clave de ensayo privada', salt);
  const envelope = await sealVault([{ username: 'private-test-user', password: 'private-test-password' }], key, salt, 'ana');
  const response = await send('ana', '/api/vault', { version: null, envelope });
  assert.equal(response.status, 200);
  const { version } = await response.json(); assert.ok(version);
  const own = await (await send('ana', '/api/vault')).json();
  assert.deepEqual(own, { version, envelope });
  assert.ok(!JSON.stringify(await resources.get('private/ana')).includes('private-test'));
  for (const actor of ['luis', 'admin']) {
    assert.deepEqual(await (await send(actor, '/api/vault')).json(), { version: null, envelope: null });
    assert.equal((await send(actor, '/api/vault', { ownerId: 'ana', version, envelope })).status, 400);
    assert.equal((await send(actor, '/api/vault', { version, envelope })).status, 409);
  }
  for (const path of ['/api/support', '/api/links', '/api/users', '/api/profile']) {
    const response = await send('admin', path); assert.equal(response.status, 200);
    const text = await response.text(); assert.ok(!text.includes(envelope.ciphertext) && !text.includes('private-test'));
  }
});

test('vault updates reject invalid envelopes and preserve the first writer on a simultaneous edit', async () => {
  const { send } = fixture();
  const salt = newVaultSalt(), key = await vaultKey('prueba de concurrencia', salt);
  const envelope = await sealVault([], key, salt, 'ana');
  for (const invalid of [{ ...envelope, password: 'plaintext' }, { ...envelope, ciphertext: 'abcd' }, { ...envelope, iv: 'invalid' }, { ...envelope, format: 2 }]) {
    assert.equal((await send('ana', '/api/vault', { version: null, envelope: invalid })).status, 400);
  }
  const { version } = await (await send('ana', '/api/vault', { version: null, envelope })).json();
  const changes = await Promise.all(['uno', 'dos'].map(async title => send('ana', '/api/vault', {
    version, envelope: await sealVault([{ title }], key, salt, 'ana'),
  })));
  assert.deepEqual(changes.map(response => response.status).sort(), [200, 409]);
  assert.equal((await send('ana', '/api/vault', { version: null, envelope })).status, 409);
});
