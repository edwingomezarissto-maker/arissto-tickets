import { login, logout, getUser, getSettings, handleAuthCallback,
  acceptInvite, onAuthChange } from '@netlify/identity';
import { makeOperations, emptySnapshot } from './sync.mjs';

const $ = id => document.getElementById(id);
const local = location.protocol === 'file:';
let user = null;
let users = [];
let snapshot = emptySnapshot();
let saving = false;
let refreshing = false;
let epoch = 0;
let passwordMode = null;
let invitationToken = null;
let connected = false;
const administrator = () => user?.roles?.includes('admin') === true;
const message = text => { $('accessMessage').textContent = text; };
const status = text => { $('syncStatus').textContent = text; };
const errorText = error => error.status === 401 || error.status === 400 ? 'Revise el usuario y la contrasena.' :
  error.status === 422 ? 'Revise los datos y use una contrasena de al menos 3 caracteres.' :
  'No se pudo completar la solicitud. Revise su conexion e intente nuevamente.';

function showLogin(text = 'Ingrese con el usuario y la contrasena de su cuenta.') {
  $('accessScreen').hidden = false;
  $('appShell').hidden = true;
  $('accessTitle').textContent = 'Ingresar a mi cuenta';
  $('loginForm').hidden = false;
  $('passwordForm').hidden = true;
  message(text);
}

function lock(text) {
  epoch++;
  connected = false;
  user = null;
  users = [];
  snapshot = emptySnapshot();
  passwordMode = null;
  invitationToken = null;
  resetUserForm();
  $('usersBody').replaceChildren();
  $('sessionLabel').textContent = '';
  $('loginPassword').value = '';
  $('passwordForm').reset();
  window.ARISSTO_APP.clear();
  showLogin(text);
}

async function api(path, body) {
  const response = await fetch(path, { method: body ? 'POST' : 'GET', credentials: 'same-origin', cache: 'no-store',
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(25000) });
  let data;
  try { data = await response.json(); } catch { throw new Error('El servicio de sincronizacion no esta disponible en esta direccion.'); }
  if (!response.ok) {
    const error = new Error(data.error || 'No se pudo guardar.');
    error.status = response.status;
    if ([401, 403].includes(response.status)) lock(error.message);
    throw error;
  }
  return data;
}

function receive(data) {
  snapshot = Object.fromEntries(['cases', 'tasks', 'cooperatives'].map(key => [key, structuredClone(data[key] || [])]));
  window.ARISSTO_APP.receive(snapshot);
}

function drawUsers() {
  $('usersBody').replaceChildren();
  for (const account of users) {
    const tr = document.createElement('tr');
    for (const value of [account.name, account.username, account.roles.includes('admin') ? 'Administrador' : 'Usuario']) {
      const td = document.createElement('td'); td.textContent = value; tr.append(td);
    }
    const actions = document.createElement('td');
    const edit = document.createElement('button');
    edit.type = 'button'; edit.className = 'secondary-button'; edit.textContent = 'Editar';
    edit.addEventListener('click', () => {
      $('editUserId').value = account.id; $('userName').value = account.name;
      $('userUsername').value = account.username; $('userUsername').readOnly = false;
      $('userPassword').value = ''; $('userPassword').required = false;
      $('userPasswordLabel').textContent = 'Nueva contrasena (opcional, minimo 3 caracteres)';
      $('saveUserButton').textContent = 'Guardar cambios'; $('cancelUserEdit').hidden = false;
      $('userName').focus();
    });
    actions.append(edit); tr.append(actions);
    $('usersBody').append(tr);
  }
}

async function migrateLegacy() {
  if (!administrator()) return;
  const marker = 'arisstoCloudMigration:' + user.id;
  if (localStorage.getItem(marker) === 'done') return;
  const legacy = window.ARISSTO_APP.legacy();
  const operations = makeOperations(emptySnapshot(), legacy).map(op => ({ ...op, version: null,
    record: { ...op.record, ownerId: user.id } }));
  if (!operations.length) return;
  status('Trasladando los registros guardados en este navegador...');
  for (let offset = 0; offset < operations.length; offset += 100) {
    await api('/api/support', { importing: true, operations: operations.slice(offset, offset + 100) });
  }
  localStorage.setItem(marker, 'done');
}

