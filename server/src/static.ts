import type { IncomingMessage, ServerResponse } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve, sep } from 'node:path';

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
};

const ROOT = [resolve(process.cwd(), '../client/dist'), resolve(process.cwd(), 'client/dist')].find((p) =>
  existsSync(p),
);

function send(res: ServerResponse, file: string, cache: string) {
  res.writeHead(200, {
    'content-type': TYPES[extname(file)] ?? 'application/octet-stream',
    'cache-control': cache,
    'x-content-type-options': 'nosniff',
  });
  createReadStream(file).pipe(res);
}

export function serveStatic(_req: IncomingMessage, res: ServerResponse, path: string) {
  if (!ROOT) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Chưa build client (cd client && npm run build)');
    return;
  }
  let decoded: string;
  try {
    decoded = decodeURIComponent(path);
  } catch {
    res.writeHead(400);
    res.end();
    return;
  }
  const rel = normalize(decoded).replace(/^([/\\])+/, '');
  const file = join(ROOT, rel);
  if (file.startsWith(ROOT + sep) && rel && existsSync(file) && statSync(file).isFile()) {
    const cache = rel.startsWith('assets') ? 'public, max-age=31536000, immutable' : 'no-cache';
    return send(res, file, cache);
  }
  if (extname(rel) && rel !== 'index.html') {
    res.writeHead(404);
    res.end();
    return;
  }
  send(res, join(ROOT, 'index.html'), 'no-cache');
}
