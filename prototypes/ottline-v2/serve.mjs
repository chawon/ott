import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, extname, sep } from 'node:path';
import { networkInterfaces } from 'node:os';
import { createDevApiHandler } from './dev-api-proxy.mjs';

// Standalone preview. Never serves the surrounding repository.
const root = fileURLToPath(new URL('.', import.meta.url));
const mime = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.jpg':'image/jpeg','.png':'image/png','.woff2':'font/woff2'};
export function createPreviewServer({ apiUrl = process.env.PREVIEW_API_URL } = {}) {
 const handleDevApi = createDevApiHandler({ apiUrl });
 return createServer(async (req, res) => {
  try {
    if (await handleDevApi(req, res)) return;
    if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405).end(); return; }
    const path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const file = resolve(root, `.${path === '/' ? '/index.html' : path}`);
    if (!file.startsWith(root.endsWith(sep) ? root : root + sep) || !mime[extname(file)]) { res.writeHead(404).end(); return; }
    const info = await stat(file);
    if (!info.isFile()) { res.writeHead(404).end(); return; }
    res.writeHead(200, {'Content-Type': mime[extname(file)], 'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff'});
    res.end(req.method === 'HEAD' ? undefined : await readFile(file));
  } catch { res.writeHead(404).end(); }
 });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
 const port = Number(process.env.PORT || 4173);
 const hostArg = process.argv.indexOf('--host');
 const host = hostArg >= 0 ? process.argv[hostArg + 1] : '127.0.0.1';
 if (!host || host.startsWith('--')) throw new Error('Provide an address after --host.');
 const server = createPreviewServer();
 server.listen(port, host, () => {
  console.log(`OTTLINE preview: http://localhost:${port}`);
  console.log(`Development API: ${process.env.PREVIEW_API_URL ? 'configured (read-only records)' : 'not configured'}`);
  if (host === '0.0.0.0') {
    for (const network of Object.values(networkInterfaces()).flat()) {
      if (network?.family === 'IPv4' && !network.internal) console.log(`Network: http://${network.address}:${port}`);
    }
  }
 });
}
