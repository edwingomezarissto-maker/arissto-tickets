document.addEventListener('DOMContentLoaded', () => {
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const fields = document.querySelectorAll('#caseTitle, #taskTitle, #caseForm textarea, #taskForm textarea, #processForm textarea');
  let active = null;
  const reset = (session, message) => {
    clearTimeout(session.timer);
    session.button.textContent = 'Dictar'; session.button.setAttribute('aria-pressed', 'false');
    session.status.textContent = message;
    if (active === session) active = null;
  };
  function abort() {
    const session = active;
    if (!session) return;
    active = null;
    try { session.recognition.abort(); }
    finally { reset(session, 'Dictado detenido. El texto confirmado se conserva.'); }
  }
  for (const field of fields) {
    field.spellcheck = true; field.lang = 'es-SV';
    field.setAttribute('autocorrect', 'on'); field.setAttribute('autocapitalize', 'sentences');
    const tools = document.createElement('span'); tools.className = 'writing-tools';
    const button = document.createElement('button'); button.type = 'button'; button.className = 'secondary-button';
    button.textContent = 'Dictar'; button.dataset.dictateFor = field.id; button.setAttribute('aria-pressed', 'false');
    button.setAttribute('aria-label', 'Dictar en ' + (field.dataset.label || field.closest('label')?.querySelector('span')?.textContent || field.id));
    const status = document.createElement('span'); status.className = 'writing-status'; status.setAttribute('role', 'status');
    tools.append(button, status); field.insertAdjacentElement('afterend', tools);
    if (!Recognition || !window.isSecureContext) {
      button.disabled = true; status.textContent = 'Dictado no disponible en este navegador. Puede escribir normalmente.';
      continue;
    }
    button.addEventListener('click', () => {
      if (active?.field === field) {
        status.textContent = 'Terminando dictado...';
        try { active.recognition.stop(); }
        catch { abort(); }
        if (active) active.timer = setTimeout(abort, 5000);
        return;
      }
      abort();
      const recognition = new Recognition(); recognition.lang = 'es-SV'; recognition.continuous = true; recognition.interimResults = true;
      const session = { recognition, field, button, status, confirmed: new Set(), timer: null, failure: '' };
      active = session; button.textContent = 'Detener dictado'; button.setAttribute('aria-pressed', 'true');
      status.textContent = 'Permita el microfono y comience a hablar...';
      recognition.onstart = () => { if (active === session) status.textContent = 'Escuchando en español...'; };
      recognition.onresult = event => {
        if (active !== session || field.closest('.modal-backdrop')?.getAttribute('aria-hidden') === 'true') return;
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (!result.isFinal) { interim += result[0].transcript; continue; }
          if (session.confirmed.has(i)) continue;
          session.confirmed.add(i);
          let text = result[0].transcript.trim();
          if (!text) continue;
          const start = field.selectionStart ?? field.value.length, end = field.selectionEnd ?? start;
          if (start && !/\s/.test(field.value[start - 1]) && !/^[.,;:!?]/.test(text)) text = ' ' + text;
          if (end < field.value.length && !/\s/.test(field.value[end])) text += ' ';
          field.setRangeText(text, start, end, 'end');
          field.dispatchEvent(new Event('input', { bubbles: true }));
        }
        status.textContent = interim ? 'Escuchando: ' + interim : 'Escuchando en español...';
      };
      recognition.onerror = event => {
        if (active !== session) return;
        session.failure = ({ 'not-allowed': 'Permita el acceso al microfono para dictar.', 'service-not-allowed': 'El navegador no habilito el servicio de dictado.',
          'audio-capture': 'No se encontro un microfono disponible.', 'network': 'El dictado necesita conexion. El texto escrito se conserva.',
          'no-speech': 'No se detecto voz. Pulse Dictar para intentar de nuevo.', 'aborted': 'Dictado detenido.' })[event.error] || 'No se pudo completar el dictado. Puede seguir escribiendo.';
        reset(session, session.failure);
        try { recognition.abort(); } catch {}
      };
      recognition.onend = () => { if (active === session) reset(session, session.failure || 'Dictado terminado. Revise el texto antes de guardar.'); };
      try { recognition.start(); }
      catch { reset(session, 'No se pudo iniciar el microfono. Puede seguir escribiendo.'); }
    });
  }
  for (const form of document.querySelectorAll('#caseForm, #taskForm, #processForm')) {
    const help = document.createElement('p'); help.className = 'writing-status';
    help.textContent = 'Corrector en español: clic derecho sobre una palabra subrayada para ver sugerencias. El dictado puede procesar el audio en linea mediante el navegador.';
    form.append(help);
    form.addEventListener('submit', abort, true);
  }
  for (const modal of document.querySelectorAll('#caseModal, #taskModal, #processModal')) {
    new MutationObserver(() => { if (active?.field.closest('.modal-backdrop') === modal && modal.getAttribute('aria-hidden') === 'true') abort(); })
      .observe(modal, { attributes: true, attributeFilter: ['aria-hidden'] });
  }
  window.addEventListener('pagehide', abort);
  document.addEventListener('visibilitychange', () => { if (document.hidden) abort(); });
});

