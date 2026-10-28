import { DataError, compactData } from './records.mjs';

const primaryEmails = new Set(['egomez@arissto.invalid', 'admin@arissto.invalid']);
export const primaryAccount = user => user?.appMetadata?.arisstoPrimaryAdmin === true;
export const accountRole = user => user?.roles?.includes('admin') ? 'admin' : user?.roles?.includes('member') ? 'member' : '';
export const accountUsername = user => user?.appMetadata?.username || (user?.email || '').split('@')[0];
export const publicAccount = user => ({ id: user.id, name: user.name || user.userMetadata?.full_name || user.email || 'Usuario',
  username: accountUsername(user), roles: user.roles || [], primaryAdmin: primaryAccount(user) });

export async function listAccounts(admin) {
  const result = [];
  for (let page = 1; ; page++) {
    const batch = await admin.listUsers({ page, perPage: 100 });
    result.push(...batch);
    if (batch.length < 100) return result;
  }
}

export function validateAccountChange(existing, username, role) {
  if (!['admin', 'member'].includes(role)) throw new DataError('Seleccione Administrador o Usuario comun.');
  const reserved = ['egomez', 'admin'].includes(username.toLowerCase());
  if (reserved && username.toLowerCase() !== accountUsername(existing).toLowerCase()) {
    throw new DataError('EGOMEZ y ADMIN son usuarios reservados para las cuentas principales.', 409);
  }
  if (primaryAccount(existing) && (role !== 'admin' || username.toLowerCase() !== accountUsername(existing).toLowerCase())) {
    throw new DataError('EGOMEZ y ADMIN deben conservar su usuario y acceso de administrador.', 403);
  }
}

// Apply the user's requested baseline once; subsequent panel changes remain authoritative.
export async function ensureAccountPolicy({ admin, getStore }) {
  const store = getStore({ name: 'arissto-support-v1', consistency: 'strong' });
  if (await store.get('account-policy-v1', { type: 'json' })) return;
  for (const account of await listAccounts(admin)) {
    const primary = primaryEmails.has((account.email || '').toLowerCase());
    await admin.updateUser(account.id, {
      app_metadata: { ...account.appMetadata, username: primary ? account.email.split('@')[0].toUpperCase() : accountUsername(account),
        roles: [primary ? 'admin' : 'member'], arisstoPrimaryAdmin: primary },
    });
  }
  for (let attempt = 0; attempt < 5; attempt++) {
    const current = await store.getWithMetadata('records', { type: 'json' });
    if (!current || !['cases', 'tasks', 'cooperatives'].some(key => current.data[key]?.some(row => row.deleted))) break;
    const result = await store.setJSON('records', compactData(current.data), { onlyIfMatch: current.etag });
    if (result.modified) break;
    if (attempt === 4) throw new DataError('No se pudo sincronizar la limpieza de registros eliminados.', 409);
  }
  await store.setJSON('account-policy-v1', { version: 1 }, { onlyIfNew: true });
}
