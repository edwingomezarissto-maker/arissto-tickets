import { linkCategories, webAddress } from './resource-fields.mjs';
import { byId as $, searchable, element, action, externalLink } from './resource-ui.js';
import { registerVault } from './private-vault.js';

export function registerResources(api) {
  const vault = registerVault(api);
  let account = null;
  let active = false;
  let mode = 'team';
  let generation = 0;
  let readIndex = 0;
  let links = [];
  let draft = null;
  let saving = false;
  const message = text => { $('teamLinkMessage').textContent = text; };

  for (const category of linkCategories) {
    for (const id of ['teamLinkFilter', 'teamLinkCategory']) $(id).add(new Option(category, category));
  }

  function closeEditor() {
    draft = null;
    $('teamLinkForm').reset();
    $('teamLinkForm').hidden = true;
    $('teamLinkForm').querySelector('[type=submit]').disabled = false;
  }

  function edit(link) {
    if (saving) return;
    draft = { id: link?.id || crypto.randomUUID(), version: link?.version || null };
    $('teamLinkFormTitle').textContent = link ? 'Editar enlace' : 'Añadir enlace';
    $('teamLinkTitle').value = link?.title || '';
    $('teamLinkUrl').value = link?.url || '';
    $('teamLinkCategory').value = link?.category || linkCategories[0];
    $('teamLinkDescription').value = link?.description || '';
    $('teamLinkForm').hidden = false;
    message(''); $('teamLinkTitle').focus();
  }

  function render() {
    const list = $('teamLinkList');
    list.replaceChildren();
    const term = searchable($('teamLinkSearch').value.trim());
    const category = $('teamLinkFilter').value;
    const matches = links.filter(row => (!category || category === row.category) &&
      searchable([row.title, row.description, row.url, row.author].join(' ')).includes(term));
    matches.sort((a, b) => a.title.localeCompare(b.title, 'es'));
    for (const row of matches) {
      const item = element('li', '', 'resource-card');
      const summary = element('div');
      summary.append(element('h3', row.title), element('p', [row.category, new URL(row.url).hostname, row.author].join(' · '), 'resource-meta'));
      if (row.description) summary.append(element('p', row.description));
      const actions = element('div', '', 'resource-actions');
      actions.append(externalLink(row.url, 'Abrir enlace'), action('Guardar mi acceso', () => switchMode('private', row)));
      if (row.ownerId === account?.id || account?.roles.includes('admin')) {
        actions.append(action('Editar', () => edit(row)), action('Eliminar', () => removeLink(row), 'danger-button'));
      }
      item.append(summary, actions); list.append(item);
    }
    if (!matches.length) list.append(element('li', term || category ? 'No hay enlaces que coincidan con la búsqueda.' : 'Todavía no hay enlaces compartidos.', 'resource-empty'));
  }

  async function loadLinks() {
    const current = generation, index = ++readIndex;
    if (!links.length) message('Cargando enlaces…');
    try {
      const data = await api('/api/links', null, account.id);
      if (current !== generation || index !== readIndex) return;
      links = data.links; render(); message('');
      return true;
    } catch (error) { if (current === generation && index === readIndex) message(error.message); }
  }

  async function changeLink(body) {
    if (saving) return;
    const current = generation;
    saving = true; ++readIndex;
    $('teamLinkForm').querySelector('[type=submit]').disabled = true;
    try {
      const result = await api('/api/links', body, account.id);
      if (current !== generation) return;
      links = links.filter(row => row.id !== body.id);
      if (result.link) links.push(result.link);
      if (draft?.id === body.id) closeEditor();
      render();
      const confirmation = result.link ? 'Enlace guardado para el equipo.' : 'Enlace eliminado.';
      message(confirmation);
      // Include links created by other people while this form was open.
      if (await loadLinks() && current === generation) message(confirmation);
    } catch (error) {
      if (current !== generation) return;
      if (error.status === 409 || error.status === 404) await loadLinks();
      if (current === generation) message(error.status === 409 ? 'El enlace cambió en otro navegador. Pulsa Editar en la lista para abrir su versión actual.' : error.message);
    } finally {
      if (current === generation) { saving = false; $('teamLinkForm').querySelector('[type=submit]').disabled = false; }
    }
  }

  function removeLink(row) {
    if (!saving && confirm('¿Eliminar «' + row.title + '» de los enlaces del equipo?')) {
      void changeLink({ action: 'delete', id: row.id, version: row.version });
    }
  }

  function leave() {
    active = false; ++generation; ++readIndex;
    vault.leave(); closeEditor(); saving = false; links = [];
    $('teamLinkList').replaceChildren(); $('teamLinkSearch').value = ''; $('teamLinkFilter').value = ''; message('');
  }

  function switchMode(next, link) {
    if (!active || !account || saving) return;
    ++generation; mode = next;
    closeEditor(); vault.leave();
    $('teamLinksPanel').hidden = mode !== 'team';
    $('privateVaultPanel').hidden = mode !== 'private';
    $('showTeamLinks').setAttribute('aria-pressed', String(mode === 'team'));
    $('showPrivateVault').setAttribute('aria-pressed', String(mode === 'private'));
    if (mode === 'team') void loadLinks();
    else void vault.enter(account.id, link && { title: link.title, url: link.url });
  }

  function enter() {
    if (active || !account) return;
    active = true; switchMode('team');
  }

  document.addEventListener('arissto:tab', event => {
    if (event.detail === 'resourcesSection') enter();
    else if (active) leave();
  });
  window.addEventListener('pagehide', leave);
  window.addEventListener('pageshow', () => { if ($('resourcesSection').classList.contains('active')) enter(); });
  $('showTeamLinks').addEventListener('click', () => { if (mode !== 'team') switchMode('team'); });
  $('showPrivateVault').addEventListener('click', () => { if (mode !== 'private') switchMode('private'); });
  $('teamLinkSearch').addEventListener('input', render);
  $('teamLinkFilter').addEventListener('change', render);
  $('reloadTeamLinks').addEventListener('click', () => { if (!saving) void loadLinks(); });
  $('newTeamLink').addEventListener('click', () => edit(null));
  $('cancelTeamLink').addEventListener('click', () => { if (!saving) closeEditor(); });
  $('teamLinkForm').addEventListener('submit', event => {
    event.preventDefault();
    if (!draft || !account || saving) return;
    const url = webAddress($('teamLinkUrl').value, true);
    if (!url) { message('Use un enlace http o https sin credenciales ni tokens. Puede guardar un enlace confidencial en Mis accesos privados.'); return; }
    void changeLink({ action: 'save', ...draft, title: $('teamLinkTitle').value, url,
      category: $('teamLinkCategory').value, description: $('teamLinkDescription').value });
  });

  return { leave, setAccount(next) {
    if (!next || account?.id !== next.id) leave();
    const roleChanged = account?.roles.join() !== next?.roles.join();
    account = next;
    $('resourcesTab').hidden = !next;
    if (next && $('resourcesSection').classList.contains('active')) {
      if (active && mode === 'team' && roleChanged) render();
      enter();
    }
  } };
}
