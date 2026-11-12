import assert from 'node:assert/strict';

export async function checkResources({ member, admin, peer, context, login, url }) {
  const title = 'Manual de conciliación';
  const pass = 'Una frase inventada solo para QA';
  const username = 'privado-solo-de-ensayo';
  const password = 'clave ficticia de un sitio';
  const requests = [];
  // Imported identifiers and dates are rendered in the same document that handles the vault key.
  const encoded = await admin.evaluate(() => {
    const id = 'test" data-injected="unsafe';
    window.ARISSTO_APP.receive({ cases: [{ id, title: 'Caso', cooperative: 'Prueba', owner: 'QA',
      status: 'Abierto', priority: 'Media', requestDate: '2026-10-<b data-injected>02</b>' }],
      tasks: [{ id, title: 'Tarea', owner: 'QA' }], cooperatives: [{ id: 'qa', name: 'Coop', contacts: [{ id, name: 'QA', phone: '' }] }] });
    return { injected: document.querySelectorAll('[data-injected]').length,
      preserved: document.querySelector('#casesTableBody [data-action="view"]')?.dataset.id === id };
  });
  assert.deepEqual(encoded, { injected: 0, preserved: true });
  member.on('request', request => {
    if (new URL(request.url()).pathname === '/api/vault' && request.method() === 'POST') requests.push(request.postData());
  });
  const teamRow = page => page.locator('#teamLinkList li').filter({ hasText: title });
  const vaultRow = page => page.locator('#vaultList li').filter({ hasText: title });
  const saveVault = page => page.locator('#vaultEntryForm button[type=submit]').click();
  const browse = async page => { await page.locator('#resourcesTab').click(); };
  async function unlock(page) {
    await page.locator('#vaultPassphrase').fill(pass); await page.locator('#unlockVault').click();
    await page.locator('#vaultContents').waitFor({ state: 'visible' });
  }

  await browse(member);
  await member.locator('#newTeamLink').click();
  await member.locator('#teamLinkTitle').fill(title);
  await member.locator('#teamLinkCategory').selectOption('Documento');
  await member.locator('#teamLinkUrl').fill('https://docs.example.test/manual');
  await member.locator('#teamLinkDescription').fill('Cómo conciliar el cierre de mes.');
  await member.locator('#teamLinkForm button[type=submit]').click();
  await teamRow(member).waitFor();
  await browse(peer); await peer.locator('#teamLinkSearch').fill('conciliacion');
  await teamRow(peer).waitFor();
  assert.equal(await teamRow(peer).getByRole('button', { name: 'Editar' }).count(), 0);
  await peer.locator('#teamLinkFilter').selectOption('Carpeta'); await teamRow(peer).waitFor({ state: 'detached' });
  await peer.locator('#teamLinkFilter').selectOption('Documento'); await teamRow(peer).waitFor();
  await browse(admin); await teamRow(admin).getByRole('button', { name: 'Editar' }).click();
  await admin.locator('#teamLinkDescription').fill('Guía compartida actualizada.'); await admin.locator('#teamLinkForm button[type=submit]').click();
  await teamRow(admin).getByText('Guía compartida actualizada.').waitFor();
  await admin.locator('#resourcesSection').screenshot({ path: 'qa-output/enlaces-equipo.png' });
  await member.locator('#reloadTeamLinks').click();
  await teamRow(member).getByText('Guía compartida actualizada.').waitFor();
  await teamRow(member).getByRole('button', { name: 'Guardar mi acceso' }).click();
  await member.locator('#vaultPassphrase').fill(pass); await member.locator('#vaultConfirm').fill(pass);
  await member.getByRole('button', { name: 'Crear mi bóveda' }).click();
  await member.locator('#vaultEntryForm').waitFor({ state: 'visible' });
  assert.equal(await member.locator('#vaultEntryTitle').inputValue(), title);
  await member.locator('#vaultEntryUsername').fill(username); await member.locator('#vaultEntryPassword').fill(password);
  await saveVault(member); await vaultRow(member).waitFor();
  await vaultRow(member).getByRole('button', { name: 'Ver acceso' }).click();
  await vaultRow(member).getByText('Usuario: ' + username).waitFor();
  assert.equal(await vaultRow(member).getByText(password, { exact: true }).count(), 0);
  await vaultRow(member).getByRole('button', { name: 'Mostrar contraseña' }).click();
  await vaultRow(member).getByText(password, { exact: true }).waitFor();
  await vaultRow(member).getByRole('button', { name: 'Ocultar contraseña' }).click();
  assert.ok(requests.length >= 2);
  assert.ok(requests.every(body => [title, username, pass, password, 'docs.example.test'].every(value => !body.includes(value))));
  const stored = await member.evaluate(() => JSON.stringify([Object.entries(localStorage), Object.entries(sessionStorage)]));
  assert.ok([username, pass, password].every(value => !stored.includes(value)));
  await admin.locator('#showPrivateVault').click();
  await admin.getByRole('button', { name: 'Crear mi bóveda' }).waitFor();
  assert.equal(await admin.locator('#vaultList').textContent(), '');

  const otherContext = await context();
  try {
    const other = await otherContext.newPage(); await other.goto(url); await login(other, 'ProyectoQA');
    await browse(other); await other.locator('#showPrivateVault').click();
    await other.getByRole('button', { name: 'Abrir mi bóveda' }).waitFor();
    await other.locator('#vaultPassphrase').fill('Una frase incorrecta de prueba');
    await other.locator('#unlockVault').click(); await other.locator('#vaultMessage').filter({ hasText: 'con esa clave maestra' }).waitFor();
    await unlock(other); await vaultRow(other).waitFor();
    await vaultRow(member).getByRole('button', { name: 'Editar' }).click();
    await vaultRow(other).getByRole('button', { name: 'Editar' }).click();
    await other.locator('#vaultEntryUsername').fill('cambio confirmado en otro navegador'); await saveVault(other);
    await other.locator('#vaultEntryForm').waitFor({ state: 'hidden' });
    await member.locator('#vaultEntryNotes').fill('borrador local'); await saveVault(member);
    await member.locator('#vaultMessage').filter({ hasText: 'cambió en otro navegador' }).waitFor();
    assert.equal(await member.locator('#vaultEntryNotes').inputValue(), 'borrador local');
    await member.locator('#cancelVaultEntry').click(); await vaultRow(member).getByRole('button', { name: 'Ver acceso' }).click();
    await vaultRow(member).getByText('Usuario: cambio confirmado en otro navegador').waitFor();

    await other.locator('#newVaultEntry').click(); await other.locator('#vaultEntryTitle').fill('Enlace confidencial');
    await other.locator('#vaultEntryUrl').fill('https://docs.example.test/private?token=solo-qa'); await saveVault(other);
    await other.locator('#vaultEntryForm').waitFor({ state: 'hidden' });
    await member.locator('#newVaultEntry').click(); await member.locator('#vaultEntryTitle').fill('Apunte personal');
    await member.locator('#vaultEntryNotes').fill('solo yo'); await saveVault(member);
    await member.locator('#vaultEntryForm').waitFor({ state: 'hidden' });
    await member.locator('#vaultList').getByText('Enlace confidencial', { exact: true }).waitFor();
    await member.setViewportSize({ width: 390, height: 844 });
    assert.ok(await member.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await member.locator('#showTeamLinks').click();
    assert.equal(await member.locator('#vaultList').textContent(), '');
    assert.equal(await member.locator('#vaultEntryPassword').inputValue(), '');
    await member.locator('#showPrivateVault').click(); await unlock(member);
    other.on('dialog', dialog => dialog.accept());
    await vaultRow(other).getByRole('button', { name: 'Eliminar' }).click(); await vaultRow(other).waitFor({ state: 'detached' });
    await other.locator('#lockVault').click();
    await other.clock.install(); await unlock(other);
    assert.equal(await vaultRow(other).count(), 0);
    await other.clock.fastForward(11 * 60 * 1000); await other.locator('#vaultGate').waitFor({ state: 'visible' });
    assert.equal(await other.locator('#vaultList').textContent(), '');
    await member.locator('#logoutButton').click(); await member.locator('#loginForm').waitFor({ state: 'visible' });
    assert.equal(await member.locator('#vaultList').textContent(), '');
    await login(member, 'FacturaQA'); await browse(member); await member.locator('#showPrivateVault').click();
    await member.getByRole('button', { name: 'Crear mi bóveda' }).waitFor();
    assert.equal(await member.locator('#vaultList').textContent(), '');
  } finally { await otherContext.close(); }
}
