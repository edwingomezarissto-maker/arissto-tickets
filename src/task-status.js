const TASK_STATUSES = ['Pendiente', 'En proceso', 'En espera', 'Finalizada', 'Cancelada'];
let taskStatusSnapshot = { tasks: [], cases: [], user: null, users: [] };
let taskStatusChart = null;

const byId = id => document.getElementById(id);
const statusOf = task => TASK_STATUSES.includes(task?.status) ? task.status : 'Pendiente';
const createId = () => crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

async function supportApi(body) {
  const response = await fetch('/api/support', {
    method: body ? 'POST' : 'GET', credentials: 'same-origin', cache: 'no-store',
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(25000),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'No se pudo guardar la tarea.');
  return data;
}

function ensureTaskStatusField() {
  const form = byId('taskForm');
  if (!form || byId('taskStatus')) return;
  const ownerLabel = byId('taskOwner')?.closest('label');
  const label = document.createElement('label');
  label.innerHTML = `
    <span>Estado</span>
    <select id="taskStatus" data-label="Estado" required>
      <option value="Pendiente">Pendiente</option>
      <option value="En proceso">En proceso</option>
      <option value="En espera">En espera</option>
      <option value="Finalizada">Finalizada</option>
      <option value="Cancelada">Cancelada</option>
    </select>
    <small class="field-error"></small>`;
  ownerLabel?.insertAdjacentElement('afterend', label);
}

function taskById(id) {
  return taskStatusSnapshot.tasks.find(task => task.id === id);
}

function syncStatusIntoModal() {
  const modal = byId('taskModal');
  const select = byId('taskStatus');
  if (!modal || !select || modal.getAttribute('aria-hidden') === 'true') return;
  const id = byId('taskId')?.value || '';
  select.value = id ? statusOf(taskById(id)) : 'Pendiente';
}

function badge(status) {
  const map = {
    'Pendiente': 'status-open',
    'En proceso': 'status-progress',
    'En espera': 'status-waiting',
    'Finalizada': 'status-finished',
    'Cancelada': 'status-waiting',
  };
  return `<span class="status-badge ${map[status] || 'status-open'}">${status}</span>`;
}

function decorateTaskTable() {
  const table = document.querySelector('.tasks-table');
  const body = byId('tasksTableBody');
  if (!table || !body) return;
  const headerRow = table.querySelector('thead tr');
  if (headerRow && !headerRow.querySelector('[data-task-status-header]')) {
    const th = document.createElement('th');
    th.dataset.taskStatusHeader = '1';
    th.textContent = 'Estado';
    const cells = headerRow.querySelectorAll('th');
    cells[Math.max(0, cells.length - 2)]?.insertAdjacentElement('afterend', th);
  }
  [...body.querySelectorAll('tr')].forEach(row => {
    if (row.querySelector('[data-task-status-cell]')) return;
    const editButton = row.querySelector('[data-action="edit-task"]');
    const task = taskById(editButton?.dataset.id);
    if (!task) return;
    const td = document.createElement('td');
    td.dataset.taskStatusCell = '1';
    td.innerHTML = badge(statusOf(task));
    const cells = row.querySelectorAll('td');
    cells[Math.max(0, cells.length - 2)]?.insertAdjacentElement('afterend', td);
  });
}

function countsByTaskStatus(tasks) {
  return TASK_STATUSES.map(label => ({ label, value: tasks.filter(task => statusOf(task) === label).length }));
}

function updateDashboard() {
  const shell = byId('extendedDashboard');
  if (!shell) return;
  const month = byId('dashboardMonthFilter')?.value || '';
  const tasks = taskStatusSnapshot.tasks.filter(task => !month || String(task.createdAt || '').slice(0, 7) === month);
  const cases = taskStatusSnapshot.cases.filter(row => !month || String(row.requestDate || row.createdAt || '').slice(0, 7) === month);
  const taskCounts = countsByTaskStatus(tasks);
  const get = label => taskCounts.find(item => item.label === label)?.value || 0;
  const pending = get('Pendiente');
  const inProgress = get('En proceso');
  const finished = get('Finalizada');
  const taskPanel = shell.querySelector('[data-dashboard-panel="tasks"]');
  if (taskPanel) {
    const kpis = taskPanel.querySelectorAll('.extended-kpi');
    const values = [
      ['Tareas totales', tasks.length],
      ['Pendientes', pending],
      ['En proceso', inProgress],
      ['Finalizadas', finished],
    ];
    kpis.forEach((card, index) => {
      if (!values[index]) return;
      card.querySelector('span').textContent = values[index][0];
      card.querySelector('strong').textContent = values[index][1];
    });
    const charts = taskPanel.querySelectorAll('.extended-chart');
    if (charts[0]) charts[0].innerHTML = '<h3>Tareas por estado</h3><div class="extended-canvas"><canvas id="taskStatusDashboardChart"></canvas></div>';
  }

  const combinedPanel = shell.querySelector('[data-dashboard-panel="combined"]');
  if (combinedPanel) {
    const cards = combinedPanel.querySelectorAll('.extended-kpi');
    const activeActivities = cases.filter(row => row.status !== 'Finalizado').length;
    const operationalPending = tasks.filter(task => !['Finalizada', 'Cancelada'].includes(statusOf(task))).length + activeActivities;
    if (cards[3]) {
      cards[3].querySelector('span').textContent = 'Pendientes operativos';
      cards[3].querySelector('strong').textContent = operationalPending;
    }
  }

  if (taskStatusChart) taskStatusChart.destroy();
  const canvas = byId('taskStatusDashboardChart');
  if (canvas && window.Chart) {
    taskStatusChart = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: taskCounts.map(item => item.label),
        datasets: [{
          data: taskCounts.map(item => item.value),
          backgroundColor: ['#f5b91b', '#2563eb', '#f97316', '#18a058', '#64748b'],
        }],
      },
      options: { responsive: true, maintainAspectRatio: false, cutout: '62%', plugins: { legend: { position: 'right' } } },
    });
  }
}

