import { randomUUID } from 'node:crypto';
import { DataError, DEFAULT_PROJECT_ID, defaultProject, isAdmin, canAccess, canReadImplementation, emptyData } from './records.mjs';

const clean = value => typeof value === 'string' ? value.trim() : '';
const key = value => clean(value).normalize('NFKC').toLocaleLowerCase('es-SV');
const canRead = (row, user) => isAdmin(user) || row.ownerId === user.id;

export function ensureProjectData(data) {
  const next = { ...emptyData(), ...structuredClone(data || {}) };
  next.cases ||= []; next.tasks ||= []; next.cooperatives ||= []; next.services ||= []; next.timeEntries ||= []; next.projects ||= [];
  if (!next.projects.some(project => project.id === DEFAULT_PROJECT_ID)) next.projects.unshift(defaultProject());
  return next;
}

export function createProject(data, body, user) {
  const next = ensureProjectData(data);
  const name = clean(body.name);
  if (!name || name.length > 120) throw new DataError('Escriba un nombre de proyecto de hasta 120 caracteres.');
  const cooperativeId = clean(body.cooperativeId);
  if (cooperativeId && !next.cooperatives.some(row => row.id === cooperativeId && !row.deleted)) {
    throw new DataError('Seleccione una cooperativa vigente del catalogo.');
  }
  const existing = next.projects.find(row => !row.archived && row.cooperativeId === cooperativeId && key(row.name) === key(name));
  if (existing) return { next, created: { projectId: existing.id, reused: true } };
  if (next.projects.length >= 500) throw new DataError('Se alcanzo el limite de 500 proyectos.');
  const now = new Date().toISOString();
  const project = { id: randomUUID(), name, cooperativeId, archived: false, createdBy: user.id, createdAt: now, updatedAt: now, _version: randomUUID() };
  next.projects.push(project);
  return { next, created: { projectId: project.id, reused: false } };
}

function closeRunningSegment(entry, now) {
  const segment = entry.segments.at(-1);
  if (segment && !segment.endedAt) segment.endedAt = now;
}

export function changeTimer(data, body, user) {
  const next = ensureProjectData(data);
  const action = body.action;
  const now = new Date().toISOString();
  const entries = next.timeEntries;

  if (action === 'timer-start') {
    const id = clean(body.entryId);
    const projectId = clean(body.projectId);
    const itemType = clean(body.itemType);
    const itemId = clean(body.itemId);
    const title = clean(body.title).slice(0, 300);
    if (!id || id.length > 200 || !title || !['case', 'task', 'project', 'implementation'].includes(itemType)) throw new DataError('No se pudo iniciar el cronometro. Revise el elemento seleccionado.');
    if (itemType !== 'implementation' && !canAccess(user, 'time')) throw new DataError('Su cuenta no tiene acceso a este cronómetro.', 403);
    const existing = entries.find(row => row.id === id);
    if (existing) {
      if (existing.ownerId !== user.id) throw new DataError('No tiene acceso a este cronometro.', 403);
      return { next, timer: existing, pausedPrevious: false };
    }
    const project = next.projects.find(row => row.id === projectId && !row.archived);
    if (!project) throw new DataError('Seleccione un proyecto vigente.');
    if (itemType === 'implementation') {
      const implementation = (next.implementations || []).find(row => row.projectId === projectId && canReadImplementation(row, user) && row.activities.some(activity => activity.id === itemId));
      if (!implementation) throw new DataError('No tiene acceso a esta actividad de implementación.', 403);
      const activity = implementation.activities.find(row => row.id === itemId);
      if (['Completado', 'Bloqueado'].includes(activity.status)) throw new DataError('Cambie el estado de la actividad antes de iniciar el cronómetro.');
      if (!activity.assigneeId && implementation.teamIds.includes(user.id)) activity.assigneeId = user.id;
      activity.status = 'En proceso'; activity.actualStart ||= new Intl.DateTimeFormat('en-CA', { timeZone: 'America/El_Salvador', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(now)); activity.updatedAt = now; activity._version = randomUUID();
    } else if (itemType !== 'project') {
      if (!canAccess(user, itemType === 'case' ? 'cases' : 'tasks')) throw new DataError('Su cuenta no tiene acceso a esa sección.', 403);
      const collection = itemType === 'case' ? next.cases : next.tasks;
      const item = collection.find(row => row.id === itemId && !row.deleted && canRead(row, user));
      if (!item) throw new DataError('No se encontro el caso o tarea seleccionada.', 404);
      if (item.projectId && item.projectId !== projectId) throw new DataError('El elemento pertenece a otro proyecto. Actualicelo antes de iniciar el cronometro.');
    }
    if (entries.filter(row => row.ownerId === user.id).length >= 5000) throw new DataError('Se alcanzo el limite de sesiones de tiempo guardadas.');
    const active = entries.find(row => row.ownerId === user.id && row.state === 'running');
    if (active) { closeRunningSegment(active, now); active.state = 'paused'; active.updatedAt = now; active._version = randomUUID(); }
    const entry = { id, ownerId: user.id, projectId, itemType, itemId, title, state: 'running',
      segments: [{ startedAt: now, endedAt: null }], createdAt: now, updatedAt: now, endedAt: '', _version: randomUUID() };
    entries.push(entry);
    return { next, timer: entry, pausedPrevious: Boolean(active) };
  }

  const id = clean(body.entryId);
  const entry = entries.find(row => row.id === id);
  if (!entry) throw new DataError('No se encontro la sesion de tiempo.', 404);
  if (entry.ownerId !== user.id) throw new DataError('No tiene acceso a este cronometro.', 403);
  let pausedPrevious = false;
  if (action === 'timer-pause') {
    if (entry.state === 'paused') return { next, timer: entry };
    if (entry.state !== 'running') throw new DataError('La sesion ya esta finalizada.');
    closeRunningSegment(entry, now); entry.state = 'paused';
  } else if (action === 'timer-resume') {
    if (entry.itemType === 'implementation') {
      const implementation = (next.implementations || []).find(row => row.projectId === entry.projectId && canReadImplementation(row, user));
      const activity = implementation?.activities.find(row => row.id === entry.itemId);
      if (!activity || ['Completado', 'Bloqueado'].includes(activity.status)) throw new DataError('No se puede continuar esta actividad. Revise el acceso y el estado.', 403);
      activity.status = 'En proceso'; activity._version = randomUUID(); activity.updatedAt = now;
    } else if (!canAccess(user, 'time')) throw new DataError('Su cuenta no tiene acceso a este cronómetro.', 403);
    if (entry.state === 'running') return { next, timer: entry };
    if (entry.state !== 'paused') throw new DataError('Solo se puede continuar una sesion pausada.');
    const active = entries.find(row => row.ownerId === user.id && row.state === 'running');
    if (active && active.id !== entry.id) { closeRunningSegment(active, now); active.state = 'paused'; active.updatedAt = now; active._version = randomUUID(); pausedPrevious = true; }
    entry.segments.push({ startedAt: now, endedAt: null }); entry.state = 'running';
  } else if (action === 'timer-stop') {
    if (entry.state === 'stopped') return { next, timer: entry };
    if (entry.state === 'running') closeRunningSegment(entry, now);
    entry.state = 'stopped'; entry.endedAt = now;
  } else {
    throw new DataError('Accion de cronometro invalida.');
  }
  entry.updatedAt = now; entry._version = randomUUID();
  return { next, timer: entry, pausedPrevious };
}
