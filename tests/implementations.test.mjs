import test from 'node:test';
import assert from 'node:assert/strict';
import { changeImplementation } from '../netlify/functions/_shared/implementations.mjs';
import { changeTimer } from '../netlify/functions/_shared/time.mjs';
import { emptyData, visibleData } from '../netlify/functions/_shared/records.mjs';
import { phaseProgress, derivedPhaseState, businessSchedule } from '../src/implementation-model.mjs';
import { makeOperations, emptySnapshot } from '../src/sync.mjs';
const actor = id => ({ id, name: id, roles: ['member'], appMetadata: { permissions: ['implementations'] } });
const one = actor('one'), two = actor('two'), outsider = actor('outsider'), eligible = new Set(['one', 'two', 'outsider']);
const create = () => changeImplementation({ ...emptyData(), cooperatives: [{ id: 'coop', name: 'Cooperativa QA', contacts: [] }] },
  { action: 'implementation-create', id: 'impl', cooperativeId: 'coop', name: 'Implementación QA', startDate: '2026-11-06', leader: 'Líder', cooperativeLeader: '', teamIds: ['two'] }, one, eligible).next;
const save = (data, item, user = two, version = item._version) => changeImplementation(data, { action: 'implementation-activity-save', id: 'impl', version, activity: item }, user, eligible).next;
test('plantilla compartida: seis fases, 53 actividades, fechas laborables y acceso solo al equipo', () => {
  const data = create(), project = data.implementations[0];
  assert.equal(project.phases.length, 6); assert.equal(project.activities.length, 53);
  assert.equal(project.activities[0].plannedStart, '2026-11-06'); assert.equal(project.activities[1].plannedStart, '2026-11-09');
  assert.equal(visibleData(data, two).implementations.length, 1); assert.equal(visibleData(data, outsider).implementations.length, 0);
  assert.equal(visibleData(data, { ...two, appMetadata: { permissions: ['tasks'] } }).implementations.length, 0);
  assert.throws(() => save(data, project.activities[0], outsider), /acceso/);
  assert.equal(data.projects.find(row => row.id === project.projectId).cooperativeId, 'coop');
});
test('avance ponderado y estado derivados; una edición obsoleta no sobreescribe a otro integrante', () => {
  let data = create(); const original = structuredClone(data.implementations[0].activities[0]);
  data = save(data, { ...original, status: 'Completado', actualStart: '2026-11-06', actualEnd: '2026-11-06' });
  const activities = data.implementations[0].activities;
  assert.equal(activities[0].progress, 100); assert.ok(phaseProgress(activities) > 0); assert.equal(derivedPhaseState(activities), 'En proceso');
  assert.equal(phaseProgress([{ weight: 3, progress: 100 }, { weight: 1, progress: 0 }]), 75);
  assert.throws(() => save(data, { ...original, notes: 'Edición vieja' }), /Otra persona/);
  assert.equal(data.implementations[0].activities[0].status, 'Completado');
});
test('bloqueos, fechas y responsables inválidos se rechazan sin modificar los registros', () => {
  const data = create(), activity = data.implementations[0].activities[0];
  assert.throws(() => save(data, { ...activity, status: 'Bloqueado' }), /bloqueo/);
  assert.throws(() => save(data, { ...activity, plannedStart: '2026-02-30' }), /Fecha/);
  assert.throws(() => save(data, { ...activity, assigneeId: 'outsider' }), /responsable/);
  assert.throws(() => save(data, { ...activity, status: 'Completado' }), /fechas reales/);
  assert.equal(data.implementations[0].activities[0].status, 'No iniciado');
});
test('el cronómetro de una actividad pertenece al proyecto y finalizar detiene las sesiones', () => {
  let data = create(), project = data.implementations[0], activity = project.activities[0];
  const start = { action: 'timer-start', entryId: 'session', itemType: 'implementation', projectId: project.projectId, itemId: activity.id, title: activity.title };
  assert.throws(() => changeTimer(data, start, outsider), /acceso/);
  data = changeTimer(data, start, two).next;
  activity = data.implementations[0].activities[0];
  assert.equal(data.timeEntries[0].ownerId, two.id); assert.equal(data.timeEntries[0].projectId, project.projectId);
  assert.equal(activity.status, 'En proceso'); assert.ok(activity.actualStart);
  data = save(data, { ...activity, status: 'Completado', actualEnd: activity.actualStart });
  assert.equal(data.timeEntries[0].state, 'stopped'); assert.ok(data.timeEntries[0].segments[0].endedAt);
  assert.throws(() => changeTimer(data, { ...start, entryId: 'again' }, two), /estado/);
});
test('quitar acceso al equipo impide continuar un cronómetro pausado y cambiar la actividad', () => {
  let data = create(); const project = data.implementations[0], activity = project.activities[0];
  data = changeTimer(data, { action: 'timer-start', entryId: 's', itemType: 'implementation', projectId: project.projectId, itemId: activity.id, title: activity.title }, two).next;
  data = changeTimer(data, { action: 'timer-pause', entryId: 's' }, two).next;
  data = changeImplementation(data, { action: 'implementation-update', id: project.id, version: project._version, leader: '', cooperativeLeader: '', teamIds: [] }, one, eligible).next;
  assert.throws(() => changeTimer(data, { action: 'timer-resume', entryId: 's' }, two), /acceso/);
  assert.equal(visibleData(data, two).implementations.length, 0);
});
test('guardar una tarea conserva colecciones omitidas como servicios; el fin de semana no consume días', () => {
  const before = { ...emptySnapshot(), services: [{ id: 'invoice', _version: '1' }] };
  assert.deepEqual(makeOperations(before, { cases: [], tasks: [], cooperatives: [] }), []);
  assert.deepEqual(businessSchedule('2026-11-07', 2), { plannedStart: '2026-11-09', plannedEnd: '2026-11-10', next: '2026-11-11' });
});