async function refreshTaskStatusData() {
  if (location.protocol === 'file:') return;
  try {
    const data = await supportApi();
    taskStatusSnapshot = {
      tasks: Array.isArray(data.tasks) ? data.tasks : [],
      cases: Array.isArray(data.cases) ? data.cases : [],
      user: data.user || null,
      users: Array.isArray(data.users) ? data.users : [],
    };
    decorateTaskTable();
    updateDashboard();
    syncStatusIntoModal();
  } catch {}
}

async function saveTaskWithStatus(event) {
  if (location.protocol === 'file:') return;
  event.preventDefault();
  event.stopImmediatePropagation();
  const form = byId('taskForm');
  const title = byId('taskTitle')?.value.trim();
  const owner = byId('taskOwner')?.value.trim();
  const status = byId('taskStatus')?.value || 'Pendiente';
  const alert = byId('taskAlert');
  if (!title || !owner || !TASK_STATUSES.includes(status)) {
    if (alert) { alert.textContent = 'Complete Tarea, Encargado y Estado.'; alert.classList.add('visible'); }
    return;
  }
  const submit = form?.querySelector('button[type="submit"]');
  if (submit) submit.disabled = true;
  try {
    const latest = await supportApi();
    const id = byId('taskId')?.value || createId();
    const previous = (latest.tasks || []).find(task => task.id === id);
    const selectedAccount = byId('taskAccount')?.value || '';
    const record = {
      ...(previous || {}),
      id,
      title,
      owner,
      status,
      progress: byId('taskProgress')?.value.trim() || '',
      details: byId('taskDetails')?.value.trim() || '',
      ownerId: selectedAccount || previous?.ownerId || latest.user?.id || '',
    };
    const operation = {
      collection: 'tasks', id, action: 'put', version: previous?._version || null, record,
    };
    await supportApi({ operations: [operation] });
    if (alert) { alert.textContent = ''; alert.classList.remove('visible'); }
    document.querySelector('[data-close-task]')?.click();
    byId('refreshCloud')?.click();
    setTimeout(refreshTaskStatusData, 350);
  } catch (error) {
    if (alert) { alert.textContent = error.message; alert.classList.add('visible'); }
  } finally {
    if (submit) submit.disabled = false;
  }
}

function installTaskStatusBehavior() {
  ensureTaskStatusField();
  const form = byId('taskForm');
  if (form && !form.dataset.statusCaptureBound) {
    form.dataset.statusCaptureBound = '1';
    form.addEventListener('submit', saveTaskWithStatus, true);
  }
  const modal = byId('taskModal');
  if (modal) {
    new MutationObserver(syncStatusIntoModal).observe(modal, { attributes: true, attributeFilter: ['aria-hidden', 'class'] });
  }
  const taskBody = byId('tasksTableBody');
  if (taskBody) new MutationObserver(decorateTaskTable).observe(taskBody, { childList: true });
  const dashboard = byId('extendedDashboard');
  if (dashboard) new MutationObserver(updateDashboard).observe(dashboard, { childList: true, subtree: true });
  byId('dashboardMonthFilter')?.addEventListener('change', updateDashboard);
  document.querySelector('[data-tab-target="tasksSection"]')?.addEventListener('click', () => setTimeout(() => { decorateTaskTable(); refreshTaskStatusData(); }, 50));
  document.querySelector('[data-tab-target="graphicDashboardSection"]')?.addEventListener('click', () => setTimeout(refreshTaskStatusData, 80));
}

document.addEventListener('DOMContentLoaded', () => {
  installTaskStatusBehavior();
  refreshTaskStatusData();
});
window.addEventListener('focus', refreshTaskStatusData);
