import { createServer } from 'node:http';
import { loadDotEnv } from './env.js';
import { initDb, isDbEnabled } from './db.js';
import { handleApi } from './api.js';
import { serveStatic } from './static.js';

loadDotEnv();
const PORT = Number(process.env.PORT ?? 8787);

initDb().catch((e) => console.error('[db] không kết nối được Postgres:', (e as Error).message));

const server = createServer((req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  const path = (req.url ?? '/').split('?')[0];
  if (path === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true, db: isDbEnabled() }));
    return;
  }
  if (path.startsWith('/api/')) {
    void handleApi(req, res, path);
    return;
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405);
    res.end();
    return;
  }
  serveStatic(req, res, path);
});

server.listen(PORT, () => console.log(`[luyende] http://localhost:${PORT}`));
