import { randomUUID } from 'node:crypto';
import { catalogKey } from '../../../src/catalog.mjs';
import { DataError, isAdmin, compactData, synchronizeCaseCatalog } from './records.mjs';

const text = (value, label, required = false) => {
  if (typeof value !== 'string' || value.length > 300 || (required && !value.trim())) throw new DataError('Revise ' + label + '.');
  return value.trim();
};

// Common users can append catalog entries, never replace existing cooperative data.
export function changeCatalog(data, body, actor) {
  const next = synchronizeCaseCatalog(compactData(data), false);
  const now = new Date().toISOString();
  const name = text(body.name, 'el nombre', true);
  if (body.action === 'catalog-create-cooperative') {
    let cooperative = next.cooperatives.find(item => catalogKey(item.name) === catalogKey(name));
    const existed = Boolean(cooperative);
    if (!cooperative) {
      cooperative = { id: randomUUID(), name, contacts: [], _version: randomUUID(), createdAt: now, updatedAt: now };
      next.cooperatives.push(cooperative);
    }
    return { next: synchronizeCaseCatalog(next), created: { cooperativeId: cooperative.id, existed } };
  }
  const cooperative = next.cooperatives.find(item => item.id === body.cooperativeId);
  if (!cooperative) throw new DataError('La cooperativa ya no esta disponible. Vuelva a buscarla.', 409);
  const phone = text(body.phone ?? '', 'el telefono');
  const position = text(body.position ?? '', 'el cargo');
  const duplicate = cooperative.contacts.find(item => catalogKey(item.name) === catalogKey(name) && catalogKey(item.phone) === catalogKey(phone));
  let contact;
  let existed = false;
  if (body.action === 'catalog-update-contact') {
    if (!isAdmin(actor)) throw new DataError('Solo un administrador puede modificar clientes existentes.', 403);
    if (body.version !== cooperative._version) throw new DataError('El catalogo cambio. Cierre la ventana, actualice y vuelva a editar.', 409);
    contact = cooperative.contacts.find(item => item.id === body.contactId);
    if (!contact) throw new DataError('El cliente ya no esta disponible.', 409);
    if (duplicate && duplicate.id !== contact.id) throw new DataError('Ya existe un cliente con ese nombre y telefono.', 409);
    Object.assign(contact, { name, phone, position });
  } else if (body.action === 'catalog-create-contact') {
    contact = duplicate;
    existed = Boolean(contact);
    if (!contact) {
      if (cooperative.contacts.length >= 2000) throw new DataError('Esta cooperativa alcanzo el limite de clientes.');
      contact = { id: randomUUID(), name, phone, position }; cooperative.contacts.push(contact);
    }
  } else throw new DataError('Accion de catalogo invalida.');
  if (!existed) Object.assign(cooperative, { _version: randomUUID(), updatedAt: now });
  return { next: synchronizeCaseCatalog(next), created: { cooperativeId: cooperative.id, contactId: contact.id, existed } };
}

