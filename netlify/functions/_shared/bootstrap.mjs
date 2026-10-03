// This secret is set only in Netlify's private environment, never in a public asset.
const INITIAL_ADMIN = {
  email: 'egomez@arissto.invalid',
  fullName: 'Edwin Gomez',
  username: 'EGOMEZ',
};

export async function ensureInitialAdmin({ password, admin, getStore }) {
  if (!password) return;

  const store = getStore({ name: 'arissto-support-v1', consistency: 'strong' });
  let existing;
  for (let page = 1; ; page++) {
    const batch = await admin.listUsers({ page, perPage: 100 });
    existing = batch.find(user => user.email?.toLowerCase() === INITIAL_ADMIN.email);
    if (existing || batch.length < 100) break;
  }

  let user = existing;
  if (!user) {
    user = await admin.createUser({
      email: INITIAL_ADMIN.email,
      password,
      data: {
        user_metadata: { full_name: INITIAL_ADMIN.fullName },
        app_metadata: { roles: ['admin'], username: INITIAL_ADMIN.username },
      },
    });
  } else {
    const hadAdminRole = user.roles?.includes('admin') === true;
    const currentName = user.userMetadata?.full_name || user.name || '';
    const needsRepair = !hadAdminRole ||
      user.appMetadata?.username !== INITIAL_ADMIN.username ||
      currentName !== INITIAL_ADMIN.fullName;

    if (needsRepair) {
      const roles = new Set(user.roles || []);
      roles.add('admin');
      user = await admin.updateUser(user.id, {
        user_metadata: { ...user.userMetadata, full_name: INITIAL_ADMIN.fullName },
        app_metadata: { ...user.appMetadata, roles: [...roles], username: INITIAL_ADMIN.username },
      });
    }
  }

  await store.setJSON('initial-admin', { id: user.id });
}
