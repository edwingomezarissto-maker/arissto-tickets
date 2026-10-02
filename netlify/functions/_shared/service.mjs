import { DataError, isAdmin, emptyData, visibleData, applyOperations } from './records.mjs';

const publicUser = user => ({ id: user.id, name: user.name || user.email || 'Usuario',
  username: user.appMetadata?.username || (user.email || '').split('@')[0], roles: user.roles || [] });
const cleanUsername = value => typeof value === 'string' ? value.trim() : '';
const usernameEmail = username => username.toLowerCase() + '@arissto.invalid';
const validPassword = value => typeof value === 'string' && value.length >= 3 && value.length <= 128;
const permitted = user => user && (isAdmin(user) || user.roles?.includes('member'));
const LEGACY_EDWIN_EMAIL = 'edwingomezarissto@gmail.com';
const LEGACY_EDWIN_NAME = 'edwin gomez';
const TARGET_EDWIN_USERNAME = 'EGOMEZ';

export function createService({ getUser, admin, getStore }) {
  async function users() {
    const result = [];
    for (let page = 1; ; page++) {
      const batch = await admin.listUsers({ page, perPage: 100 });
      result.push(...batch.filter(permitted).map(publicUser));
      if (batch.length < 100) return result;
    }
  }

  async function rawUsers() {
    const result = [];
    for (let page = 1; ; page++) {
      const batch = await admin.listUsers({ page, perPage: 100 });
      result.push(...batch);
      if (batch.length < 100) return result;
    }
  }

  async function migrateLegacyEdwinOwnership(store, user) {
    if ((user.appMetadata?.username || '').toUpperCase() !== TARGET_EDWIN_USERNAME) return;

    const allUsers = await rawUsers();
    const legacy = allUsers.find(item => (item.email || '').toLowerCase() === LEGACY_EDWIN_EMAIL);

    for (let attempt = 0; attempt < 5; attempt++) {
      const current = await store.getWithMetadata('records', { type: 'json' });
      const data = current?.data || emptyData();
      let changed = false;
      const next = structuredClone(data);

      for (const collection of ['cases', 'tasks']) {
        for (const row of next[collection] || []) {
          const legacyOwnerId = legacy && row.ownerId === legacy.id;
          const legacyOwnerName = String(row.owner || '').trim().toLowerCase() === LEGACY_EDWIN_NAME;
          if (row.ownerId !== user.id && (legacyOwnerId || legacyOwnerName)) {
            row.ownerId = user.id;
            row.owner = 'Edwin Gomez';
            row.updatedAt = new Date().toISOString();
            changed = true;
          }
        }
      }

      if (!changed) return;
      const result = await store.setJSON('records', next, current ? { onlyIfMatch: current.etag } : { onlyIfNew: true });
      if (result.modified) return;
    }
    throw new DataError('No se pudo completar la migracion de los registros de Edwin Gomez.', 409);
  }

  async function transferUserRecords(store, fromUserId, toUser) {
    const ownerName = publicUser(toUser).name;
    for (let attempt = 0; attempt < 5; attempt++) {
      const current = await store.getWithMetadata('records', { type: 'json' });
      const data = current?.data || emptyData();
      const next = structuredClone(data);
      let transferred = 0;

      for (const collection of ['cases', 'tasks']) {
        for (const row of next[collection] || []) {
          if (!row.deleted && row.ownerId === fromUserId) {
            row.ownerId = toUser.id;
            row.owner = ownerName;
            row.updatedAt = new Date().toISOString();
            transferred += 1;
          }
        }
      }

      if (!transferred) return 0;
      const result = await store.setJSON('records', next, current ? { onlyIfMatch: current.etag } : { onlyIfNew: true });
      if (result.modified) return transferred;
    }
    throw new DataError('No se pudieron transferir los registros del usuario. Intente nuevamente.', 409);
  }

  async function updateAccount(existing, { name, username, password }) {
    const nextUsername = cleanUsername(username);
    if (!/^[A-Za-z0-9._-]{3,40}$/.test(nextUsername)) throw new DataError('Ingrese un usuario valido de 3 a 40 caracteres.');
    if (password && !validPassword(password)) throw new DataError('La contrasena debe contener de 3 a 128 caracteres.');
    const updates = { email: usernameEmail(nextUsername),
      user_metadata: { ...existing.userMetadata, full_name: (name || existing.name || nextUsername).trim() },
      app_metadata: { ...existing.appMetadata, roles: existing.roles || [], username: nextUsername } };
    if (password) updates.password = password;
    return admin.updateUser(existing.id, updates);
  }

  return async function service(request) {
    const reply = (data, status = 200) => Response.json(data, { status, headers: {
      'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', Vary: 'Cookie, Authorization',
    } });
    try {
      if (!['GET', 'POST'].includes(request.method)) return reply({ error: 'Metodo no permitido.' }, 405);
      if (request.method === 'POST' && request.headers.get('origin') !== new URL(request.url).origin) {
        return reply({ error: 'Origen no permitido.' }, 403);
      }
      const session = await getUser();
      if (!session) return reply({ error: 'Inicie sesion para continuar.' }, 401);
      let user;
      try { user = await admin.getUser(session.id); }
      catch (error) { if (error.status === 404) return reply({ error: 'La cuenta ya no esta disponible.' }, 401); throw error; }
      if (!permitted(user)) return reply({ error: 'Su cuenta no tiene acceso. Contacte al administrador.' }, 403);
      let body;
      if (request.method === 'POST') {
        if (!request.headers.get('content-type')?.startsWith('application/json')) throw new DataError('Formato invalido.', 415);
        const text = await request.text();
        if (new TextEncoder().encode(text).length > 2000000) throw new DataError('Solicitud demasiado grande.', 413);
        try { body = JSON.parse(text); } catch { throw new DataError('Solicitud invalida.'); }
        if (!body || typeof body !== 'object') throw new DataError('Solicitud invalida.');
      }

      const path = new URL(request.url).pathname;
      if (path === '/api/profile') {
        if (request.method === 'GET') return reply({ user: publicUser(user) });
        const wantsPassword = typeof body.password === 'string' && body.password.length > 0;
        const updated = await updateAccount(user, { name: user.name || body.username, username: body.username,
          password: wantsPassword ? body.password : '' });
        return reply({ user: publicUser(updated) });
      }

      if (path === '/api/users') {
        if (!isAdmin(user)) return reply({ error: 'Solo el administrador puede gestionar usuarios.' }, 403);
        if (request.method === 'GET') return reply({ users: await users() });

        if (body.action === 'delete') {
          if (typeof body.id !== 'string' || !body.id) throw new DataError('Cuenta invalida.');
          if (body.id === user.id) throw new DataError('No puede eliminar la cuenta con la que tiene la sesion iniciada.', 403);
          const existing = await admin.getUser(body.id);
          if (!permitted(existing)) throw new DataError('La cuenta no pertenece al equipo.', 403);
          if (isAdmin(existing)) {
            const allUsers = await rawUsers();
            const adminCount = allUsers.filter(item => permitted(item) && isAdmin(item)).length;
            if (adminCount <= 1) throw new DataError('Debe conservar al menos una cuenta de administrador.', 403);
          }
          const store = getStore({ name: 'arissto-support-v1', consistency: 'strong' });
          const transferred = await transferUserRecords(store, existing.id, user);
          await admin.deleteUser(existing.id);
          return reply({ ok: true, transferred, users: await users() });
        }

        if (typeof body.name !== 'string' || !body.name.trim() || body.name.length > 150 ||
            typeof body.username !== 'string' || !/^[A-Za-z0-9._-]{3,40}$/.test(body.username) ||
            typeof body.password !== 'string' || body.password.length > 128 ||
            ((!body.id || body.password) && body.password.length < 3)) {
          throw new DataError('Complete nombre, usuario y una contrasena de 3 a 128 caracteres.');
        }
        if (body.id) {
          if (typeof body.id !== 'string') throw new DataError('Cuenta invalida.');
          const existing = await admin.getUser(body.id);
          if (!permitted(existing)) throw new DataError('La cuenta no pertenece al equipo.', 403);
          const updated = await updateAccount(existing, { name: body.name.trim(), username: body.username, password: body.password });
          return reply({ user: publicUser(updated) });
        }
        const username = cleanUsername(body.username);
        const created = await admin.createUser({ email: usernameEmail(username), password: body.password,
          data: { user_metadata: { full_name: body.name.trim() }, app_metadata: { roles: ['member'], username } } });
        return reply({ user: publicUser(created) }, 201);
      }

      const store = getStore({ name: 'arissto-support-v1', consistency: 'strong' });
      await migrateLegacyEdwinOwnership(store, user);

      if (request.method === 'GET') {
        const data = await store.get('records', { type: 'json' }) || emptyData();
        return reply({ ...visibleData(data, user), user: publicUser(user), users: isAdmin(user) ? await users() : [publicUser(user)] });
      }
      const allowedOwners = new Set(isAdmin(user) ? (await users()).map(item => item.id) : [user.id]);
      for (let attempt = 0; attempt < 5; attempt++) {
        const current = await store.getWithMetadata('records', { type: 'json' });
        const next = applyOperations(current?.data || emptyData(), body.operations, user, allowedOwners, body.importing === true);
        if (new TextEncoder().encode(JSON.stringify(next)).length > 4500000) throw new DataError('El almacenamiento alcanzo el limite de esta version. Contacte al administrador.', 413);
        const result = await store.setJSON('records', next, current ? { onlyIfMatch: current.etag } : { onlyIfNew: true });
        if (result.modified) return reply(visibleData(next, user));
      }
      return reply({ error: 'Hay cambios simultaneos. Intente guardar nuevamente.' }, 409);
    } catch (error) {
      if (error instanceof DataError) return reply({ error: error.message }, error.status);
      const status = error.status === 422 ? 422 : 503;
      return reply({ error: status === 422 ? 'No se pudo guardar la cuenta. Revise el usuario y la contrasena; el usuario puede estar registrado.' :
        'No se pudo conectar con el servicio. Sus cambios no se han confirmado. Intente nuevamente.' }, status);
    }
  };
}