async function enter() {
  const currentEpoch = epoch;
  message('Verificando cuenta y cargando registros...');
  const data = await api('/api/support');
  if (currentEpoch !== epoch) return;
  user = data.user;
  users = data.users;
  let migrationWarning = '';
  try { await migrateLegacy(); } catch (error) { migrationWarning = 'No se completo el traslado local: ' + error.message; }
  if (currentEpoch !== epoch) return;
  const latest = await api('/api/support');
  if (currentEpoch !== epoch) return;
  receive(latest);
  connected = true;
  $('usersTab').hidden = !administrator();
  document.querySelector('[data-tab-target="cooperativesSection"]').hidden = !administrator();
  $('sessionLabel').textContent = (administrator() ? 'Administrador: ' : 'Mi espacio: ') + user.name;
  for (const id of ['refreshCloud', 'changePassword', 'logoutButton']) $(id).hidden = false;
  $('accessScreen').hidden = true;
  $('appShell').hidden = false;
  $('loginForm').reset();
  drawUsers();
  status(migrationWarning || 'Sincronizado.');
}

async function refresh() {
  if (!connected || saving || refreshing || passwordMode || window.ARISSTO_APP.editing()) return;
  refreshing = true;
  const currentEpoch = epoch;
  try {
    const data = await api('/api/support');
    if (epoch !== currentEpoch || saving) return;
    if (data.user.id !== user.id) {
      lock('La cuenta cambio en otra pestana. Vuelva a ingresar.');
      return;
    }
    user = data.user;
    users = data.users;
    receive(data);
    $('usersTab').hidden = !administrator();
    $('sessionLabel').textContent = (administrator() ? 'Administrador: ' : 'Mi espacio: ') + user.name;
    document.querySelector('[data-tab-target="cooperativesSection"]').hidden = !administrator();
    if (!administrator() && document.querySelector('#usersSection.active, #cooperativesSection.active')) {
      document.querySelector('[data-tab-target="dashboardSection"]').click();
    }
    drawUsers();
    status('Sincronizado a las ' + new Date().toLocaleTimeString('es-SV') + '.');
  } catch (error) { status(error.message || 'Sin conexion. Intente actualizar nuevamente.'); }
  finally { refreshing = false; }
}

function inertForms(value) {
  $('appShell').inert = value;
  document.querySelectorAll('.modal-backdrop').forEach(modal => { modal.inert = value; });
}

async function commit(candidate) {
  if (!connected || saving) return false;
  const currentEpoch = epoch;
  const operations = makeOperations(snapshot, candidate);
  if (!operations.length) return true;
  saving = true;
  inertForms(true);
  status('Guardando...');
  try {
    const data = await api('/api/support', { operations });
    if (epoch !== currentEpoch) return false;
    receive(data);
    status('Cambios guardados y sincronizados.');
    return true;
  } catch (error) {
    if (epoch === currentEpoch) {
      window.ARISSTO_APP.receive(snapshot);
      status(error.message || 'No se guardaron los cambios. Intente nuevamente.');
      document.querySelectorAll('.modal-backdrop[aria-hidden="false"] .alert').forEach(alert => {
        alert.textContent = error.message || 'No se pudo guardar. Intente nuevamente.';
        alert.classList.add('visible');
      });
      if (error.status === 409) {
        const latest = await api('/api/support').catch(() => null);
        if (latest && epoch === currentEpoch) {
          receive(latest);
          window.ARISSTO_APP.clearModals?.();
          status('El registro cambio en otro equipo. Se cargo la version actual; vuelva a abrirlo para editar.');
        }
      }
    }
    return false;
  } finally { saving = false; inertForms(false); }
}

function prepareAssignment(kind, row) {
  if (local || !user) return;
  const select = $(kind + 'Account');
  select.replaceChildren();
  for (const account of users) {
    const option = document.createElement('option'); option.value = account.id; option.textContent = account.name + ' (' + account.username + ')'; select.append(option);
  }
  select.value = row?.ownerId || user.id;
  $(kind + 'AccountLabel').hidden = !administrator();
  const owner = $(kind === 'case' ? 'owner' : 'taskOwner');
  owner.readOnly = !administrator();
  if (!row || !administrator()) owner.value = user.name;
}

function showPassword(mode, token) {
  passwordMode = mode;
  invitationToken = token;
  $('accessScreen').hidden = false;
  $('appShell').hidden = true;
  $('loginForm').hidden = true;
  $('passwordForm').hidden = false;
  $('accessTitle').textContent = mode === 'invite' ? 'Activar mi cuenta' : 'Cambiar usuario y contrasena';
  $('profileUsername').value = user?.username || '';
  $('profileUsername').disabled = mode === 'invite';
  message('Use una contrasena de al menos 3 caracteres.');
  (mode === 'invite' ? $('newPassword') : $('profileUsername')).focus();
}

