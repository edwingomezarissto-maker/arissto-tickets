import { build } from 'esbuild';
import { mkdir, readFile, writeFile, copyFile } from 'node:fs/promises';

await mkdir('dist/assets', { recursive: true });
await mkdir('assets', { recursive: true });
await build({ entryPoints: ['src/account.js'], bundle: true, platform: 'browser',
  format: 'iife', target: 'es2022', outfile: 'assets/account.js' });
const html = (await readFile('index.html', 'utf8')).replace('    <script src="seed-data.js"></script>\n', '').replace('    <script src="seed-data.js"></script>\r\n', '');
// Historical records and phone numbers are local migration sources, never public assets.
const source = await readFile('app.js', 'utf8');
const start = source.indexOf('const DEFAULT_COOPERATIVES = [');
const end = source.indexOf('const state = {');
if (start < 0 || end <= start) throw new Error('No se pudo aislar el catalogo local.');
const app = source.slice(0, start) + 'const DEFAULT_COOPERATIVES = [];\nconst DEFAULT_CONTACTS = {};\n\n' + source.slice(end);
await writeFile('dist/index.html', html);
await writeFile('dist/app.js', app);
await copyFile('styles.css', 'dist/styles.css');
await copyFile('assets/logo-sst.jpeg', 'dist/assets/logo-sst.jpeg');
await copyFile('assets/account.js', 'dist/assets/account.js');
