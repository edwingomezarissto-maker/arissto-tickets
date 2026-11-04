import { randomUUID } from 'node:crypto';
import { resolveCaseCatalog } from '../../../src/catalog.mjs';

export class DataError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}
export const isAdmin = (user) => user?.roles?.includes('admin') === true;
export const DEFAULT_PROJECT_ID = 'project-arissto-financiero';
export const defaultProject = () => ({ id: DEFAULT_PROJECT_ID, name: 'Arissto Financiero', cooperativeId: '', archived: false, _version: 'system' });
export const emptyData = () => ({ cases: [], tasks: [], cooperatives: [], services: [], implementations: [], projects: [defaultProject()], timeEntries: [] });
const collections = ['cases', 'tasks', 'cooperatives', 'services'];
export function compactData(data) {
  const next = structuredClone(data);
  next.deletedIds = Object.fromEntries(collections.map(key => {
    const ids = new Set(data.deletedIds?.[key] || []);
    next[key] = (data[key] || []).filter(row => {
      if (!row.deleted) return true;
      ids.add(row.id);
      return false;
    });
    return [key, [...ids]];
  }));
  return next;
}
const canRead = (row, user) => isAdmin(user) || row.ownerId === user.id;
export function visibleData(data, user) {
  const visible = Object.fromEntries(collections.map(key => [key, (data[key] || []).filter(row =>
    !row.deleted && (key === 'cooperatives' || (key === 'services' ? canAccess(user, 'services') : canAccess(user, key) && canRead(row, user)))).map(row =>
      key === 'cases' ? resolveCaseCatalog(row, data.cooperatives.filter(item => !item.deleted)) : row)]));
  visible.implementations = (data.implementations || []).filter(row => canReadImplementation(row, user));
  const mayUseProjects = canAccess(user, 'implementations') || canAccess(user, 'time') || canAccess(user, 'cases') || canAccess(user, 'tasks');
  visible.projects = mayUseProjects ? (data.projects?.length ? data.projects : [defaultProject()]).filter(row => !row.archived) : [];
  visible.timeEntries = canAccess(user, 'time') || canAccess(user, 'implementations') ? (data.timeEntries || []).filter(row => row.ownerId === user.id) : [];
  return visible;
}
export const canAccess = (user, area) => isAdmin(user) || (user?.permissions || user?.appMetadata?.permissions || ['cases', 'tasks', 'time']).includes(area);
export const canReadImplementation = (row, user) => canAccess(user, 'implementations') && (isAdmin(user) || row.createdBy === user.id || row.teamIds?.includes(user.id));
export function synchronizeCaseCatalog(data, touch = true) {
  data.cases = data.cases.map(row => {
    const resolved = resolveCaseCatalog(row, data.cooperatives);
    if (touch && JSON.stringify(row) !== JSON.stringify(resolved)) {
      resolved._version = randomUUID(); resolved.updatedAt = new Date().toISOString();
    }
    return resolved;
  });
  return data;
}
const fields = {
  cases: ['title', 'cooperativeId', 'contactId', 'projectId', 'cooperative', 'requester', 'requesterPhone', 'requesterPosition', 'owner',
    'status', 'priority', 'requestDate', 'commitmentDate', 'clientRequest', 'currentProcess', 'observations'],
  tasks: ['title', 'projectId', 'owner', 'status', 'progress', 'details'],
  services: ['date', 'cooperativeId', 'cooperative', 'person', 'description', 'quantity', 'unitPrice', 'notes'],
  cooperatives: ['name'],
};
function cleanRow(kind, raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new DataError('Registro invalido.');
  const result = {};
  for (const key of fields[kind]) {
    if (kind === 'services' && ['quantity', 'unitPrice'].includes(key)) { result[key] = raw[key]; continue; }
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
  } else if (kind === 'services') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(result.date) || !Number.isFinite(Date.parse(result.date))) throw new DataError('Indique una fecha válida.');
    if (!result.cooperativeId || !result.cooperative || !result.person || !result.description) throw new DataError('Complete cooperativa, persona y servicio brindado.');
    const quantity = Number(raw.quantity), unitPrice = Number(raw.unitPrice);
    if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 1000000 || !Number.isFinite(unitPrice) || unitPrice < 0 || unitPrice > 100000000) throw new DataError('Revise cantidad y precio unitario.');
    result.quantity = quantity; result.unitPrice = unitPrice;
  } else {
    if (!result.title || !result.owner) throw new DataError('Complete el titulo y el encargado.');
    if (kind === 'cases') {
      if (!['Abierto', 'En proceso', 'En espera', 'Finalizado'].includes(result.status)) throw new DataError('Estado invalido.');
      if (!['Baja', 'Media', 'Alta'].includes(result.priority)) throw new DataError('Prioridad invalida.');
      for (const key of ['requestDate', 'commitmentDate']) {
        if (result[key] && (!/^\d{4}-\d{2}-\d{2}$/.test(result[key]) || !Number.isFinite(Date.parse(result[key])))) throw new DataError('Fecha invalida.');
      }
    }
    if (kind === 'tasks') {
      if (!result.status) result.status = 'Pendiente';
      if (!['Pendiente', 'En proceso', 'En espera', 'Finalizada', 'Cancelada'].includes(result.status)) throw new DataError('Estado de tarea invalido.');
    }
  }
  return result;
}

