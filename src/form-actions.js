document.addEventListener('DOMContentLoaded', () => {
  for (const id of ['caseForm', 'taskForm', 'processForm']) {
    const form = document.getElementById(id);
    const button = form.querySelector('button[type="submit"]');
    button?.setAttribute('aria-keyshortcuts', 'Control+s Meta+s');
    if (button) button.title = 'Guardar (Ctrl+S)';
    const hint = document.createElement('p'); hint.className = 'writing-status';
    hint.textContent = 'Guardar: Ctrl+S. Para cerrar esta ventana, use la X o Cancelar.';
    form.append(hint);
  }
  document.addEventListener('keydown', event => {
    if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey || event.key.toLowerCase() !== 's') return;
    const picker = document.getElementById('catalogPicker');
    const modals = [...document.querySelectorAll('#caseModal, #taskModal, #processModal')].filter(modal => modal.getAttribute('aria-hidden') === 'false');
    if (!modals.length && picker?.getAttribute('aria-hidden') !== 'false') return;
    event.preventDefault(); event.stopImmediatePropagation();
    if (event.repeat) return;
    let form;
    if (picker?.getAttribute('aria-hidden') === 'false') {
      form = document.getElementById('catalogCreateForm');
      if (form.hidden) {
        document.getElementById('catalogPickerMessage').textContent = 'Seleccione un registro de la lista o use Crear.';
        return;
      }
    } else form = modals.at(-1).querySelector('form');
    const button = form?.querySelector('button[type="submit"]');
    if (!button || button.disabled || form.dataset.saving === 'true') return;
    form.requestSubmit(button);
  }, true);
});

