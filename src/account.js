import { login, logout, getUser, getSettings, handleAuthCallback,
  acceptInvite, onAuthChange } from '@netlify/identity';
import { makeOperations, emptySnapshot } from './sync.mjs';

const $ = id => document.getElementById(id);
const local = location.protocol === 'file:';
let user = null;
let users = [];
let usersSignature = '';
let snapshot = emptySnapshot();
let snapshotSignature = '';
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
  usersSignature = '';
  snapshot = emptySnapshot();
  snapshotSignature = '';
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
    if (response.status === 401) lock(error.message);
    throw error;
  }
  return data;
}

function dataSignature(data) {
  return JSON.stringify(['cases', 'tasks', 'cooperatives'].map(key => data[key] || []));
}

function receive(data, force = false) {
  const nextSignature = dataSignature(data);
  if (!force && nextSignature === snapshotSignature) return false;
  snapshot = Object.fromEntries(['cases', 'tasks', 'cooperatives'].map(key => [key, structuredClone(data[key] || [])]));
  snapshotSignature = nextSignature;
  window.ARISSTO_APP.receive(snapshot);
  return true;
}

function drawUsers() {
  $('usersBody').replaceChildren();
  usersSignature = JSON.stringify(users);
  if (!administrator()) return;
  for (const account of users) {
    const tr = document.createElement('tr');
    tr.dataset.userId = account.id;
    const access = account.roles.includes('admin') ? 'Administrador' : account.roles.includes('member') ? 'Usuario comun' : 'Sin acceso';
    for (const value of [account.name, account.username, access]) {
      const td = document.createElement('td'); td.textContent = value; tr.append(td);
    }
    const actions = document.createElement('td');
    const edit = document.createElement('button');
    edit.type = 'button'; edit.className = 'secondary-button'; edit.textContent = 'Editar';
    edit.addEventListener('click', () => {
      $('editUserId').value = account.id; $('userName').value = account.name;
      $('userUsername').value = account.username; $('userUsername').readOnly = account.primaryAdmin === true;
      $('userRole').value = account.roles.includes('admin') ? 'admin' : 'member';
      $('userRole').disabled = account.primaryAdmin === true;
      $('userPassword').value = ''; $('userPassword').required = false;
      $('userPasswordLabel').textContent = 'Nueva contrasena (opcional, minimo 3 caracteres)';
      $('saveUserButton').textContent = 'Guardar cambios'; $('cancelUserEdit').hidden = false;
      $('userName').focus();
    });
    actions.append(edit);
    if (account.id !== user.id) {
      const remove = document.createElement('button');
      remove.type = 'button'; remove.className = 'danger-button delete-user-button'; remove.textContent = 'Eliminar';
      remove.addEventListener('click', () => deleteAccount(account, remove));
      actions.append(remove);
    }
    tr.append(actions);
    $('usersBody').append(tr);
  }
}

function updateAccess() {
  $('usersTab').hidden = !administrator();
  document.querySelector('[data-tab-target="cooperativesSection"]').hidden = !administrator();
  $('sessionLabel').textContent = (administrator() ? 'Administrador: ' : 'Mi espacio: ') + user.name;
  if (!administrator() && document.querySelector('#usersSection.active, #cooperativesSection.active')) {
    document.querySelector('[data-tab-target="dashboardSection"]').click();
  }
}

async function reloadAccounts() {
  const currentEpoch = epoch;
  const data = await api('/api/support');
  if (epoch !== currentEpoch || !connected) return;
  user = data.user; users = data.users;
  updateAccess(); drawUsers(); receive(data);
}

