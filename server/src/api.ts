import type { IncomingMessage, ServerResponse } from 'node:http';
import { randomBytes } from 'node:crypto';
import { getProgress, isDbEnabled, syncProgress } from './db.js';
import type { UserProgress } from '../../shared/types.js';

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buf.length;
    if (size > 2 * 1024 * 1024) throw new Error('Payload quá lớn');
    chunks.push(buf);
  }
  return Buffer.concat(chunks).toString('utf8');
}

function generateRecoveryCode(): string {
  const raw = randomBytes(4).toString('hex').toUpperCase();
  return `LD-${raw.slice(0, 4)}-${raw.slice(4, 8)}`;
}

export async function handleApi(req: IncomingMessage, res: ServerResponse, path: string) {
  try {
    if (path === '/api/config' && req.method === 'GET') {
      return sendJson(res, 200, { syncEnabled: isDbEnabled() });
    }

    if (path === '/api/sync/register' && req.method === 'POST') {
      if (!isDbEnabled()) return sendJson(res, 503, { error: 'Chưa cấu hình DATABASE_URL để đồng bộ đám mây.' });
      const code = generateRecoveryCode();
      return sendJson(res, 200, { code });
    }

    if (path === '/api/sync' && req.method === 'POST') {
      if (!isDbEnabled()) return sendJson(res, 503, { error: 'Chưa cấu hình DATABASE_URL để đồng bộ đám mây.' });
      const raw = await readBody(req);
      const parsed = JSON.parse(raw) as { code?: string; progress?: UserProgress };
      const code = parsed.code?.trim().toUpperCase();
      if (!code || !/^LD-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code)) {
        return sendJson(res, 400, { error: 'Mã khôi phục không hợp lệ (định dạng LD-XXXX-XXXX).' });
      }
      if (!parsed.progress || !Array.isArray(parsed.progress.attempts)) {
        return sendJson(res, 400, { error: 'Dữ liệu tiến độ không hợp lệ.' });
      }
      const merged = await syncProgress(code, parsed.progress);
      return sendJson(res, 200, { progress: merged });
    }

    if (path.startsWith('/api/sync/') && req.method === 'GET') {
      if (!isDbEnabled()) return sendJson(res, 503, { error: 'Chưa cấu hình DATABASE_URL để đồng bộ đám mây.' });
      const code = decodeURIComponent(path.slice('/api/sync/'.length)).trim().toUpperCase();
      if (!/^LD-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code)) {
        return sendJson(res, 400, { error: 'Mã khôi phục không hợp lệ.' });
      }
      const progress = await getProgress(code);
      if (!progress) return sendJson(res, 404, { error: 'Không tìm thấy mã khôi phục này.' });
      return sendJson(res, 200, { progress });
    }

    return sendJson(res, 404, { error: 'Không tìm thấy API' });
  } catch (err) {
    console.error('[api] lỗi:', err);
    return sendJson(res, 500, { error: (err as Error).message || 'Lỗi máy chủ' });
  }
}
