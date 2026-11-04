const $ = id => document.getElementById(id);
let rows = [], cooperatives = [], currentUser = null;
const today = () => new Date().toISOString().slice(0, 10);
const money = value => new Intl.NumberFormat('es-SV', { style: 'currency', currency: 'USD' }).format(value || 0);
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
function fillCooperatives() {
  const selected = $('serviceCooperative').value, filter = $('serviceFilterCooperative').value;
  for (const [id, blank] of [['serviceCooperative', 'Seleccione'], ['serviceFilterCooperative', 'Todas']]) {
    const select = $(id); select.replaceChildren(new Option(blank, ''));
    cooperatives.filter(row => !row.deleted).forEach(row => select.add(new Option(row.name, row.id)));
  }
  $('serviceCooperative').value = selected; $('serviceFilterCooperative').value = filter;
}
function filtered() {
  const from = $('serviceFrom').value, to = $('serviceTo').value, cooperativeId = $('serviceFilterCooperative').value;
  const invoiceStatus = $('serviceInvoiceFilter').value;
  return rows.filter(row => (!from || row.date >= from) && (!to || row.date <= to) && (!cooperativeId || row.cooperativeId === cooperativeId) && (invoiceStatus === 'all' || (row.invoiceStatus || 'pending') === invoiceStatus))
    .sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || '').localeCompare(a.createdAt || ''));
}
function draw() {
  const body = $('servicesBody'); if (!body) return;
  body.replaceChildren();
  const visible = filtered(); let total = 0;
  for (const row of visible) {
    const rowTotal = Number(row.quantity) * Number(row.unitPrice); total += rowTotal;
    const tr = document.createElement('tr');
    for (const value of [row.date, row.cooperative || '', row.person, row.description, row.quantity, money(row.unitPrice), money(rowTotal)]) {
      const td = document.createElement('td'); td.textContent = value; tr.append(td);
    }
    const invoice = document.createElement('td');
    const invoiced = row.invoiceStatus === 'invoiced';
    invoice.textContent = invoiced ? `Facturada${row.invoiceMarkedBy ? ` · ${row.invoiceMarkedBy}` : ''}` : 'Pendiente';
    tr.append(invoice);
    const actions = document.createElement('td');
    const mark = document.createElement('button'); mark.className = 'secondary-button'; mark.type = 'button';
    mark.textContent = invoiced ? 'Marcar pendiente' : 'Factura realizada'; mark.addEventListener('click', () => setInvoiceStatus(row, invoiced ? 'pending' : 'invoiced'));
    actions.append(mark);
    if (currentUser?.roles?.includes('admin') || row.ownerId === currentUser?.id) {
      const edit = document.createElement('button'); edit.className = 'secondary-button'; edit.type = 'button'; edit.textContent = 'Editar'; edit.addEventListener('click', () => editRow(row)); actions.append(edit);
      const remove = document.createElement('button'); remove.className = 'danger-button'; remove.type = 'button'; remove.textContent = 'Eliminar'; remove.addEventListener('click', () => deleteRow(row)); actions.append(remove);
    }
    tr.append(actions); body.append(tr);
  }
  $('servicesEmpty').hidden = visible.length > 0;
  $('serviceSummaryTotal').textContent = `${visible.length} servicio(s) · Total informativo: ${money(total)}`;
}
async function setInvoiceStatus(row, invoiceStatus) {
  $('serviceMessage').textContent = 'Actualizando estado de factura...';
  try {
    await window.ARISSTO_CLOUD.serviceInvoiceAction(row.id, invoiceStatus);
    $('serviceMessage').textContent = invoiceStatus === 'invoiced' ? 'Servicio marcado como facturado.' : 'Servicio devuelto a pendiente de factura.';
  } catch (error) { $('serviceMessage').textContent = error.message || 'No se pudo actualizar el estado.'; }
}
function reset() {
  $('serviceForm').reset(); $('serviceId').value = ''; $('serviceDate').value = today(); $('serviceQuantity').value = '1';
  $('saveServiceButton').textContent = 'Guardar servicio'; $('cancelServiceEdit').hidden = true;
}
function editRow(row) {
  $('serviceId').value = row.id; $('serviceDate').value = row.date; $('serviceCooperative').value = row.cooperativeId;
  $('servicePerson').value = row.person; $('serviceDescription').value = row.description; $('serviceQuantity').value = row.quantity;
  $('serviceUnitPrice').value = row.unitPrice; $('serviceNotes').value = row.notes || '';
  $('saveServiceButton').textContent = 'Guardar cambios'; $('cancelServiceEdit').hidden = false; $('serviceForm').scrollIntoView({ behavior: 'smooth' });
}
async function save(event) {
  event.preventDefault(); const cooperative = cooperatives.find(row => row.id === $('serviceCooperative').value);
  if (!cooperative) { $('serviceMessage').textContent = 'Seleccione una cooperativa vigente.'; return; }
  const id = $('serviceId').value || crypto.randomUUID(), previous = rows.find(row => row.id === id);
  const row = { ...previous, id, date: $('serviceDate').value, cooperativeId: cooperative.id, cooperative: cooperative.name,
    person: $('servicePerson').value.trim(), description: $('serviceDescription').value.trim(), quantity: Number($('serviceQuantity').value),
    unitPrice: Number($('serviceUnitPrice').value), notes: $('serviceNotes').value.trim() };
  const next = [...rows.filter(item => item.id !== id), row];
  $('saveServiceButton').disabled = true; $('serviceMessage').textContent = 'Guardando...';
  try { await window.ARISSTO_CLOUD.commitServices(next); reset(); $('serviceMessage').textContent = 'Servicio sincronizado.'; }
  catch (error) { $('serviceMessage').textContent = error.message || 'No se pudo guardar.'; }
  finally { $('saveServiceButton').disabled = false; }
}
async function deleteRow(row) {
  if (!confirm(`¿Eliminar el servicio «${row.description}» de ${row.cooperative}?`)) return;
  try { await window.ARISSTO_CLOUD.commitServices(rows.filter(item => item.id !== row.id)); $('serviceMessage').textContent = 'Servicio eliminado.'; }
  catch (error) { $('serviceMessage').textContent = error.message || 'No se pudo eliminar.'; }
}
function printSummary() {
  const data = filtered(); const total = data.reduce((sum, row) => sum + Number(row.quantity) * Number(row.unitPrice), 0);
  const htmlRows = data.map(row => `<tr><td>${esc(row.date)}</td><td>${esc(row.cooperative)}</td><td>${esc(row.person)}</td><td>${esc(row.description)}${row.notes ? `<br><small>${esc(row.notes)}</small>` : ''}</td><td>${esc(row.quantity)}</td><td>${money(row.unitPrice)}</td><td>${money(row.quantity * row.unitPrice)}</td><td>${row.invoiceStatus === 'invoiced' ? 'Facturada' : 'Pendiente'}</td></tr>`).join('');
  const win = window.open('', '_blank');
  if (!win) { $('serviceMessage').textContent = 'Permita la ventana emergente para imprimir el resumen.'; return; }
  win.document.write(`<!doctype html><html lang="es"><meta charset="utf-8"><title>Resumen de servicios</title><style>body{font:14px Arial,sans-serif;color:#172b4d;margin:32px}h1{font-size:22px}table{border-collapse:collapse;width:100%;margin-top:20px}th,td{border:1px solid #ccd5e0;padding:8px;text-align:left}th{background:#eef3f9}.total{text-align:right;font-size:18px;font-weight:bold;margin-top:20px}.note{color:#596579;font-size:12px}@media print{button{display:none}}</style><h1>Resumen de servicios brindados</h1><p>Período: ${esc($('serviceFrom').value || 'Sin inicio')} al ${esc($('serviceTo').value || 'Sin límite')}</p>${$('serviceFilterCooperative').selectedOptions[0]?.value ? `<p>Cooperativa: ${esc($('serviceFilterCooperative').selectedOptions[0].textContent)}</p>` : ''}<table><thead><tr><th>Fecha</th><th>Cooperativa</th><th>Persona</th><th>Servicio y observaciones</th><th>Cantidad</th><th>Precio unitario</th><th>Total</th><th>Estado</th></tr></thead><tbody>${htmlRows}</tbody></table><p class="total">Total informativo: ${money(total)}</p><p class="note">Documento interno de apoyo para preparar la factura. No constituye una factura fiscal.</p><script>window.print()<\/script></html>`);
  win.document.close();
}
window.ARISSTO_SERVICES = { receive(data, user) { rows = structuredClone(data.services || []); cooperatives = structuredClone(data.cooperatives || []); currentUser = user; fillCooperatives(); draw(); } };
if ($('serviceForm')) {
  $('serviceForm').addEventListener('submit', save); $('cancelServiceEdit').addEventListener('click', reset);
  for (const id of ['serviceFrom', 'serviceTo', 'serviceFilterCooperative', 'serviceInvoiceFilter']) $(id).addEventListener('change', draw);
  $('printServiceSummary').addEventListener('click', printSummary); reset();
}
