const enhancementCharts = {};
let enhancementData = { cases: [], tasks: [] };
let enhancementUser = null;

function destroyEnhancementCharts() {
  Object.values(enhancementCharts).forEach(chart => chart?.destroy?.());
  Object.keys(enhancementCharts).forEach(key => delete enhancementCharts[key]);
}

function esc(value) {
  return String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
}

function currentMonthFilter() {
  return document.getElementById('dashboardMonthFilter')?.value || '';
}

function monthKeyFromDate(value) {
  if (!value) return '';
  const raw = String(value);
  if (/^\d{4}-\d{2}/.test(raw)) return raw.slice(0, 7);
  const parsed = new Date(raw);
  if (!Number.isFinite(parsed.getTime())) return '';
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}`;
}

function filteredEnhancementData() {
  const month = currentMonthFilter();
  if (!month) return enhancementData;
  return {
    cases: enhancementData.cases.filter(row => monthKeyFromDate(row.requestDate || row.createdAt) === month),
    tasks: enhancementData.tasks.filter(row => monthKeyFromDate(row.createdAt) === month),
  };
}

function grouped(rows, getter) {
  const map = new Map();
  for (const row of rows) {
    const label = getter(row) || 'Sin dato';
    map.set(label, (map.get(label) || 0) + 1);
  }
  return [...map.entries()].map(([label, value]) => ({ label, value }));
}

function monthlySeries(rows, getter) {
  const map = new Map();
  for (const row of rows) {
    const key = monthKeyFromDate(getter(row));
    if (key) map.set(key, (map.get(key) || 0) + 1);
  }
  return map;
}

function sortedMonthLabels(...maps) {
  return [...new Set(maps.flatMap(map => [...map.keys()]))].sort();
}

function monthLabel(key) {
  const [year, month] = key.split('-').map(Number);
  return new Intl.DateTimeFormat('es-SV', { month: 'short', year: '2-digit' }).format(new Date(year, month - 1, 1));
}

function chartTextColor() {
  return getComputedStyle(document.documentElement).getPropertyValue('--gray-700').trim() || '#4d5a6c';
}

function chartGridColor() {
  return getComputedStyle(document.documentElement).getPropertyValue('--gray-200').trim() || '#e8edf3';
}

function makeChart(key, canvasId, config) {
  const canvas = document.getElementById(canvasId);
  if (!canvas || !window.Chart) return;
  enhancementCharts[key]?.destroy?.();
  enhancementCharts[key] = new window.Chart(canvas, config);
}

function baseChartOptions(extra = {}) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { labels: { color: chartTextColor(), boxWidth: 12, padding: 12 } },
      tooltip: { backgroundColor: '#162033', titleColor: '#fff', bodyColor: '#fff' },
      ...(extra.plugins || {}),
    },
    ...extra,
  };
}

function cartesianScales() {
  return {
    x: { beginAtZero: true, ticks: { color: chartTextColor(), precision: 0 }, grid: { color: chartGridColor() } },
    y: { beginAtZero: true, ticks: { color: chartTextColor(), precision: 0 }, grid: { color: chartGridColor() } },
  };
}

function injectEnhancementStyles() {
  if (document.getElementById('arisstoEnhancementStyles')) return;
  const style = document.createElement('style');
  style.id = 'arisstoEnhancementStyles';
  style.textContent = `
    .extended-dashboard{margin-top:24px;display:grid;gap:18px}.extended-dashboard-toolbar{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.extended-dashboard-toolbar button{border:1px solid var(--gray-200,#dfe6ef);background:var(--white,#fff);color:var(--gray-700,#334155);padding:9px 14px;border-radius:10px;font-weight:700;cursor:pointer}.extended-dashboard-toolbar button.active{background:#1d5d9f;color:#fff;border-color:#1d5d9f}.extended-dashboard-panel{display:none}.extended-dashboard-panel.active{display:grid;gap:16px}.extended-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.extended-kpi{background:var(--white,#fff);border:1px solid var(--gray-200,#e8edf3);border-radius:14px;padding:16px;box-shadow:0 4px 14px rgba(15,23,42,.04)}.extended-kpi span{display:block;font-size:.85rem;color:var(--gray-700,#4d5a6c)}.extended-kpi strong{display:block;font-size:1.9rem;margin-top:5px;color:var(--gray-900,#0f2742)}.extended-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.extended-chart{background:var(--white,#fff);border:1px solid var(--gray-200,#e8edf3);border-radius:14px;padding:16px;min-height:330px}.extended-chart h3{margin:0 0 12px;font-size:1rem}.extended-canvas{height:260px}.delete-user-button{margin-left:8px}.extended-note{margin:0;color:var(--gray-700,#4d5a6c);font-size:.9rem}@media(max-width:900px){.extended-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}.extended-grid{grid-template-columns:1fr}}@media(max-width:560px){.extended-kpis{grid-template-columns:1fr}}
  `;
  document.head.append(style);
}

function ensureDashboardShell() {
  const host = document.getElementById('graphicDashboardSection');
  if (!host) return null;
  let shell = document.getElementById('extendedDashboard');
  if (shell) return shell;
  shell = document.createElement('section');
  shell.id = 'extendedDashboard';
  shell.className = 'extended-dashboard';
  shell.innerHTML = `
    <div class="extended-dashboard-toolbar" role="tablist" aria-label="Vistas adicionales del dashboard">
      <button type="button" data-dashboard-mode="tasks">Tareas</button>
      <button type="button" data-dashboard-mode="activities">Actividades</button>
      <button type="button" data-dashboard-mode="combined" class="active">Ambas</button>
    </div>
    <p class="extended-note">Las actividades corresponden a los casos de soporte registrados. Las tareas se analizan con los campos disponibles en el sistema.</p>
    <div class="extended-dashboard-panel" data-dashboard-panel="tasks"></div>
    <div class="extended-dashboard-panel" data-dashboard-panel="activities"></div>
    <div class="extended-dashboard-panel active" data-dashboard-panel="combined"></div>
  `;
  host.append(shell);
  shell.querySelectorAll('[data-dashboard-mode]').forEach(button => {
    button.addEventListener('click', () => {
      shell.querySelectorAll('[data-dashboard-mode]').forEach(item => item.classList.toggle('active', item === button));
      shell.querySelectorAll('[data-dashboard-panel]').forEach(panel => panel.classList.toggle('active', panel.dataset.dashboardPanel === button.dataset.dashboardMode));
      renderExtendedDashboardCharts();
    });
  });
  return shell;
}

function renderExtendedDashboard() {
  injectEnhancementStyles();
  const shell = ensureDashboardShell();
  if (!shell) return;
  destroyEnhancementCharts();
  const { cases, tasks } = filteredEnhancementData();
  const taskWithProgress = tasks.filter(task => String(task.progress || '').trim()).length;
  const taskWithoutProgress = tasks.length - taskWithProgress;
  const taskOwners = new Set(tasks.map(task => task.owner).filter(Boolean)).size;
  const activeCases = cases.filter(row => row.status !== 'Finalizado').length;
  const finishedCases = cases.filter(row => row.status === 'Finalizado').length;
  const today = new Date().toISOString().slice(0, 10);
  const overdueCases = cases.filter(row => row.status !== 'Finalizado' && row.commitmentDate && row.commitmentDate < today).length;
  const pendingCombined = taskWithoutProgress + activeCases;

  const taskPanel = shell.querySelector('[data-dashboard-panel="tasks"]');
  const activityPanel = shell.querySelector('[data-dashboard-panel="activities"]');
  const combinedPanel = shell.querySelector('[data-dashboard-panel="combined"]');

  taskPanel.innerHTML = `
    <div class="extended-kpis">
      <article class="extended-kpi"><span>Tareas totales</span><strong>${tasks.length}</strong></article>
      <article class="extended-kpi"><span>Con avance registrado</span><strong>${taskWithProgress}</strong></article>
      <article class="extended-kpi"><span>Sin avance registrado</span><strong>${taskWithoutProgress}</strong></article>
      <article class="extended-kpi"><span>Responsables</span><strong>${taskOwners}</strong></article>
    </div>
    <div class="extended-grid">
      <article class="extended-chart"><h3>Tareas por encargado</h3><div class="extended-canvas"><canvas id="extTasksOwnerChart"></canvas></div></article>
      <article class="extended-chart"><h3>Evolución mensual de tareas</h3><div class="extended-canvas"><canvas id="extTasksMonthChart"></canvas></div></article>
    </div>`;

  activityPanel.innerHTML = `
    <div class="extended-kpis">
      <article class="extended-kpi"><span>Actividades totales</span><strong>${cases.length}</strong></article>
      <article class="extended-kpi"><span>Activas</span><strong>${activeCases}</strong></article>
      <article class="extended-kpi"><span>Finalizadas</span><strong>${finishedCases}</strong></article>
      <article class="extended-kpi"><span>Vencidas</span><strong>${overdueCases}</strong></article>
    </div>
    <div class="extended-grid">
      <article class="extended-chart"><h3>Actividades por estado</h3><div class="extended-canvas"><canvas id="extActivitiesStatusChart"></canvas></div></article>
      <article class="extended-chart"><h3>Actividades por prioridad</h3><div class="extended-canvas"><canvas id="extActivitiesPriorityChart"></canvas></div></article>
    </div>`;

  combinedPanel.innerHTML = `
    <div class="extended-kpis">
      <article class="extended-kpi"><span>Registros totales</span><strong>${tasks.length + cases.length}</strong></article>
      <article class="extended-kpi"><span>Tareas</span><strong>${tasks.length}</strong></article>
      <article class="extended-kpi"><span>Actividades</span><strong>${cases.length}</strong></article>
      <article class="extended-kpi"><span>Pendientes operativos</span><strong>${pendingCombined}</strong></article>
    </div>
    <div class="extended-grid">
      <article class="extended-chart"><h3>Distribución general</h3><div class="extended-canvas"><canvas id="extCombinedTypeChart"></canvas></div></article>
      <article class="extended-chart"><h3>Comparativo mensual: tareas vs. actividades</h3><div class="extended-canvas"><canvas id="extCombinedMonthChart"></canvas></div></article>
    </div>`;

  const emptyState = document.getElementById('chartEmptyState');
  if (emptyState && (tasks.length || cases.length)) emptyState.classList.remove('visible');
  renderExtendedDashboardCharts();
}

function renderExtendedDashboardCharts() {
  destroyEnhancementCharts();
  if (!window.Chart) return;
  const { cases, tasks } = filteredEnhancementData();
  const shell = document.getElementById('extendedDashboard');
  const mode = shell?.querySelector('[data-dashboard-mode].active')?.dataset.dashboardMode || 'combined';

  if (mode === 'tasks') {
    const owners = grouped(tasks, row => row.owner).sort((a, b) => b.value - a.value).slice(0, 10);
    const months = monthlySeries(tasks, row => row.createdAt);
    const labels = sortedMonthLabels(months);
    makeChart('tasksOwner', 'extTasksOwnerChart', { type: 'bar', data: { labels: owners.map(x => x.label), datasets: [{ label: 'Tareas', data: owners.map(x => x.value), backgroundColor: '#2563eb', borderRadius: 7 }] }, options: baseChartOptions({ indexAxis: 'y', scales: cartesianScales() }) });
    makeChart('tasksMonth', 'extTasksMonthChart', { type: 'line', data: { labels: labels.map(monthLabel), datasets: [{ label: 'Tareas', data: labels.map(x => months.get(x) || 0), borderColor: '#2563eb', backgroundColor: 'rgba(37,99,235,.12)', fill: true, tension: .3 }] }, options: baseChartOptions({ scales: cartesianScales() }) });
  }

  if (mode === 'activities') {
    const statuses = grouped(cases, row => row.status);
    const priorities = grouped(cases, row => row.priority);
    makeChart('activityStatus', 'extActivitiesStatusChart', { type: 'doughnut', data: { labels: statuses.map(x => x.label), datasets: [{ data: statuses.map(x => x.value), backgroundColor: ['#1d5d9f', '#f97316', '#f5b91b', '#18a058'] }] }, options: baseChartOptions({ cutout: '62%' }) });
    makeChart('activityPriority', 'extActivitiesPriorityChart', { type: 'bar', data: { labels: priorities.map(x => x.label), datasets: [{ label: 'Actividades', data: priorities.map(x => x.value), backgroundColor: ['#18a058', '#f5b91b', '#ef4444'], borderRadius: 7 }] }, options: baseChartOptions({ scales: cartesianScales() }) });
  }

  if (mode === 'combined') {
    const taskMonths = monthlySeries(tasks, row => row.createdAt);
    const activityMonths = monthlySeries(cases, row => row.requestDate || row.createdAt);
    const labels = sortedMonthLabels(taskMonths, activityMonths);
    makeChart('combinedType', 'extCombinedTypeChart', { type: 'doughnut', data: { labels: ['Tareas', 'Actividades'], datasets: [{ data: [tasks.length, cases.length], backgroundColor: ['#2563eb', '#18a058'] }] }, options: baseChartOptions({ cutout: '62%' }) });
    makeChart('combinedMonth', 'extCombinedMonthChart', { type: 'bar', data: { labels: labels.map(monthLabel), datasets: [{ label: 'Tareas', data: labels.map(x => taskMonths.get(x) || 0), backgroundColor: '#2563eb', borderRadius: 5 }, { label: 'Actividades', data: labels.map(x => activityMonths.get(x) || 0), backgroundColor: '#18a058', borderRadius: 5 }] }, options: baseChartOptions({ scales: cartesianScales() }) });
  }
}

async function loadEnhancementData() {
  if (location.protocol === 'file:') return;
  try {
    const response = await fetch('/api/support', { credentials: 'same-origin', cache: 'no-store' });
    if (!response.ok) return;
    const data = await response.json();
    enhancementData = { cases: Array.isArray(data.cases) ? data.cases : [], tasks: Array.isArray(data.tasks) ? data.tasks : [] };
    enhancementUser = data.user || null;
    renderExtendedDashboard();
    decorateUserRows();
  } catch {}
}

async function deleteUser(account) {
  if (!account?.id) return;
  if (!confirm(`¿Eliminar al usuario ${account.name} (${account.username})?\n\nSus casos y tareas serán transferidos al administrador actual.`)) return;
  try {
    const response = await fetch('/api/users', {
      method: 'POST', credentials: 'same-origin', cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', id: account.id }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'No se pudo eliminar el usuario.');
    const msg = document.getElementById('usersMessage');
    if (msg) msg.textContent = `Usuario eliminado. Registros transferidos: ${data.transferred || 0}.`;
    setTimeout(() => location.reload(), 600);
  } catch (error) {
    const msg = document.getElementById('usersMessage');
    if (msg) msg.textContent = error.message;
  }
}

async function decorateUserRows() {
  const body = document.getElementById('usersBody');
  if (!body || location.protocol === 'file:') return;
  let accounts = [];
  try {
    const response = await fetch('/api/users', { credentials: 'same-origin', cache: 'no-store' });
    if (!response.ok) return;
    accounts = (await response.json()).users || [];
  } catch { return; }
  for (const row of body.querySelectorAll('tr')) {
    const cells = row.querySelectorAll('td');
    if (cells.length < 4 || row.querySelector('.delete-user-button')) continue;
    const username = cells[1]?.textContent?.trim();
    const account = accounts.find(item => item.username === username);
    if (!account || account.roles?.includes('admin') || account.id === enhancementUser?.id) continue;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'danger-button delete-user-button';
    button.textContent = 'Eliminar';
    button.addEventListener('click', () => deleteUser(account));
    cells[3].append(button);
  }
}

function observeUsersTable() {
  const body = document.getElementById('usersBody');
  if (!body) return;
  const observer = new MutationObserver(() => decorateUserRows());
  observer.observe(body, { childList: true });
}

document.addEventListener('DOMContentLoaded', () => {
  injectEnhancementStyles();
  ensureDashboardShell();
  observeUsersTable();
  document.getElementById('dashboardMonthFilter')?.addEventListener('change', renderExtendedDashboard);
  document.querySelector('[data-tab-target="graphicDashboardSection"]')?.addEventListener('click', loadEnhancementData);
  document.querySelector('[data-tab-target="usersSection"]')?.addEventListener('click', decorateUserRows);
  loadEnhancementData();
});

window.addEventListener('focus', loadEnhancementData);