// A single conditional write commits a complete operation; stale clients cannot overwrite it.
export function applyOperations(data, operations, user, allowedOwners = new Set(), importing = false) {
  if (!Array.isArray(operations) || operations.length > 1000) throw new DataError('Operacion invalida.');
  if (importing && !isAdmin(user)) throw new DataError('Solo el administrador puede trasladar registros.', 403);
  const next = compactData(data);
  synchronizeCaseCatalog(next, false);
  for (const op of operations) {
    if (!collections.includes(op.collection) || typeof op.id !== 'string' || !op.id || op.id.length > 200) throw new DataError('Registro invalido.');
    const kind = op.collection;
    if (kind !== 'cooperatives' && !canAccess(user, kind === 'services' ? 'services' : kind)) throw new DataError('Su cuenta no tiene acceso a esta sección.', 403);
    const rows = next[kind];
    const index = rows.findIndex(row => row.id === op.id);
    const previous = rows[index];
    if (kind === 'cooperatives' && !isAdmin(user)) throw new DataError('Solo el administrador puede editar cooperativas.', 403);
    if (previous && kind !== 'cooperatives' && !canRead(previous, user)) throw new DataError('No tiene acceso a este registro.', 403);
    const deleted = next.deletedIds[kind].includes(op.id);
    if (importing && (previous || deleted)) continue;
    if (deleted || (previous && previous._version !== op.version) || (!previous && op.version)) {
      throw new DataError('El registro cambio en otro equipo. Revise la version actual antes de guardar.', 409);
    }
    if (op.action === 'delete') {
      if (!previous || importing) throw new DataError('No se puede eliminar este registro.', 400);
      rows.splice(index, 1);
      next.deletedIds[kind].push(op.id);
      continue;
    }
    if (op.action !== 'put') throw new DataError('Accion invalida.');
    const row = cleanRow(kind, op.record);
    if (kind === 'services') {
      const changedAfterInvoice = previous?.invoiceStatus === 'invoiced' && fields.services.some(key => row[key] !== previous[key]);
      row.invoiceStatus = previous?.invoiceStatus === 'invoiced' && !changedAfterInvoice ? 'invoiced' : 'pending';
      row.invoiceMarkedAt = row.invoiceStatus === 'invoiced' ? previous?.invoiceMarkedAt || '' : '';
      row.invoiceMarkedBy = row.invoiceStatus === 'invoiced' ? previous?.invoiceMarkedBy || '' : '';
    }
    if (kind === 'cases' && (row.cooperativeId || row.contactId)) {
      const cooperative = next.cooperatives.find(item => item.id === row.cooperativeId);
      if (!cooperative) throw new DataError('Seleccione una cooperativa vigente del catalogo.');
      if (row.contactId && !cooperative.contacts.some(item => item.id === row.contactId)) {
        throw new DataError('El cliente seleccionado no pertenece a esa cooperativa.');
      }
    }
    if (kind === 'services') {
      const cooperative = next.cooperatives.find(item => item.id === row.cooperativeId && !item.deleted);
      if (!cooperative) throw new DataError('Seleccione una cooperativa vigente del catalogo.');
      row.cooperative = cooperative.name;
    }
    if (kind !== 'cooperatives') {
      row.ownerId = isAdmin(user) ? (op.record.ownerId || previous?.ownerId || user.id) : user.id;
      if (!isAdmin(user) && op.record.ownerId && op.record.ownerId !== user.id) throw new DataError('No puede asignar registros a otra cuenta.', 403);
      if (row.ownerId !== user.id && !allowedOwners.has(row.ownerId)) throw new DataError('Seleccione una cuenta activa.');
    }
    if (kind === 'cases' || kind === 'tasks') {
      row.projectId ||= DEFAULT_PROJECT_ID;
      const project = (next.projects || [defaultProject()]).find(item => item.id === row.projectId && !item.archived);
      if (!project) throw new DataError('Seleccione un proyecto vigente.');
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
  return synchronizeCaseCatalog(next);
}