async function deleteAccount(account, button) {
  if (!confirm(`¿Eliminar la cuenta ${account.name} (${account.username}) del servidor?\n\nLa persona perdera el acceso. Sus casos y tareas se conservaran y se transferiran a su cuenta administradora.`)) return;
  button.disabled = true;
  const currentEpoch = epoch;
  try {
    const result = await api('/api/users', { action: 'delete', id: account.id });
    if (epoch !== currentEpoch) return;
    if ($('editUserId').value === account.id) resetUserForm();
    users = result.users; drawUsers();
    $('usersMessage').textContent = `Cuenta eliminada del servidor. Registros transferidos: ${result.transferred || 0}.`;
    await reloadAccounts();
  } catch (error) { $('usersMessage').textContent = error.message; }
  finally { button.disabled = false; }
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
  receive(latest, true);
  connected = true;
  updateAccess();
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
    const changed = receive(data);
    updateAccess();
    if (JSON.stringify(users) !== usersSignature) drawUsers();
    status((changed ? 'Datos actualizados' : 'Sin cambios') + ' a las ' + new Date().toLocaleTimeString('es-SV') + '.');
  } catch (error) { status(error.message || 'Sin conexion. Intente actualizar nuevamente.'); }
  finally { refreshing = false; }
}

async function commit(candidate) {
  if (!connected || saving) return false;
  const currentEpoch = epoch;
  const operations = makeOperations(snapshot, candidate);
  if (!operations.length) return true;
  saving = true;
  status('Guardando...');
  try {
    const data = await api('/api/support', { operations });
    if (epoch !== currentEpoch) return false;
    receive(data, true);
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
          receive(latest, true);
          window.ARISSTO_APP.clearModals?.();
          status('El registro cambio en otro equipo. Se cargo la version actual; vuelva a abrirlo para editar.');
        }
      }
    }
    return false;
  } finally { saving = false; }
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
  $('accessTitle').textContent = mode === 'invite' ? 'Activar mi cuenta' : 'Cambiar mi contrasena';
  $('profileUsername').value = user?.username || '';
  $('profileUsername').disabled = mode === 'invite';
  $('profileUsername').readOnly = true;
  $('cancelPasswordChange').hidden = mode === 'invite';
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
  const button = event.submitter;
  button.disabled = true;
  const currentEpoch = epoch;
  try {
    const editing = Boolean($('editUserId').value);
    await api('/api/users', { id: $('editUserId').value, name: $('userName').value, username: $('userUsername').value,
      password: $('userPassword').value, role: $('userRole').value });
    if (epoch !== currentEpoch) return;
    resetUserForm();
    await reloadAccounts();
    $('usersMessage').textContent = editing ? 'Cuenta actualizada.' : 'Cuenta creada. La persona puede ingresar con su usuario y contrasena.';
  } catch (error) {
    $('userPassword').value = ''; $('usersMessage').textContent = error.message;
    if (error.status === 409) await reloadAccounts().catch(() => {});
  }
  finally { button.disabled = false; }
});

function resetUserForm() {
  $('userForm').reset(); $('editUserId').value = ''; $('userUsername').readOnly = false;
  $('userRole').value = 'member'; $('userRole').disabled = false;
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
$('cancelPasswordChange').addEventListener('click', () => {
  passwordMode = null; invitationToken = null; $('passwordForm').reset();
  $('accessScreen').hidden = true; $('appShell').hidden = false;
});
$('refreshUsers').addEventListener('click', async event => {
  const button = event.currentTarget; button.disabled = true;
  try { await reloadAccounts(); $('usersMessage').textContent = 'Usuarios actualizados desde el servidor.'; }
  catch (error) { $('usersMessage').textContent = error.message; }
  finally { button.disabled = false; }
});
$('usersTab').addEventListener('click', () => reloadAccounts().catch(error => { $('usersMessage').textContent = error.message; }));
$('refreshCloud').addEventListener('click', refresh);
for (const kind of ['case', 'task']) {
  $(kind + 'Account').addEventListener('change', () => {
    const selected = users.find(account => account.id === $(kind + 'Account').value);
    if (selected) $(kind === 'case' ? 'owner' : 'taskOwner').value = selected.name;
  });
}
window.addEventListener('online', refresh);
setInterval(() => { if (!document.hidden) refresh(); }, 60000);

window.ARISSTO_CLOUD = { start, commit, prepareAssignment,
  assignedAccount: kind => local || !user ? '' : administrator() ? $(kind + 'Account').value : user.id };