async function start() {
  if (local) return;
  onAuthChange(event => { if (event === 'logout') lock('Sesion cerrada.'); });
  try {
    const probe = await fetch('/api/support', { cache: 'no-store', signal: AbortSignal.timeout(25000) });
    if (probe.status === 503) throw new Error('El administrador debe completar la activacion del sitio en Netlify.');
    const callback = await handleAuthCallback();
    if (callback?.type === 'invite' || callback?.type === 'recovery') { showPassword(callback.type, callback.token); return; }
    if (await getUser()) { await enter(); return; }
    await getSettings();
    showLogin();
  } catch (error) {
    showLogin(error.message || 'No se pudo conectar con el servicio de acceso.');
  }
}

$('loginForm').addEventListener('submit', async event => {
  event.preventDefault();
  const button = event.submitter;
  button.disabled = true;
  try {
    await login($('loginEmail').value.trim().toLowerCase() + '@arissto.invalid', $('loginPassword').value);
    $('loginPassword').value = '';
    await enter();
  } catch (error) { message(error.status ? errorText(error) : error.message); }
  finally { button.disabled = false; }
});

$('passwordForm').addEventListener('submit', async event => {
  event.preventDefault();
  if ($('newPassword').value !== $('confirmPassword').value) { message('Las contrasenas no coinciden.'); return; }
  if ($('newPassword').value.length < 3) { message('La contrasena debe contener al menos 3 caracteres.'); return; }
  event.submitter.disabled = true;
  try {
    if (passwordMode === 'invite') {
      await acceptInvite(invitationToken, $('newPassword').value);
      passwordMode = null; invitationToken = null;
      $('passwordForm').reset();
      await enter();
      return;
    }
    await api('/api/profile', { username: $('profileUsername').value, password: $('newPassword').value });
    const nextUsername = $('profileUsername').value.trim();
    passwordMode = null; invitationToken = null;
    await logout();
    lock('Credenciales actualizadas. Ingrese con su nuevo usuario y contrasena.');
    $('loginEmail').value = nextUsername;
  } catch (error) { message(errorText(error)); }
  finally { event.submitter.disabled = false; }
});

$('userForm').addEventListener('submit', async event => {
  event.preventDefault();
  event.submitter.disabled = true;
  const currentEpoch = epoch;
  try {
    const editing = Boolean($('editUserId').value);
    await api('/api/users', { id: $('editUserId').value, name: $('userName').value, username: $('userUsername').value,
      password: $('userPassword').value });
    resetUserForm();
    const data = await api('/api/users');
    if (epoch !== currentEpoch) return;
    users = data.users; drawUsers();
    $('usersMessage').textContent = editing ? 'Cuenta actualizada.' : 'Cuenta creada. La persona puede ingresar con su usuario y contrasena.';
  } catch (error) { $('userPassword').value = ''; $('usersMessage').textContent = error.message; }
  finally { event.submitter.disabled = false; }
});

function resetUserForm() {
  $('userForm').reset(); $('editUserId').value = ''; $('userUsername').readOnly = false;
  $('userPassword').required = true; $('userPasswordLabel').textContent = 'Contrasena inicial (minimo 3 caracteres)';
  $('saveUserButton').textContent = 'Crear usuario'; $('cancelUserEdit').hidden = true;
}

$('cancelUserEdit').addEventListener('click', resetUserForm);
$('logoutButton').addEventListener('click', async () => {
  lock('Cerrando sesion...');
  try { await logout(); message('Sesion cerrada.'); }
  catch { message('No se pudo cerrar la sesion del servicio. Revise su conexion antes de dejar este equipo.'); }
});
$('changePassword').addEventListener('click', () => showPassword('change'));
$('refreshCloud').addEventListener('click', refresh);
for (const kind of ['case', 'task']) {
  $(kind + 'Account').addEventListener('change', () => {
    const selected = users.find(account => account.id === $(kind + 'Account').value);
    if (selected) $(kind === 'case' ? 'owner' : 'taskOwner').value = selected.name;
  });
}
window.addEventListener('focus', refresh);
window.addEventListener('online', refresh);
setInterval(() => { if (!document.hidden) refresh(); }, 20000);

window.ARISSTO_CLOUD = { start, commit, prepareAssignment,
  assignedAccount: kind => local || !user ? '' : administrator() ? $(kind + 'Account').value : user.id };
