import { activityLate, phaseProgress, derivedPhaseState, localDate } from './implementation-model.mjs';
const $ = id => document.getElementById(id);
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
let data = { implementations: [], cooperatives: [], implementationPeople: [], timeEntries: [] }, user = null, selected = '', busy = false, teamVersion = '';
const current = () => data.implementations.find(row => row.id === selected);
const name = id => data.implementationPeople.find(person => person.id === id)?.name || (id ? 'Usuario sin acceso actual' : 'Sin asignar');
const seconds = entry => (entry.segments || []).reduce((sum, part) => sum + Math.max(0, ((part.endedAt ? Date.parse(part.endedAt) : Date.now()) - Date.parse(part.startedAt)) / 1000), 0);
const hours = value => (value / 3600).toFixed(2) + ' h';
function options(select, rows, label, value, blank) {
  select.replaceChildren(); if (blank) select.add(new Option(blank, ''));
  rows.forEach(row => select.add(new Option(label(row), row.id)));
  if (select.multiple) [...select.options].forEach(option => { option.selected = value?.includes(option.value); });
  else select.value = value || '';
}
const selectedTeam = id => [...$(id).selectedOptions].map(option => option.value);
async function send(body, success) {
  if (busy) return false;
  busy = true; $('implementationMessage').textContent = 'Guardando...';
  try { await window.ARISSTO_CLOUD.implementationAction(body); $('implementationMessage').textContent = success; return true; }
  catch (error) { $('implementationMessage').textContent = error.message; return false; }
  finally { busy = false; }
}
function visibleActivity(row) {
  const filter = $('implementationFilter').value, today = localDate();
  return filter === 'all' || (filter === 'mine' && row.assigneeId === user?.id) || (filter === 'late' && activityLate(row)) ||
    (filter === 'blocked' && row.status === 'Bloqueado') || (filter === 'completed' && row.status === 'Completado') ||
    (filter === 'today' && row.status !== 'Completado' && row.plannedStart <= today && row.plannedEnd >= today);
}
function renderProject() {
  const project = current(); $('implementationDetail').hidden = !project;
  if (!project) { $('implementationPhases').replaceChildren(); return; }
  const ownEntries = data.timeEntries.filter(row => row.projectId === project.projectId);
  const ownTime = ownEntries.reduce((sum, entry) => sum + seconds(entry), 0), allTime = data.timeEntries.reduce((sum, entry) => sum + seconds(entry), 0);
  const end = project.activities.reduce((max, row) => row.plannedEnd > max ? row.plannedEnd : max, project.startDate);
  $('implementationOverview').textContent = `${project.name} · ${project.startDate} a ${end} · Avance: ${phaseProgress(project.activities).toFixed(1)} % · Atrasadas: ${project.activities.filter(row => activityLate(row)).length} · Bloqueadas: ${project.activities.filter(row => row.status === 'Bloqueado').length} · Mi tiempo registrado: ${hours(ownTime)} (${allTime ? (ownTime * 100 / allTime).toFixed(1) : '0.0'} % de mis horas históricas)`;
  const manager = user?.roles?.includes('admin') || project.createdBy === user?.id;
  $('implementationTeamForm').hidden = !manager;
  if (teamVersion !== project._version) {
    $('implementationEditLeader').value = project.leader; $('implementationEditCoopLeader').value = project.cooperativeLeader;
    options($('implementationEditTeam'), data.implementationPeople, row => row.name, project.teamIds); teamVersion = project._version;
  }
  const phases = $('implementationPhases'); phases.replaceChildren();
  project.phases.forEach((phase, index) => {
    const activities = project.activities.filter(row => row.phase === index), shown = activities.filter(visibleActivity);
    const section = document.createElement('section'); section.className = 'implementation-phase';
    const h = document.createElement('h3'); h.textContent = `${index + 1}. ${phase} · ${phaseProgress(activities).toFixed(1)} % · ${derivedPhaseState(activities)}`; section.append(h);
    if (!shown.length) { const p = document.createElement('p'); p.textContent = 'Sin actividades para este filtro.'; section.append(p); }
    else {
      const wrap = document.createElement('div'); wrap.className = 'table-wrap';
      wrap.innerHTML = '<table><thead><tr><th>Actividad</th><th>Responsable</th><th>Planificado</th><th>Real</th><th>Estado</th><th>Avance</th><th>Mi tiempo</th><th>Acciones</th></tr></thead><tbody></tbody></table>';
      for (const activity of shown) {
        const sessions = ownEntries.filter(entry => entry.itemType === 'implementation' && entry.itemId === activity.id);
        const timer = sessions.find(entry => entry.state === 'running') || [...sessions].reverse().find(entry => entry.state === 'paused');
        const tr = document.createElement('tr');
        const status = `${activity.status}${activityLate(activity) ? ' · Atrasada' : ''}${activity.status === 'Bloqueado' ? ` · ${activity.blockedReason} (esperando a ${activity.waitingOn})` : ''}`;
        for (const value of [`${activity.code} ${activity.title}`, name(activity.assigneeId), `${activity.plannedStart} → ${activity.plannedEnd}`, `${activity.actualStart || '—'} → ${activity.actualEnd || '—'}`, status, `${activity.progress} %`, hours(sessions.reduce((sum, entry) => sum + seconds(entry), 0))]) {
          const cell = document.createElement('td'); cell.textContent = value; tr.append(cell);
        }
        const actions = document.createElement('td');
        actions.innerHTML = `<button type="button" class="secondary-button" data-implementation-edit="${esc(activity.id)}">Editar</button>${!['Completado', 'Bloqueado'].includes(activity.status) ? `<button type="button" class="secondary-button" data-implementation-timer="${esc(activity.id)}">${timer?.state === 'running' ? 'Pausar' : timer ? 'Continuar' : 'Iniciar'}</button>` : ''}${timer ? `<button type="button" class="secondary-button" data-implementation-stop="${esc(timer.id)}">Detener</button>` : ''}`;
        if (activity.documentUrl) { const link = document.createElement('a'); link.href = activity.documentUrl; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.textContent = 'Documento / acta'; actions.append(link); }
        tr.append(actions); wrap.querySelector('tbody').append(tr);
      }
      section.append(wrap);
    }
    phases.append(section);
  });
}
function editActivity(activity) {
  if (!$('implementationActivityForm').hidden && !confirm('¿Descartar el formulario de actividad abierto?')) return;
  const project = current(); if (!project) return;
  const row = activity || { id: crypto.randomUUID(), phase: 0, title: '', assigneeId: '', status: 'No iniciado', plannedStart: project.startDate, plannedEnd: project.startDate, weight: 1, actualStart: '', actualEnd: '', progress: 0, blockedReason: '', waitingOn: '', documentUrl: '', notes: '' };
  options($('implementationActivityPhase'), project.phases.map((title, i) => ({ id: String(i), title })), item => item.title, String(row.phase));
  options($('implementationActivityAssignee'), data.implementationPeople.filter(person => project.teamIds.includes(person.id)), item => item.name, row.assigneeId, 'Sin asignar');
  for (const key of ['Id', 'Title', 'Status', 'PlannedStart', 'PlannedEnd', 'Weight', 'ActualStart', 'ActualEnd', 'Progress', 'BlockedReason', 'WaitingOn', 'DocumentUrl', 'Notes']) $('implementationActivity' + key).value = row[key[0].toLowerCase() + key.slice(1)] ?? '';
  $('implementationActivityVersion').value = row._version || '';
  $('implementationActivityHistory').replaceChildren();
  for (const entry of [...(row.history || [])].reverse().slice(0, 8)) { const p = document.createElement('p'); p.textContent = `${new Date(entry.at).toLocaleString('es-SV')} · ${entry.by} · ${entry.status} · ${entry.progress} % · ${entry.notes}`; $('implementationActivityHistory').append(p); }
  $('implementationActivityForm').hidden = false; $('implementationActivityForm').scrollIntoView({ behavior: 'smooth' });
}
async function timerAction(body) {
  if (busy) return; busy = true;
  try { await window.ARISSTO_CLOUD.timerAction(body); $('implementationMessage').textContent = 'Tiempo sincronizado con el proyecto.'; }
  catch (error) { $('implementationMessage').textContent = error.message; }
  finally { busy = false; }
}
$('newImplementation').addEventListener('click', () => { $('implementationForm').hidden = false; options($('implementationCooperative'), data.cooperatives, row => row.name, '', 'Seleccione'); options($('implementationTeam'), data.implementationPeople, row => row.name, [user.id]); $('implementationStart').value ||= localDate(); });
$('cancelImplementation').addEventListener('click', () => { $('implementationForm').hidden = true; });
$('implementationCooperative').addEventListener('change', () => { const cooperative = data.cooperatives.find(row => row.id === $('implementationCooperative').value); $('implementationName').value = cooperative ? `${cooperative.name} – Implementación` : ''; });
$('implementationForm').addEventListener('submit', async event => {
  event.preventDefault(); const id = crypto.randomUUID();
  if (await send({ action: 'implementation-create', id, cooperativeId: $('implementationCooperative').value, name: $('implementationName').value, startDate: $('implementationStart').value, leader: $('implementationLeader').value, cooperativeLeader: $('implementationCoopLeader').value, teamIds: selectedTeam('implementationTeam') }, 'Implementación creada con sus 53 actividades.')) {
    selected = id; $('implementationSelect').value = id; teamVersion = ''; $('implementationForm').reset(); $('implementationForm').hidden = true; renderProject();
  }
});
$('implementationSelect').addEventListener('change', event => {
  if (!$('implementationActivityForm').hidden && !confirm('¿Descartar los cambios del formulario de actividad?')) { event.target.value = selected; return; }
  selected = event.target.value; teamVersion = ''; $('implementationActivityForm').hidden = true; renderProject();
});
$('implementationTeamForm').addEventListener('submit', async event => {
  event.preventDefault(); const project = current();
  await send({ action: 'implementation-update', id: project.id, version: teamVersion, leader: $('implementationEditLeader').value, cooperativeLeader: $('implementationEditCoopLeader').value, teamIds: selectedTeam('implementationEditTeam') }, 'Líderes y equipo actualizados.');
});
$('implementationFilter').addEventListener('change', renderProject);
$('implementationAddActivity').addEventListener('click', () => editActivity());
$('cancelImplementationActivity').addEventListener('click', () => { $('implementationActivityForm').hidden = true; });
$('implementationActivityForm').addEventListener('submit', async event => {
  event.preventDefault(); const project = current(); const activity = {};
  for (const key of ['Id', 'Title', 'Status', 'PlannedStart', 'PlannedEnd', 'Weight', 'ActualStart', 'ActualEnd', 'Progress', 'BlockedReason', 'WaitingOn', 'DocumentUrl', 'Notes']) activity[key[0].toLowerCase() + key.slice(1)] = $('implementationActivity' + key).value;
  activity.phase = Number($('implementationActivityPhase').value); activity.assigneeId = $('implementationActivityAssignee').value; activity.progress = Number(activity.progress); activity.weight = Number(activity.weight);
  if (await send({ action: 'implementation-activity-save', id: project.id, version: $('implementationActivityVersion').value || null, activity }, 'Actividad actualizada.')) $('implementationActivityForm').hidden = true;
});
$('implementationPhases').addEventListener('click', event => {
  const edit = event.target.closest('[data-implementation-edit]'); if (edit) { editActivity(current().activities.find(row => row.id === edit.dataset.implementationEdit)); return; }
  const stop = event.target.closest('[data-implementation-stop]'); if (stop) { timerAction({ action: 'timer-stop', entryId: stop.dataset.implementationStop }); return; }
  const start = event.target.closest('[data-implementation-timer]'); if (!start) return;
  const project = current(), activity = project.activities.find(row => row.id === start.dataset.implementationTimer);
  const entries = data.timeEntries.filter(row => row.itemType === 'implementation' && row.itemId === activity.id);
  const entry = entries.find(row => row.state === 'running') || [...entries].reverse().find(row => row.state === 'paused');
  timerAction(entry ? { action: entry.state === 'running' ? 'timer-pause' : 'timer-resume', entryId: entry.id } : { action: 'timer-start', entryId: crypto.randomUUID(), projectId: project.projectId, itemType: 'implementation', itemId: activity.id, title: activity.title });
});
window.ARISSTO_IMPLEMENTATIONS = { receive(snapshot, actor) {
  data = structuredClone(snapshot); user = actor;
  if (!data.implementations.some(row => row.id === selected)) { selected = data.implementations[0]?.id || ''; teamVersion = ''; $('implementationActivityForm').hidden = true; }
  options($('implementationSelect'), data.implementations, row => row.name, selected, 'Seleccione una implementación'); renderProject();
} };
