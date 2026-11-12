import { webAddress } from './resource-fields.mjs';
import { newVaultSalt, openVault, sealVault, vaultKey } from './vault-crypto.mjs';
import { byId as $, searchable, element, action, externalLink } from './resource-ui.js';

const idleLimit = 10 * 60 * 1000;
const entryFields = { title: 'vaultEntryTitle', url: 'vaultEntryUrl', username: 'vaultEntryUsername', password: 'vaultEntryPassword', notes: 'vaultEntryNotes' };

export function registerVault(api) {
  let owner = null, generation = 0;
  let snapshot = null, key = null, entries = [];
  let draft = null, expanded = null, preset = null;
  let busy = false, idleTimer, idleDeadline = 0;
  const message = text => { $('vaultMessage').textContent = text; };
  const request = body => api('/api/vault', body, owner);

  function closeEditor() {
    draft = null;
    $('vaultEntryForm').reset();
    $('vaultEntryForm').hidden = true;
    $('vaultEntryForm').querySelector('[type=submit]').disabled = false;
  }

  function leave() {
    ++generation;
    clearTimeout(idleTimer); idleDeadline = 0;
    owner = null; snapshot = null; key = null; entries = []; preset = null; expanded = null; busy = false;
    closeEditor();
    $('vaultList').replaceChildren(); $('vaultSearch').value = '';
    $('vaultContents').hidden = true; $('vaultGate').reset(); $('vaultGate').hidden = true;
    $('unlockVault').disabled = false; $('retryVault').hidden = true;
    $('vaultHelp').textContent = ''; message('');
  }

  function showGate() {
    const creating = !snapshot.envelope;
    $('vaultHelp').textContent = creating
      ? 'Crea una clave maestra de al menos 12 caracteres, distinta de tu contraseña de ARISSTO. Consérvala en un lugar seguro. Si la pierdes, nadie podrá recuperar estos accesos.'
      : 'Escribe tu clave maestra para abrir los accesos privados de tu cuenta.';
    $('vaultConfirmLabel').hidden = !creating; $('vaultConfirm').required = creating;
    $('vaultPassphrase').minLength = creating ? 12 : 1;
    $('unlockVault').textContent = creating ? 'Crear mi bóveda' : 'Abrir mi bóveda';
    $('vaultGate').hidden = false;
  }

  async function enter(id, prefill) {
    leave(); owner = id; preset = prefill;
    const view = generation;
    if (!window.crypto?.subtle) { message('Abre ARISSTO por HTTPS en un navegador compatible para usar la bóveda.'); return; }
    message('Cargando mi bóveda…');
    try {
      const saved = await request();
      if (view !== generation) return;
      snapshot = saved; showGate(); message('');
    } catch (error) {
      if (view === generation) { message(error.message); $('retryVault').hidden = false; }
    }
  }

  function lock(text) {
    const id = owner, saved = snapshot;
    leave(); owner = id; snapshot = saved;
    if (id && saved) { showGate(); message(text); }
  }

  function touch() {
    if (!key) return;
    if (idleDeadline && Date.now() >= idleDeadline) { lock('La bóveda se bloqueó por inactividad.'); return; }
    clearTimeout(idleTimer);
    idleDeadline = Date.now() + idleLimit;
    idleTimer = setTimeout(() => lock('La bóveda se bloqueó por inactividad.'), idleLimit);
  }

  async function unlock(event) {
    event.preventDefault();
    if (busy || !snapshot || !owner) return;
    const passphrase = $('vaultPassphrase').value;
    if (!snapshot.envelope && (passphrase.trim().length < 12 || passphrase !== $('vaultConfirm').value)) {
      message('Escribe al menos 12 caracteres y confirma la misma clave maestra.'); return;
    }
    const view = generation;
    $('vaultGate').reset(); $('unlockVault').disabled = true; busy = true; message('Abriendo mi bóveda…');
    try {
      const saved = await request();
      if (view !== generation) return;
      if (!saved.envelope && snapshot.envelope) throw new Error('La bóveda cambió. Vuelve a abrir esta sección.');
      snapshot = saved;
      const salt = saved.envelope?.salt || newVaultSalt();
      const derived = await vaultKey(passphrase, salt);
      if (view !== generation) return;
      let rows = [];
      if (saved.envelope) {
        try { rows = await openVault(saved.envelope, derived, owner); }
        catch { throw new Error('No se pudo abrir la bóveda con esa clave maestra.'); }
      } else {
        const envelope = await sealVault([], derived, salt, owner);
        if (view !== generation) return;
        const result = await request({ version: null, envelope });
        if (view !== generation) return;
        snapshot = { version: result.version, envelope };
      }
      if (view !== generation) return;
      key = derived; entries = rows; touch();
      $('vaultHelp').textContent = 'Solo tú puedes leer estos accesos. La bóveda se bloquea al salir de esta sección o tras 10 minutos sin usarla.';
      $('vaultGate').hidden = true; $('vaultContents').hidden = false; message('');
      render();
      busy = false;
      if (preset) { edit(null, preset); preset = null; }
      else $('vaultSearch').focus();
    } catch (error) {
      if (view === generation) { showGate(); message(error.message); $('vaultPassphrase').focus(); }
    } finally {
      if (view === generation) { busy = false; $('unlockVault').disabled = false; }
    }
  }

  function edit(row, initial = {}) {
    if (busy || !key) return;
    expanded = null; render();
    draft = { id: row?.id || crypto.randomUUID(), version: row?.version ?? null };
    for (const [field, id] of Object.entries(entryFields)) $(id).value = (row || initial)[field] || '';
    $('vaultEntryFormTitle').textContent = row ? 'Editar acceso privado' : 'Añadir acceso privado';
    $('vaultEntryForm').hidden = false; message(''); $('vaultEntryTitle').focus();
  }

  function details(row) {
    const block = element('div', '', 'vault-details');
    if (row.url) block.append(externalLink(row.url, 'Abrir sitio'));
    if (row.username) block.append(element('p', 'Usuario: ' + row.username));
    if (row.password) {
      const password = element('span', '••••••••', 'vault-password');
      const toggle = action('Mostrar contraseña', () => {
        const showing = toggle.getAttribute('aria-pressed') !== 'true';
        password.textContent = showing ? row.password : '••••••••';
        toggle.textContent = showing ? 'Ocultar contraseña' : 'Mostrar contraseña';
        toggle.setAttribute('aria-pressed', String(showing));
      });
      toggle.setAttribute('aria-pressed', 'false');
      block.append(password, toggle);
      if (navigator.clipboard?.writeText) block.append(action('Copiar contraseña', async () => {
        const view = generation;
        try { await navigator.clipboard.writeText(row.password); if (view === generation) message('Contraseña copiada al portapapeles.'); }
        catch { if (view === generation) message('El navegador no permitió copiar. Puedes mostrar la contraseña y copiarla manualmente.'); }
      }));
    }
    if (row.notes) block.append(element('p', row.notes, 'vault-notes'));
    return block;
  }

  function render() {
    const list = $('vaultList'); list.replaceChildren();
    const term = searchable($('vaultSearch').value.trim());
    const matches = entries.filter(row => searchable([row.title, row.username, row.url].join(' ')).includes(term));
    matches.sort((a, b) => a.title.localeCompare(b.title, 'es'));
    for (const row of matches) {
      const item = element('li', '', 'resource-card');
      const actions = element('div', '', 'resource-actions');
      const viewing = expanded === row.id;
      const show = action(viewing ? 'Cerrar detalle' : 'Ver acceso', () => { expanded = viewing ? null : row.id; render(); });
      show.setAttribute('aria-expanded', String(viewing));
      actions.append(show, action('Editar', () => edit(row)), action('Eliminar', () => {
        if (!busy && confirm('¿Eliminar «' + row.title + '» de tu bóveda?')) void mutate(row, null);
      }, 'danger-button'));
      item.append(element('h3', row.title), actions);
      if (viewing) item.append(details(row));
      list.append(item);
    }
    if (!matches.length) list.append(element('li', term ? 'No hay accesos que coincidan con la búsqueda.' : 'Aún no has guardado accesos privados.', 'resource-empty'));
  }

  // Re-read before encrypting so edits to different entries on two devices can coexist.
  async function mutate(expected, updated) {
    if (!key || busy) return;
    const view = generation, salt = snapshot.envelope.salt;
    busy = true; $('vaultEntryForm').querySelector('[type=submit]').disabled = true; message('Guardando…');
    try {
      for (let attempt = 0; attempt < 3; attempt++) {
        const saved = await request();
        if (view !== generation) return;
        if (saved.envelope?.salt !== salt) throw new Error('La bóveda cambió. Bloquéala y vuelve a abrirla.');
        const latest = await openVault(saved.envelope, key, owner);
        if (view !== generation) return;
        snapshot = saved; entries = latest;
        const row = latest.find(item => item.id === expected.id);
        if (updated ? row && Object.keys(entryFields).every(field => row[field] === updated[field]) : !row) break;
        if ((row?.version ?? null) !== expected.version) {
          expanded = null; render();
          throw new Error('Este acceso cambió en otro navegador. Cancela la edición y abre su versión actual.');
        }
        const next = latest.filter(item => item.id !== expected.id);
        if (updated) next.push(updated);
        const envelope = await sealVault(next, key, salt, owner);
        if (view !== generation) return;
        try {
          const result = await request({ version: saved.version, envelope });
          if (view !== generation) return;
          snapshot = { envelope, version: result.version }; entries = next; break;
        } catch (error) {
          if (view !== generation) return;
          if (error.status !== 409 || attempt === 2) throw error;
        }
      }
      if (view !== generation) return;
      if (draft?.id === expected.id) closeEditor();
      expanded = null; render(); message(updated ? 'Acceso guardado en tu bóveda.' : 'Acceso privado eliminado.');
    } catch (error) {
      if (view === generation) message(error.message);
    } finally {
      if (view === generation) { busy = false; $('vaultEntryForm').querySelector('[type=submit]').disabled = false; }
    }
  }

  $('vaultGate').addEventListener('submit', unlock);
  $('newVaultEntry').addEventListener('click', () => edit(null));
  $('cancelVaultEntry').addEventListener('click', () => { if (!busy) { closeEditor(); message(''); } });
  $('lockVault').addEventListener('click', () => lock('Bóveda bloqueada.'));
  $('retryVault').addEventListener('click', () => void enter(owner, preset));
  $('vaultSearch').addEventListener('input', () => { expanded = null; render(); });
  $('vaultEntryForm').addEventListener('submit', event => {
    event.preventDefault();
    if (!draft || !key || busy) return;
    const data = Object.fromEntries(Object.entries(entryFields).map(([field, id]) => [field, $(id).value]));
    data.title = data.title.trim(); data.url = data.url.trim();
    if (!data.title || !(data.url || data.username.trim() || data.password || data.notes.trim())) {
      message('Incluye un nombre y al menos un enlace, usuario, contraseña o nota.'); return;
    }
    if (data.url && !(data.url = webAddress(data.url))) { message('Usa un enlace http o https y guarda el usuario y la contraseña en sus campos.'); return; }
    void mutate(draft, { ...data, id: draft.id, version: crypto.randomUUID() });
  });
  for (const event of ['pointerdown', 'keydown', 'input']) $('privateVaultPanel').addEventListener(event, touch, true);
  document.addEventListener('visibilitychange', () => {
    if (!key) return;
    if (document.hidden) { expanded = null; render(); }
    else if (Date.now() >= idleDeadline) lock('La bóveda se bloqueó por inactividad.');
  });
  return { enter, leave };
}
