const $ = id => document.getElementById(id);

async function api(path, body) {
  const response = await fetch(path, {
    method: body ? 'POST' : 'GET',
    credentials: 'same-origin',
    cache: 'no-store',
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'No se pudo completar la operación.');
  return data;
}

async function renderDeleteButtons() {
  const body = $('usersBody');
  if (!body || location.protocol === 'file:') return;

  let profile;
  let accounts;
  try {
    const [profileData, usersData] = await Promise.all([api('/api/profile'), api('/api/users')]);
    profile = profileData.user;
    accounts = usersData.users || [];
  } catch {
    return;
  }

  const rows = [...body.querySelectorAll('tr')];
  rows.forEach((row, index) => {
    row.querySelectorAll('.delete-user-button').forEach(button => button.remove());
    const account = accounts[index];
    const cells = row.querySelectorAll('td');
    if (!account || cells.length < 4 || account.id === profile?.id) return;

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'danger-button delete-user-button';
    button.textContent = 'Eliminar';
    button.style.marginLeft = '8px';
    button.addEventListener('click', async () => {
      const adminLabel = account.roles?.includes('admin') ? 'administrador' : 'usuario';
      if (!confirm(`¿Eliminar este ${adminLabel}: ${account.name} (${account.username})?\n\nSus casos y tareas serán transferidos a la cuenta administradora que está usando actualmente.`)) return;
      button.disabled = true;
      try {
        const result = await api('/api/users', { action: 'delete', id: account.id });
        const message = $('usersMessage');
        if (message) message.textContent = `Cuenta eliminada. Registros transferidos: ${result.transferred || 0}.`;
        setTimeout(() => location.reload(), 500);
      } catch (error) {
        button.disabled = false;
        const message = $('usersMessage');
        if (message) message.textContent = error.message;
      }
    });
    cells[3].append(button);
  });
}

function observeUsers() {
  const body = $('usersBody');
  if (!body) return;
  let scheduled = false;
  const schedule = () => {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(async () => {
      scheduled = false;
      await renderDeleteButtons();
    });
  };
  new MutationObserver(schedule).observe(body, { childList: true });
}

document.addEventListener('DOMContentLoaded', () => {
  observeUsers();
  document.querySelector('[data-tab-target="usersSection"]')?.addEventListener('click', () => setTimeout(renderDeleteButtons, 50));
  setTimeout(renderDeleteButtons, 300);
});
