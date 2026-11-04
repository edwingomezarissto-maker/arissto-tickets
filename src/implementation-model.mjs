export const implementationStates = ['No iniciado', 'En proceso', 'En pausa', 'Bloqueado', 'Completado'];
export const localDate = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
export function phaseProgress(activities) {
  const weight = activities.reduce((sum, row) => sum + row.weight, 0);
  return weight ? activities.reduce((sum, row) => sum + row.weight * row.progress, 0) / weight : 0;
}
export function activityLate(row, today = localDate()) { return row.status !== 'Completado' && Boolean(row.plannedEnd) && row.plannedEnd < today; }
export function derivedPhaseState(rows) {
  if (rows.length && rows.every(row => row.status === 'Completado')) return 'Completado';
  if (rows.some(row => row.status === 'Bloqueado')) return 'Bloqueado';
  if (rows.some(row => row.progress > 0 || row.status !== 'No iniciado')) return 'En proceso';
  return 'No iniciado';
}
export function businessSchedule(start, duration) {
  const date = new Date(start + 'T12:00:00');
  while ([0, 6].includes(date.getDay())) date.setDate(date.getDate() + 1);
  const plannedStart = localDate(date);
  for (let n = 1; n < duration; n++) { do { date.setDate(date.getDate() + 1); } while ([0, 6].includes(date.getDay())); }
  const plannedEnd = localDate(date);
  do { date.setDate(date.getDate() + 1); } while ([0, 6].includes(date.getDay()));
  return { plannedStart, plannedEnd, next: localDate(date) };
}
