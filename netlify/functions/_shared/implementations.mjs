import { randomUUID } from 'node:crypto';
import template from '../../../src/implementation-template.json' with { type: 'json' };
import { businessSchedule, implementationStates } from '../../../src/implementation-model.mjs';
import { DataError, canAccess, canReadImplementation, isAdmin } from './records.mjs';
import { createProject } from './time.mjs';

const text = (value, max = 300) => { if (typeof value !== 'string' || value.length > max) throw new DataError('Revise el texto ingresado.'); return value.trim(); };
const date = value => { if (value === '') return ''; const parsed = new Date(value + 'T12:00:00Z'); if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) throw new DataError('Fecha inválida.'); return value; };
function team(body, actor, eligible) {
  if (!Array.isArray(body.teamIds) || body.teamIds.length > 100 || body.teamIds.some(id => typeof id !== 'string' || !eligible.has(id))) throw new DataError('Seleccione integrantes con acceso a Implementaciones.');
  return [...new Set([...body.teamIds, actor.id])];
}
export function changeImplementation(data, body, user, eligible) {
  if (!canAccess(user, 'implementations')) throw new DataError('Su cuenta no tiene acceso a Implementaciones.', 403);
  let next = structuredClone(data); next.implementations ||= [];
  const now = new Date().toISOString();
  if (body.action === 'implementation-create') {
    const cooperative = next.cooperatives.find(row => row.id === body.cooperativeId && !row.deleted);
    if (!cooperative) throw new DataError('Seleccione una cooperativa del catálogo.');
    const start = date(body.startDate); if (!start) throw new DataError('Indique la fecha de inicio.');
    if (typeof body.id !== 'string' || !body.id || body.id.length > 200) throw new DataError('Proyecto inválido.');
    const existing = next.implementations.find(row => row.id === body.id);
    if (existing) { if (!canReadImplementation(existing, user)) throw new DataError('Sin acceso a ese proyecto.', 403); return { next }; }
    if (next.implementations.length >= 100) throw new DataError('Se alcanzó el límite de implementaciones.');
    const name = text(body.name, 120) || `${cooperative.name} – Implementación`;
    const projectChange = createProject(next, { name, cooperativeId: cooperative.id }, user); next = projectChange.next;
    if (next.implementations.some(row => row.projectId === projectChange.created.projectId)) throw new DataError('Ya existe una implementación para ese proyecto. Cambie el nombre.', 409);
    let cursor = start;
    const activities = template.flatMap((phase, phaseIndex) => phase.activities.map(activity => {
      const schedule = businessSchedule(cursor, activity.weight); cursor = schedule.next;
      return { ...activity, id: randomUUID(), phase: phaseIndex, plannedStart: schedule.plannedStart, plannedEnd: schedule.plannedEnd,
        actualStart: '', actualEnd: '', assigneeId: '', status: 'No iniciado', progress: 0, blockedReason: '', waitingOn: '', notes: '', documentUrl: '', history: [], _version: randomUUID() };
    }));
    next.implementations.push({ id: body.id, projectId: projectChange.created.projectId, name, cooperativeId: cooperative.id, startDate: start,
      leader: text(body.leader), cooperativeLeader: text(body.cooperativeLeader), teamIds: team(body, user, eligible), phases: template.map(row => row.name),
      activities, createdBy: user.id, createdAt: now, updatedAt: now, _version: randomUUID() });
    return { next };
  }
  const implementation = next.implementations.find(row => row.id === body.id);
  if (!implementation || !canReadImplementation(implementation, user)) throw new DataError('No tiene acceso a esta implementación.', 403);
  if (body.action === 'implementation-update') {
    if (!isAdmin(user) && implementation.createdBy !== user.id) throw new DataError('Solo el creador o un administrador puede cambiar el equipo.', 403);
    if (body.version !== implementation._version) throw new DataError('Los datos del proyecto cambiaron. Actualice antes de guardar.', 409);
    Object.assign(implementation, { leader: text(body.leader), cooperativeLeader: text(body.cooperativeLeader), teamIds: team(body, user, eligible), updatedAt: now, _version: randomUUID() });
  } else if (body.action === 'implementation-activity-save') {
    const raw = body.activity;
    if (!raw || typeof raw.id !== 'string' || !raw.id || raw.id.length > 200) throw new DataError('Actividad inválida.');
    const previous = implementation.activities.find(row => row.id === raw.id);
    if (previous ? body.version !== previous._version : Boolean(body.version)) throw new DataError('Otra persona cambió la actividad. Actualice y revise sus cambios antes de guardar.', 409);
    if (!previous && implementation.activities.length >= 500) throw new DataError('Límite de actividades alcanzado.');
    if (!Number.isInteger(raw.phase) || !implementation.phases[raw.phase]) throw new DataError('Seleccione una fase.');
    if (!implementationStates.includes(raw.status)) throw new DataError('Estado inválido.');
    if (!Number.isFinite(raw.progress) || raw.progress < 0 || raw.progress > 100 || !Number.isFinite(raw.weight) || raw.weight <= 0 || raw.weight > 1000) throw new DataError('Revise el avance y el peso planificado.');
    if (raw.assigneeId && (!implementation.teamIds.includes(raw.assigneeId) || !eligible.has(raw.assigneeId))) throw new DataError('Seleccione un responsable del equipo autorizado.');
    const activity = { id: raw.id, phase: raw.phase, title: text(raw.title, 500), code: previous?.code || `${raw.phase + 1}.extra-${implementation.activities.length + 1}`,
      assigneeId: text(raw.assigneeId), status: raw.status, progress: raw.status === 'Completado' ? 100 : raw.status === 'No iniciado' ? 0 : raw.progress,
      weight: raw.weight, plannedStart: date(raw.plannedStart), plannedEnd: date(raw.plannedEnd), actualStart: date(raw.actualStart), actualEnd: date(raw.actualEnd),
      blockedReason: text(raw.blockedReason, 1000), waitingOn: text(raw.waitingOn), notes: text(raw.notes, 5000), documentUrl: text(raw.documentUrl, 2000) };
    if (!activity.title || !activity.plannedStart || !activity.plannedEnd || activity.plannedEnd < activity.plannedStart || activity.plannedStart < implementation.startDate) throw new DataError('Revise título y fechas planificadas del proyecto.');
    if (activity.actualEnd && (!activity.actualStart || activity.actualEnd < activity.actualStart)) throw new DataError('Revise las fechas reales.');
    if (activity.status === 'Completado' && (!activity.actualStart || !activity.actualEnd)) throw new DataError('Complete las fechas reales al finalizar la actividad.');
    if (activity.status === 'Bloqueado' && (!activity.blockedReason || !activity.waitingOn)) throw new DataError('Indique el bloqueo y quién debe responder.');
    if (activity.status !== 'Completado' && activity.progress === 100) throw new DataError('Use Completado para un avance del 100 %.');
    if (activity.documentUrl) { try { if (!['https:', 'http:'].includes(new URL(activity.documentUrl).protocol)) throw 0; } catch { throw new DataError('Ingrese un enlace válido al documento.'); } }
    activity.history = [...(previous?.history || []), { at: now, by: user.name || user.userMetadata?.full_name || 'Usuario', status: activity.status, progress: activity.progress, notes: activity.notes }].slice(-30);
    activity._version = randomUUID(); activity.updatedAt = now;
    if (previous) implementation.activities[implementation.activities.indexOf(previous)] = activity; else implementation.activities.push(activity);
    if (['Completado', 'Bloqueado', 'En pausa'].includes(activity.status)) {
      for (const entry of next.timeEntries || []) {
        if (entry.itemType !== 'implementation' || entry.itemId !== activity.id || entry.state === 'stopped') continue;
        const segment = entry.segments.at(-1); if (segment && !segment.endedAt) segment.endedAt = now;
        entry.state = activity.status === 'Completado' ? 'stopped' : 'paused';
        if (entry.state === 'stopped') entry.endedAt = now;
        entry.updatedAt = now; entry._version = randomUUID();
      }
    }
    implementation.updatedAt = now;
  } else throw new DataError('Acción de implementación inválida.');
  return { next };
}
