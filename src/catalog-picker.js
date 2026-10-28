import { catalogKey } from './catalog.mjs';

document.addEventListener('DOMContentLoaded', () => {
  const byId = id => document.getElementById(id);
  const modal = document.createElement('div');
  modal.id = 'catalogPicker'; modal.className = 'modal-backdrop catalog-picker-backdrop'; modal.setAttribute('aria-hidden', 'true');
  modal.innerHTML = `<section class="modal catalog-picker" role="dialog" aria-modal="true" aria-labelledby="catalogPickerTitle">
    <div class="modal-header"><h2 id="catalogPickerTitle"></h2><button type="button" class="icon-button" id="closeCatalogPicker" aria-label="Cerrar buscador">×</button></div>
    <p id="catalogPickerContext"></p>
    <div id="catalogSearchPanel"><label>Buscar por nombre, cargo o telefono<input type="search" id="catalogSearch" autocomplete="off" /></label>
      <div id="catalogResults" class="catalog-results"></div><p id="catalogEmpty" hidden>No se encontraron resultados. Puede crear el registro.</p>
      <button type="button" class="secondary-button" id="catalogNewButton"></button></div>
    <form id="catalogCreateForm" hidden><label><span id="catalogNameLabel">Nombre</span><input id="catalogNewName" maxlength="300" required autocomplete="off" /></label>
      <label id="catalogPositionLabel">Cargo (opcional)<input id="catalogNewPosition" maxlength="300" /></label>
      <label id="catalogPhoneLabel">Telefono (opcional)<input id="catalogNewPhone" type="tel" maxlength="300" /></label>
      <p id="catalogHistoryNote" hidden>Los cambios se aplicaran al catalogo comun y a los casos historicos vinculados con este cliente.</p>
      <div class="modal-actions"><button type="button" class="secondary-button" id="catalogBack">Volver</button><button type="submit" class="primary-button" id="catalogSave">Guardar y seleccionar</button></div>
    </form><p id="catalogPickerMessage" role="status"></p>
  </section>`;
  document.body.append(modal);
  let kind = 'cooperative'; let editing = false; let generation = 0; let returnFocus = null; let editVersion = ''; let editContactId = ''; let cooperativeId = '';
  const app = () => window.ARISSTO_APP;
  const selectedCooperative = () => app().catalog().find(item => item.id === cooperativeId);
  const isOpen = () => modal.getAttribute('aria-hidden') === 'false';
  function close() {
    generation++; modal.classList.remove('open'); modal.setAttribute('aria-hidden', 'true');
    if (returnFocus?.isConnected && byId('caseModal').getAttribute('aria-hidden') === 'false') returnFocus.focus();
  }
  function choose(id) {
    if (kind === 'cooperative') app().selectCooperative(id); else app().selectContact(id);
    close();
  }
  function renderResults() {
    const query = catalogKey(byId('catalogSearch').value);
    const rows = kind === 'cooperative' ? app().catalog() : selectedCooperative()?.contacts || [];
    const matches = rows.filter(row => catalogKey([row.name, row.position, row.phone].join(' ')).includes(query));
    byId('catalogResults').replaceChildren();
    for (const row of matches) {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'catalog-result';
      const name = document.createElement('strong'); name.textContent = row.name; button.append(name);
      const detail = document.createElement('span');
      detail.textContent = kind === 'cooperative' ? `${row.contacts.length} clientes` : [row.position, row.phone].filter(Boolean).join(' · ');
      button.append(detail); button.addEventListener('click', () => choose(row.id)); byId('catalogResults').append(button);
    }
    byId('catalogEmpty').hidden = matches.length > 0;
  }
  function showForm(edit = false) {
    editing = edit; byId('catalogCreateForm').reset(); byId('catalogPickerMessage').textContent = '';
    byId('catalogSearchPanel').hidden = true; byId('catalogCreateForm').hidden = false;
    byId('catalogPositionLabel').hidden = byId('catalogPhoneLabel').hidden = kind === 'cooperative';
    byId('catalogHistoryNote').hidden = !edit;
    byId('catalogNameLabel').textContent = kind === 'cooperative' ? 'Nombre de la cooperativa' : 'Nombre del cliente';
    byId('catalogPickerTitle').textContent = edit ? 'Editar cliente compartido' : kind === 'cooperative' ? 'Crear cooperativa' : 'Crear cliente';
    if (edit) {
      const cooperative = selectedCooperative(); const contact = cooperative?.contacts.find(item => item.id === app().caseSelection().contactId);
      if (!contact) { byId('catalogPickerMessage').textContent = 'Vuelva a buscar y seleccionar el cliente.'; return; }
      editContactId = contact.id; editVersion = cooperative._version;
      byId('catalogNewName').value = contact.name; byId('catalogNewPosition').value = contact.position || ''; byId('catalogNewPhone').value = contact.phone || '';
    } else byId('catalogNewName').value = byId('catalogSearch').value;
    byId('catalogNewName').focus();
  }
  function showSearch() {
    editing = false; byId('catalogSearchPanel').hidden = false; byId('catalogCreateForm').hidden = true;
    byId('catalogPickerTitle').textContent = kind === 'cooperative' ? 'Buscar cooperativa' : 'Buscar cliente de la cooperativa';
    byId('catalogPickerMessage').textContent = ''; renderResults(); byId('catalogSearch').focus();
  }
  function open(nextKind, create, edit = false) {
    kind = nextKind; cooperativeId = app().caseSelection().cooperativeId;
    if (kind === 'contact' && !selectedCooperative()) return;
    returnFocus = document.activeElement; generation++; byId('catalogSave').disabled = false;
    byId('catalogSearch').value = '';
    byId('catalogPickerContext').textContent = kind === 'cooperative' ? 'Catalogo compartido por todas las cuentas.' : 'Cooperativa: ' + selectedCooperative().name;
    byId('catalogNewButton').textContent = kind === 'cooperative' ? 'Crear cooperativa' : 'Crear cliente en esta cooperativa';
    modal.classList.add('open'); modal.setAttribute('aria-hidden', 'false');
    if (create || edit) showForm(edit); else showSearch();
  }
  byId('searchCooperative').addEventListener('click', () => open('cooperative', false));
  byId('createCooperativeFromCase').addEventListener('click', () => open('cooperative', true));
  byId('searchRequester').addEventListener('click', () => open('contact', false));
  byId('createRequesterFromCase').addEventListener('click', () => open('contact', true));
  byId('editRequesterFromCase').addEventListener('click', () => open('contact', false, true));
  byId('closeCatalogPicker').addEventListener('click', close);
  modal.addEventListener('click', event => { if (event.target === modal && byId('catalogCreateForm').hidden) close(); });
  byId('catalogSearch').addEventListener('input', renderResults);
  byId('catalogNewButton').addEventListener('click', () => showForm());
  byId('catalogBack').addEventListener('click', showSearch);
  byId('catalogCreateForm').addEventListener('submit', async event => {
    event.preventDefault();
    const token = generation; const button = byId('catalogSave'); button.disabled = true;
    byId('catalogPickerMessage').textContent = 'Guardando en el catalogo compartido...';
    try {
      const created = await window.ARISSTO_CLOUD.changeCatalog({
        action: editing ? 'catalog-update-contact' : kind === 'cooperative' ? 'catalog-create-cooperative' : 'catalog-create-contact',
        name: byId('catalogNewName').value, cooperativeId,
        phone: byId('catalogNewPhone').value, position: byId('catalogNewPosition').value,
        contactId: editContactId, version: editVersion,
      });
      if (generation !== token || !isOpen()) return;
      if (kind === 'cooperative') choose(created.cooperativeId); else choose(created.contactId);
    } catch (error) { if (generation === token) byId('catalogPickerMessage').textContent = error.message; }
    finally { if (generation === token) button.disabled = false; }
  });
  document.addEventListener('keydown', event => {
    if (!isOpen()) return;
    if (event.key === 'Escape') {
      event.preventDefault(); event.stopImmediatePropagation();
      if (byId('catalogCreateForm').hidden) close();
    }
    if (event.key === 'Tab') {
      const focusable = [...modal.querySelectorAll('button, input')].filter(item => !item.disabled && item.getClientRects().length);
      const first = focusable[0], last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  }, true);
  new MutationObserver(() => { if (byId('caseModal').getAttribute('aria-hidden') === 'true') close(); })
    .observe(byId('caseModal'), { attributes: true, attributeFilter: ['aria-hidden'] });
});

