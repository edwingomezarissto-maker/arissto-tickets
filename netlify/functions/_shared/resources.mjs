import { randomUUID } from 'node:crypto';
import { publicAccount } from './accounts.mjs';
import { DataError, isAdmin } from './records.mjs';
import { linkCategories, webAddress } from '../../../src/resource-fields.mjs';

export const resourceStore = getStore => getStore({ name: 'arissto-resources-v1', consistency: 'strong' });
export function privateKeyPath(ownerId) {
  if (typeof ownerId !== 'string' || !/^[a-z\d_-]{1,128}$/i.test(ownerId)) throw new DataError('Identificador de cuenta inválido.');
  return 'private/' + ownerId;
}
const uuid = value => typeof value === 'string' && /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(value);
const conflict = () => new DataError('Hay una versión más reciente. Revise los cambios antes de guardar.', 409);
const json = { type: 'json' };

function checkFields(object, allowed) {
  if (!object || typeof object !== 'object' || Array.isArray(object) || Object.keys(object).some(key => !allowed.includes(key))) {
    throw new DataError('La solicitud contiene campos no admitidos.');
  }
}

function textField(value, max, required = false) {
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())) throw new DataError('Revise el nombre y la descripción.');
  return value.trim();
}

async function write(store, key, value, current) {
  const condition = current ? { onlyIfMatch: current.etag } : { onlyIfNew: true };
  if (!(await store.setJSON(key, value, condition)).modified) throw conflict();
}

export async function teamLinks(store, user, body) {
  if (!body) {
    const { blobs } = await store.list({ prefix: 'team/' });
    const links = [];
    for (let i = 0; i < blobs.length; i += 20) {
      const rows = await Promise.all(blobs.slice(i, i + 20).map(blob => store.get(blob.key, json)));
      links.push(...rows.filter(row => row && !row.deleted));
    }
    return { links };
  }
  const deleting = body.action === 'delete';
  checkFields(body, deleting ? ['action', 'id', 'version'] : ['action', 'id', 'version', 'title', 'description', 'category', 'url']);
  if ((!deleting && body.action !== 'save') || !uuid(body.id) || (body.version !== null && !uuid(body.version))) throw new DataError('Enlace inválido.');
  const key = 'team/' + body.id;
  const current = await store.getWithMetadata(key, json);
  const row = current?.data;
  if (row?.deleted || (!row && (deleting || body.version))) {
    if (deleting && body.version) return { deleted: body.id };
    throw new DataError('El enlace ya no está disponible.', 404);
  }
  if (row && row.ownerId !== user.id && !isAdmin(user)) throw new DataError('Solo el autor o un administrador puede cambiar este enlace.', 403);
  if (deleting) {
    if (row.version !== body.version) throw conflict();
    // Keep only a tombstone so delayed retries cannot recreate deleted content.
    await write(store, key, { deleted: true }, current);
    return { deleted: body.id };
  }
  const url = webAddress(body.url, true);
  if (!url) throw new DataError('Use un enlace http o https. Los enlaces con credenciales o tokens van en Mis accesos.');
  if (!linkCategories.includes(body.category)) throw new DataError('Elija una categoría.');
  const link = { id: body.id, title: textField(body.title, 150, true), description: textField(body.description, 600),
    category: body.category, url, ownerId: row?.ownerId ?? user.id, author: row?.author ?? publicAccount(user).name,
    version: randomUUID(), updatedAt: new Date().toISOString() };
  if (row && ['title', 'description', 'category', 'url'].every(field => row[field] === link[field])) return { link: row };
  if ((row?.version ?? null) !== body.version) throw conflict();
  await write(store, key, link, current);
  return { link };
}

function validBase64(value, bytes) {
  if (typeof value !== 'string' || value.length !== 4 * Math.ceil(bytes / 3)) return false;
  const decoded = Buffer.from(value, 'base64');
  return decoded.length === bytes && decoded.toString('base64') === value;
}

export async function personalVault(store, ownerId, body) {
  const key = privateKeyPath(ownerId);
  if (!body) return await store.get(key, json) || { version: null, envelope: null };
  checkFields(body, ['version', 'envelope']);
  if (body.version !== null && !uuid(body.version)) throw new DataError('Versión de bóveda inválida.');
  const envelope = body.envelope;
  checkFields(envelope, ['format', 'salt', 'iv', 'ciphertext']);
  if (typeof envelope.ciphertext === 'string' && envelope.ciphertext.length > 900000) throw new DataError('La bóveda excede el tamaño máximo.', 413);
  const size = typeof envelope.ciphertext === 'string' ? Buffer.byteLength(envelope.ciphertext, 'base64') : 0;
  if (envelope.format !== 1 || !validBase64(envelope.salt, 16) || !validBase64(envelope.iv, 12) ||
      size < 18 || !validBase64(envelope.ciphertext, size)) throw new DataError('El formato de los datos cifrados es inválido.');
  const current = await store.getWithMetadata(key, json);
  if ((current?.data.version ?? null) !== body.version) throw conflict();
  if (current && current.data.envelope.salt !== envelope.salt) throw new DataError('La clave de esta bóveda ha cambiado.', 409);
  const version = randomUUID();
  await write(store, key, { version, envelope }, current);
  return { version };
}
