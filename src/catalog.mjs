export const catalogKey = value => String(value || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('es-SV');

// Legacy names are linked only when the match is unique within the cooperative.
export function resolveCaseCatalog(row, cooperatives) {
  const matches = row.cooperativeId
    ? cooperatives.filter(item => item.id === row.cooperativeId)
    : cooperatives.filter(item => catalogKey(item.name) === catalogKey(row.cooperative));
  if (matches.length !== 1) {
    return row.cooperativeId ? { ...row, cooperative: '', requester: '', requesterPhone: '', requesterPosition: '' } : { ...row };
  }
  const cooperative = matches[0];
  const next = { ...row, cooperativeId: cooperative.id, cooperative: cooperative.name };
  let contacts = row.contactId
    ? cooperative.contacts.filter(item => item.id === row.contactId)
    : cooperative.contacts.filter(item => catalogKey(item.name) === catalogKey(row.requester));
  if (!row.contactId && contacts.length > 1 && row.requesterPhone) {
    contacts = contacts.filter(item => catalogKey(item.phone) === catalogKey(row.requesterPhone));
  }
  if (contacts.length === 1) {
    const contact = contacts[0];
    Object.assign(next, { contactId: contact.id, requester: contact.name, requesterPhone: contact.phone || '', requesterPosition: contact.position || '' });
  } else if (row.contactId) {
    Object.assign(next, { requester: '', requesterPhone: '', requesterPosition: '' });
  }
  return next;
}

