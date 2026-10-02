(() => {
  'use strict';

  const byId = id => document.getElementById(id);
  const section = byId('migrationSection');
  const grid = section?.querySelector('.migration-grid');
  if (!grid || byId('exportCooperativesContacts')) return;

  const escapeText = value => String(value ?? '').trim();
  const normalizeKey = value => escapeText(value).toLocaleLowerCase('es-SV');
  const createId = () => crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  const exportCard = document.createElement('article');
  exportCard.className = 'migration-card';
  exportCard.innerHTML = `
    <h3>Exportar cooperativas y clientes</h3>
    <p>Descarga un respaldo JSON con cada cooperativa y sus personas/clientes, teléfono y cargo.</p>
    <div class="migration-actions">
      <button class="primary-button" id="exportCooperativesContacts" type="button">Exportar cooperativas y clientes</button>
    </div>
  `;

  const importCard = document.createElement('article');
  importCard.className = 'migration-card';
  importCard.innerHTML = `
    <h3>Importar cooperativas y clientes</h3>
    <p>Importe un respaldo generado por ARISSTO. Puede combinarlo con el catálogo actual o reemplazarlo completamente.</p>
    <label>
      <span>Archivo JSON</span>
      <input type="file" id="importCooperativesFile" accept="application/json,.json" />
    </label>
    <label>
      <span>Modo de importación</span>
      <select id="importCooperativesMode">
        <option value="merge">Combinar con cooperativas actuales</option>
        <option value="replace">Reemplazar cooperativas actuales</option>
      </select>
    </label>
    <div class="migration-actions">
      <button class="primary-button" id="importCooperativesContacts" type="button">Importar cooperativas y clientes</button>
    </div>
    <p class="migration-note">Al combinar, se conserva la cooperativa existente y solo se agregan personas/clientes que no estén registrados.</p>
  `;

  grid.append(exportCard, importCard);

  function showStatus(text, error = false) {
    const alert = byId('migrationAlert');
    const status = byId('migrationStatus');
    if (alert) {
      alert.textContent = error ? text : '';
      alert.classList.toggle('visible', error);
    }
    if (status) status.textContent = error ? '' : text;
  }

  async function api(path, body) {
    const response = await fetch(path, {
      method: body ? 'POST' : 'GET',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(25000),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'No se pudo completar la operación.');
    return data;
  }

  function sanitizeContact(raw = {}) {
    const name = escapeText(raw.name || raw.persona || raw.client || raw.cliente);
    if (!name) return null;
    return {
      id: escapeText(raw.id) || createId(),
      name: name.slice(0, 300),
      phone: escapeText(raw.phone || raw.telefono).slice(0, 300),
      position: escapeText(raw.position || raw.cargo).slice(0, 300),
    };
  }

  function sanitizeCooperative(raw = {}) {
    const name = escapeText(raw.name || raw.cooperative || raw.cooperativa);
    if (!name) return null;
    const contacts = Array.isArray(raw.contacts || raw.clientes || raw.personas)
      ? (raw.contacts || raw.clientes || raw.personas).map(sanitizeContact).filter(Boolean)
      : [];
    return {
      id: escapeText(raw.id) || createId(),
      name: name.slice(0, 300),
      contacts,
    };
  }

  function downloadJson(payload, filename) {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function contactKey(contact) {
    return [normalizeKey(contact.name), normalizeKey(contact.phone)].join('|');
  }

  function mergeCooperatives(current, imported) {
    const result = structuredClone(current);
    for (const incoming of imported) {
      const existing = result.find(item => normalizeKey(item.name) === normalizeKey(incoming.name));
      if (!existing) {
        result.push({ ...incoming, id: createId(), contacts: incoming.contacts.map(contact => ({ ...contact, id: createId() })) });
        continue;
      }
      const keys = new Set((existing.contacts || []).map(contactKey));
      for (const contact of incoming.contacts || []) {
        const key = contactKey(contact);
        if (keys.has(key)) continue;
        existing.contacts.push({ ...contact, id: createId() });
        keys.add(key);
      }
    }
    return result;
  }

  function buildOperations(before, after) {
    const oldRows = new Map(before.map(row => [row.id, row]));
    const newRows = new Map(after.map(row => [row.id, row]));
    const operations = [];

    for (const [id, row] of newRows) {
      const previous = oldRows.get(id);
      if (!previous || JSON.stringify(previous) !== JSON.stringify(row)) {
        operations.push({
          collection: 'cooperatives',
          id,
          action: 'put',
          version: previous?._version || null,
          record: row,
        });
      }
    }
    for (const [id, row] of oldRows) {
      if (!newRows.has(id)) operations.push({ collection: 'cooperatives', id, action: 'delete', version: row._version });
    }
    return operations;
  }

  byId('exportCooperativesContacts').addEventListener('click', async event => {
    event.currentTarget.disabled = true;
    showStatus('Preparando respaldo de cooperativas y clientes...');
    try {
      const data = await api('/api/support');
      const cooperatives = Array.isArray(data.cooperatives) ? data.cooperatives : [];
      const clientCount = cooperatives.reduce((sum, cooperative) => sum + (cooperative.contacts?.length || 0), 0);
      const date = new Date().toISOString().slice(0, 10);
      downloadJson({
        app: 'ARISSTO Control de Soporte',
        type: 'cooperatives-and-contacts',
        version: 1,
        exportedAt: new Date().toISOString(),
        cooperatives: cooperatives.map(cooperative => ({
          name: cooperative.name,
          contacts: (cooperative.contacts || []).map(contact => ({
            name: contact.name,
            phone: contact.phone || '',
            position: contact.position || '',
          })),
        })),
      }, `arissto-cooperativas-clientes-${date}.json`);
      showStatus(`Respaldo generado: ${cooperatives.length} cooperativas y ${clientCount} clientes/personas.`);
    } catch (error) {
      showStatus(error.message || 'No se pudo exportar la información.', true);
    } finally {
      event.currentTarget.disabled = false;
    }
  });

  byId('importCooperativesContacts').addEventListener('click', async event => {
    const file = byId('importCooperativesFile').files?.[0];
    if (!file) {
      showStatus('Seleccione un archivo JSON de cooperativas y clientes.', true);
      return;
    }

    event.currentTarget.disabled = true;
    try {
      let parsed;
      try { parsed = JSON.parse(await file.text()); }
      catch { throw new Error('El archivo seleccionado no contiene JSON válido.'); }

      const source = Array.isArray(parsed?.cooperatives) ? parsed.cooperatives : [];
      const imported = source.map(sanitizeCooperative).filter(Boolean);
      if (!imported.length) throw new Error('El archivo no contiene cooperativas válidas para importar.');

      const data = await api('/api/support');
      const current = Array.isArray(data.cooperatives) ? data.cooperatives : [];
      const mode = byId('importCooperativesMode').value;
      const incomingClients = imported.reduce((sum, cooperative) => sum + cooperative.contacts.length, 0);

      let next;
      if (mode === 'replace') {
        const accepted = confirm(`Se reemplazarán ${current.length} cooperativas actuales por ${imported.length} cooperativas del archivo (${incomingClients} clientes/personas). ¿Desea continuar?`);
        if (!accepted) return;
        next = imported.map(cooperative => ({ ...cooperative, id: createId(), contacts: cooperative.contacts.map(contact => ({ ...contact, id: createId() })) }));
      } else {
        next = mergeCooperatives(current, imported);
      }

      const operations = buildOperations(current, next);
      if (!operations.length) {
        showStatus('No se encontraron cooperativas o clientes nuevos para importar.');
        return;
      }
      if (operations.length > 1000) throw new Error('La importación supera 1,000 operaciones. Divida el archivo en respaldos más pequeños.');

      await api('/api/support', { operations });
      byId('importCooperativesFile').value = '';
      showStatus(`Importación completada. Catálogo resultante: ${next.length} cooperativas y ${next.reduce((sum, cooperative) => sum + (cooperative.contacts?.length || 0), 0)} clientes/personas.`);
      setTimeout(() => byId('refreshCloud')?.click(), 150);
    } catch (error) {
      showStatus(error.message || 'No se pudo importar la información.', true);
    } finally {
      event.currentTarget.disabled = false;
    }
  });
})();
