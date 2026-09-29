import { randomUUID } from 'node:crypto';

export class DataError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}
export const isAdmin = (user) => user?.roles?.includes('admin') === true;
export const emptyData = () => ({ cases: [], tasks: [], cooperatives: [] });
const collections = ['cases', 'tasks', 'cooperatives'];
const canRead = (row, user) => isAdmin(user) || row.ownerId === user.id;
export function visibleData(data, user) {
  return Object.fromEntries(collections.map(key => [key, data[key].filter(row =>
    !row.deleted && (key === 'cooperatives' || canRead(row, user)))]));
}
const fields = {
  cases: ['title', 'cooperative', 'requester', 'requesterPhone', 'requesterPosition', 'owner',
    'status', 'priority', 'requestDate', 'commitmentDate', 'clientRequest', 'currentProcess', 'observations'],
  tasks: ['title', 'owner', 'progress', 'details'],
  cooperatives: ['name'],
};
function cleanRow(kind, raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new DataError('Registro invalido.');
  const result = {};
  for (const key of fields[kind]) {
    if (raw[key] != null && typeof raw[key] !== 'string') throw new DataError('Campo invalido: ' + key);
    result[key] = (raw[key] || '').trim();
    if (result[key].length > 30000) throw new DataError('El texto es demasiado largo.');
  }
  if (kind === 'cooperatives') {
    if (!result.name) throw new DataError('Indique el nombre de la cooperativa.');
    if (!Array.isArray(raw.contacts) || raw.contacts.length > 2000) throw new DataError('Contactos invalidos.');
    result.contacts = raw.contacts.map(contact => {
      if (!contact || typeof contact.id !== 'string' || typeof contact.name !== 'string') throw new DataError('Contacto invalido.');
      return Object.fromEntries(['id', 'name', 'phone', 'position'].map(key => [key, String(contact[key] || '').slice(0, 300)]));
    });
  } else {
    if (!result.title || !result.owner) throw new DataError('Complete el titulo y el encargado.');
    if (kind === 'cases') {
      if (!['Abierto', 'En proceso', 'En espera', 'Finalizado'].includes(result.status)) throw new DataError('Estado invalido.');
      if (!['Baja', 'Media', 'Alta'].includes(result.priority)) throw new DataError('Prioridad invalida.');
      for (const key of ['requestDate', 'commitmentDate']) {
        if (result[key] && (!/^\d{4}-\d{2}-\d{2}$/.test(result[key]) || !Number.isFinite(Date.parse(result[key])))) throw new DataError('Fecha invalida.');
      }
    }
  }
  return result;
}

// A single conditional write commits a complete operation; stale clients cannot overwrite it.
export function applyOperations(data, operations, user, allowedOwners = new Set(), importing = false) {
  if (!Array.isArray(operations) || operations.length > 1000) throw new DataError('Operacion invalida.');
  if (importing && !isAdmin(user)) throw new DataError('Solo el administrador puede trasladar registros.', 403);
  const next = structuredClone(data);
  for (const op of operations) {
    if (!collections.includes(op.collection) || typeof op.id !== 'string' || !op.id || op.id.length > 200) throw new DataError('Registro invalido.');
    const kind = op.collection;
    const rows = next[kind];
    const index = rows.findIndex(row => row.id === op.id);
    const previous = rows[index];
    if (kind === 'cooperatives' && !isAdmin(user)) throw new DataError('Solo el administrador puede editar cooperativas.', 403);
    if (previous && kind !== 'cooperatives' && !canRead(previous, user)) throw new DataError('No tiene acceso a este registro.', 403);
    if (importing && previous) continue;
    if (previous?.deleted || (previous && previous._version !== op.version) || (!previous && op.version)) {
      throw new DataError('El registro cambio en otro equipo. Revise la version actual antes de guardar.', 409);
    }
    if (op.action === 'delete') {
      if (!previous || importing) throw new DataError('No se puede eliminar este registro.', 400);
      rows[index] = { ...previous, deleted: true, updatedAt: new Date().toISOString(), _version: randomUUID() };
      continue;
    }
    if (op.action !== 'put') throw new DataError('Accion invalida.');
    const row = cleanRow(kind, op.record);
    if (kind !== 'cooperatives') {
      row.ownerId = isAdmin(user) ? (op.record.ownerId || previous?.ownerId || user.id) : user.id;
      if (!isAdmin(user) && op.record.ownerId && op.record.ownerId !== user.id) throw new DataError('No puede asignar registros a otra cuenta.', 403);
      if (row.ownerId !== user.id && !allowedOwners.has(row.ownerId)) throw new DataError('Seleccione una cuenta activa.');
    }
    const now = new Date().toISOString();
    Object.assign(row, { id: op.id, _version: randomUUID(), createdAt: previous?.createdAt || now, updatedAt: now });
    if (importing) {
      for (const key of ['createdAt', 'updatedAt']) {
        if (typeof op.record[key] === 'string' && Number.isFinite(Date.parse(op.record[key]))) row[key] = op.record[key];
      }
    }
    if (previous) rows[index] = row;
    else rows.push(row);
  }
  return next;
}
