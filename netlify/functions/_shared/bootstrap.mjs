// This secret is set only in Netlify's private environment, never in a public asset.
export async function ensureInitialAdmin({ password, admin, getStore }) {
  if (!password) return;
  const store = getStore({ name: 'arissto-support-v1', consistency: 'strong' });
  if (await store.get('initial-admin', { type: 'json' })) return;
  const email = 'edwingomez@arissto.invalid';
  let existing;
  for (let page = 1; ; page++) {
    const batch = await admin.listUsers({ page, perPage: 100 });
    existing = batch.find(user => user.email?.toLowerCase() === email);
    if (existing || batch.length < 100) break;
  }
  if (existing && (!existing.roles?.includes('admin') || existing.appMetadata?.username !== 'EdwinGomez')) {
    throw new Error('La cuenta inicial requiere revision en Netlify.');
  }
  const user = existing || await admin.createUser({ email, password,
    data: { user_metadata: { full_name: 'Edwin Gomez' }, app_metadata: { roles: ['admin'], username: 'EdwinGomez' } } });
  await store.setJSON('initial-admin', { id: user.id }, { onlyIfNew: true });
}
