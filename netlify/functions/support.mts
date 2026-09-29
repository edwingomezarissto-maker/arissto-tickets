import { getUser, admin } from '@netlify/identity';
import { getStore } from '@netlify/blobs';
import { createService } from './_shared/service.mjs';
import { ensureInitialAdmin } from './_shared/bootstrap.mjs';

const service = createService({ getUser, admin, getStore });
export default async function handler(request: Request) {
  try {
    await ensureInitialAdmin({ password: Netlify.env.get('ARISSTO_INITIAL_ADMIN_PASSWORD'), admin, getStore });
  } catch {
    return Response.json({ error: 'No se pudo activar la cuenta inicial. Revise la configuracion privada en Netlify.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
  return service(request);
}
export const config = { path: ['/api/support', '/api/users', '/api/profile'] };

