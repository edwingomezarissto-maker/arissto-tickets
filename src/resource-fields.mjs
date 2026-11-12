export const linkCategories = ['Documento', 'Carpeta', 'Sistema', 'Otro'];

export function webAddress(value, shared = false) {
  if (typeof value !== 'string' || value.length > 2500 || !/^https?:\/\//i.test(value.trim())) return '';
  let url;
  try { url = new URL(value.trim()); } catch { return ''; }
  if (!url.hostname || url.username || url.password) return '';
  if (shared) {
    const secret = /^(?:access_token|id_token|refresh_token|token|client_secret|password|passwd|contraseña|contrasena|api[-_]?key|x-amz-(?:signature|credential|security-token)|x-goog-signature|sig|signature)$/i;
    const fragment = new URLSearchParams(url.hash.slice(1).split('?').pop());
    if ([...url.searchParams.keys(), ...fragment.keys()].some(key => secret.test(key))) return '';
  }
  return url.href;
}
