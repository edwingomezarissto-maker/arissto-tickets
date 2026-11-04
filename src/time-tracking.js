(() => {
  const byId = id => document.getElementById(id);
  let projects = [];
  let entries = [];
  let cooperatives = [];
  let working = false;

  const dateKey = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const monday = date => { const result = new Date(date.getFullYear(), date.getMonth(), date.getDate()); result.setDate(result.getDate() - ((result.getDay() + 6) % 7)); return result; };
  const project = id => projects.find(row => row.id === id);
  const cooperativeName = id => cooperatives.find(row => row.id === id)?.name || '—';
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

  function seconds(entry, startLimit = -Infinity, endLimit = Infinity) {
    const now = Date.now();
    return (entry.segments || []).reduce((sum, segment) => {
      const start = Date.parse(segment.startedAt);
      const end = segment.endedAt ? Date.parse(segment.endedAt) : now;
      if (!Number.isFinite(start) || !Number.isFinite(end)) return sum;
      const overlap = Math.max(0, Math.min(end, endLimit) - Math.max(start, startLimit));
      return sum + overlap / 1000;
    }, 0);
  }

  const formatDuration = value => {
    const total = Math.max(0, Math.floor(value));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor(total % 3600 / 60);
    const secs = total % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  function fillSelect(select, rows, label, selected = '') {
    if (!select) return;
    const keep = selected || select.value;
    const options = rows.map(row => `<option value="${escapeHtml(row.id)}">${escapeHtml(label(row))}</option>`).join('');
    select.innerHTML = options;
    select.value = rows.some(row => row.id === keep) ? keep : (rows[0]?.id || '');
  }

  function fillControls() {
    const activeProjects = projects.filter(row => !row.archived);
    const selectedCase = byId('caseProjectId')?.value;
    const selectedTask = byId('taskProjectId')?.value;
    const namedProject = row => row.name;
    fillSelect(byId('caseProjectId'), activeProjects, namedProject, selectedCase);
    fillSelect(byId('taskProjectId'), activeProjects, namedProject, selectedTask);
    const cooperativeSelect = byId('newProjectCooperative');
    if (cooperativeSelect) {
      const keep = cooperativeSelect.value;
      cooperativeSelect.innerHTML = '<option value="">Sin cooperativa asociada</option>' + cooperatives.map(row => `<option value="${escapeHtml(row.id)}">${escapeHtml(row.name)}</option>`).join('');
      cooperativeSelect.value = cooperatives.some(row => row.id === keep) ? keep : '';
    }
  }

  function rangeBounds() {
    const from = byId('timeRangeStart')?.value;
    const to = byId('timeRangeEnd')?.value;
    if (!from || !to || from > to) return null;
    const start = new Date(`${from}T00:00:00`).getTime();
    const end = new Date(`${to}T00:00:00`).getTime() + 86400000;
    return { start, end };
  }

  function renderReport() {
    const bounds = rangeBounds();
    const totals = new Map(projects.map(row => [row.id, 0]));
    if (bounds) for (const entry of entries) {
      totals.set(entry.projectId, (totals.get(entry.projectId) || 0) + seconds(entry, bounds.start, bounds.end));
    }
    const grandTotal = [...totals.values()].reduce((sum, item) => sum + item, 0);
    const body = byId('projectTotalsBody');
    const empty = byId('timeEmptyState');
    if (!body) return;
    body.replaceChildren();
    empty.hidden = grandTotal > 0;
    empty.classList.toggle('visible', grandTotal === 0);
    for (const item of projects) {
      const total = totals.get(item.id) || 0;
      if (!total && grandTotal > 0) continue;
      const tr = document.createElement('tr');
      const name = document.createElement('td'); name.textContent = item.name;
      const duration = document.createElement('td'); duration.textContent = formatDuration(total);
      const percent = document.createElement('td'); percent.textContent = grandTotal ? `${(total * 100 / grandTotal).toFixed(1)}%` : '0.0%';
      const action = document.createElement('td');
      const start = document.createElement('button'); start.type = 'button'; start.className = 'secondary-button'; start.dataset.projectStart = item.id; start.textContent = 'Iniciar proyecto';
      action.append(start); tr.append(name, duration, percent, action); body.append(tr);
    }

    const projectBody = byId('projectsBody'); projectBody.replaceChildren();
    for (const item of projects.filter(row => !row.archived)) {
      const tr = document.createElement('tr');
      const name = document.createElement('td'); name.textContent = item.name;
      const coop = document.createElement('td'); coop.textContent = cooperativeName(item.cooperativeId);
      const total = document.createElement('td'); total.textContent = formatDuration(totals.get(item.id) || 0);
      const action = document.createElement('td');
      const start = document.createElement('button'); start.type = 'button'; start.className = 'secondary-button'; start.dataset.projectStart = item.id; start.textContent = 'Iniciar proyecto';
      action.append(start); tr.append(name, coop, total, action); projectBody.append(tr);
    }

    const entriesBody = byId('timeEntriesBody'); entriesBody.replaceChildren();
    if (bounds) {
      const inRange = entries.filter(entry => seconds(entry, bounds.start, bounds.end) > 0)
        .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
      for (const entry of inRange) {
        const tr = document.createElement('tr');
        const title = document.createElement('td'); title.textContent = entry.title;
        const projectCell = document.createElement('td'); projectCell.textContent = project(entry.projectId)?.name || 'Proyecto eliminado';
        const started = document.createElement('td'); started.textContent = new Date(entry.createdAt).toLocaleString('es-SV');
        const duration = document.createElement('td'); duration.textContent = formatDuration(seconds(entry, bounds.start, bounds.end));
        const state = document.createElement('td'); state.textContent = entry.state === 'running' ? 'En curso' : entry.state === 'paused' ? 'Pausada' : 'Finalizada';
        const actions = document.createElement('td');
        if (entry.state === 'paused') {
          const resume = document.createElement('button'); resume.type = 'button'; resume.className = 'text-button'; resume.dataset.timeResume = entry.id; resume.textContent = 'Continuar'; actions.append(resume);
          const stop = document.createElement('button'); stop.type = 'button'; stop.className = 'text-button'; stop.dataset.timeStop = entry.id; stop.textContent = 'Detener'; actions.append(stop);
        }
        tr.append(title, projectCell, started, duration, state, actions); entriesBody.append(tr);
      }
    }
    drawTimer();
  }

  function drawTimer() {
    const active = entries.find(entry => entry.state === 'running');
    const banner = byId('timerBanner');
    if (!banner) return;
    banner.hidden = !active;
    if (!active) return;
    byId('timerTitle').textContent = active.title;
    byId('timerProject').textContent = project(active.projectId)?.name || '';
    byId('timerClock').textContent = formatDuration(seconds(active));
    byId('pauseTimer').disabled = working;
    byId('stopTimer').disabled = working;
  }

  async function send(body, messageText) {
    if (working) return;
    if (!window.ARISSTO_CLOUD) { byId('projectMessage').textContent = 'Inicie sesión desde el sitio para guardar tiempo compartido.'; return; }
    working = true; drawTimer();
    try {
      const result = body.action === 'project-create'
        ? await window.ARISSTO_CLOUD.projectAction(body)
        : await window.ARISSTO_CLOUD.timerAction(body);
      if (messageText) byId('projectMessage').textContent = result.created?.reused ? 'Ese proyecto ya existe y puedes elegirlo en la lista.' : messageText;
      if (result.pausedPrevious) byId('projectMessage').textContent = 'Pausé el cronómetro anterior y empecé el nuevo.';
      return result;
    } catch (error) {
      byId('projectMessage').textContent = error.message || 'No se pudo guardar la sesión de tiempo. Intente nuevamente.';
      return null;
    } finally { working = false; drawTimer(); }
  }

  function startFor(type, id, projectId, title) {
    send({ action: 'timer-start', entryId: crypto.randomUUID(), itemType: type, itemId: id || '', projectId,
      title: title || 'Trabajo del proyecto' }, 'Cronómetro iniciado.');
  }

  function setWeek() {
    const today = new Date();
    byId('timeRangeStart').value = dateKey(monday(today));
    byId('timeRangeEnd').value = dateKey(today);
    renderReport();
  }
  function setMonth() {
    const today = new Date();
    byId('timeRangeStart').value = dateKey(new Date(today.getFullYear(), today.getMonth(), 1));
    byId('timeRangeEnd').value = dateKey(today);
    renderReport();
  }

  function bind() {
    setWeek();
    byId('timeRangeStart').addEventListener('change', renderReport);
    byId('timeRangeEnd').addEventListener('change', renderReport);
    byId('timeThisWeek').addEventListener('click', setWeek);
    byId('timeThisMonth').addEventListener('click', setMonth);
    byId('newProjectCooperative').addEventListener('change', event => {
      const input = byId('newProjectName');
      const cooperative = cooperatives.find(row => row.id === event.target.value);
      if (!input.value.trim() && cooperative) input.value = `Proyecto ${cooperative.name}`;
    });
    byId('projectForm').addEventListener('submit', async event => {
      event.preventDefault();
      const name = byId('newProjectName').value.trim();
      if (!name) return;
      const button = event.submitter; button.disabled = true;
      const result = await send({ action: 'project-create', name, cooperativeId: byId('newProjectCooperative').value }, 'Proyecto creado para todos los usuarios.');
      if (result) byId('newProjectName').value = '';
      button.disabled = false;
    });
    byId('casesTableBody').addEventListener('click', event => {
      const button = event.target.closest('[data-time-start="case"]'); if (!button) return;
      const item = window.ARISSTO_APP.timeItem('case', button.dataset.id); if (!item) return;
      startFor('case', item.id, item.projectId || 'project-arissto-financiero', item.title);
    });
    byId('tasksTableBody').addEventListener('click', event => {
      const button = event.target.closest('[data-time-start="task"]'); if (!button) return;
      const item = window.ARISSTO_APP.timeItem('task', button.dataset.id); if (!item) return;
      startFor('task', item.id, item.projectId || 'project-arissto-financiero', item.title);
    });
    document.addEventListener('click', event => {
      const resume = event.target.closest('[data-time-resume]');
      if (resume) { send({ action: 'timer-resume', entryId: resume.dataset.timeResume }); return; }
      const stop = event.target.closest('[data-time-stop]');
      if (stop) { send({ action: 'timer-stop', entryId: stop.dataset.timeStop }); return; }
      const button = event.target.closest('[data-project-start]'); if (!button) return;
      const item = project(button.dataset.projectStart); if (item) startFor('project', '', item.id, item.name);
    });
    byId('pauseTimer').addEventListener('click', () => {
      const active = entries.find(entry => entry.state === 'running'); if (active) send({ action: 'timer-pause', entryId: active.id });
    });
    byId('stopTimer').addEventListener('click', () => {
      const active = entries.find(entry => entry.state === 'running'); if (active) send({ action: 'timer-stop', entryId: active.id });
    });
    setInterval(() => { drawTimer(); if (byId('timeProjectsSection').classList.contains('active')) renderReport(); }, 1000);
  }

  window.ARISSTO_TIME = {
    projectName: id => project(id)?.name || 'Arissto Financiero',
    hasProject: id => projects.some(row => row.id === id && !row.archived),
    receive(data) {
      projects = Array.isArray(data.projects) && data.projects.length ? structuredClone(data.projects) : [{ id: 'project-arissto-financiero', name: 'Arissto Financiero', cooperativeId: '' }];
      entries = structuredClone(data.timeEntries || []);
      cooperatives = structuredClone(data.cooperatives || []);
      fillControls(); renderReport();
    },
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind, { once: true });
  else bind();
})();
