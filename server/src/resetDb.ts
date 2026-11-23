import pg from 'pg';
import { loadDotEnv } from './env.js';
import { initDb } from './db.js';

loadDotEnv();

async function main() {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    console.error('Thiếu DATABASE_URL. Chạy: DATABASE_URL="postgres://..." npm run reset-db');
    process.exit(1);
  }

  const pool = new pg.Pool({
    connectionString: url,
    ssl: url.includes('localhost') || url.includes('127.0.0.1') ? undefined : { rejectUnauthorized: false },
  });

  try {
    console.log('[reset-db] Đang xóa sạch schema luyende (không ảnh hưởng speakup/public)...');
    await pool.query(`DROP SCHEMA IF EXISTS luyende CASCADE`);
    await pool.end();
    await initDb();
    console.log('[reset-db] Hoàn tất! Cơ sở dữ liệu luyende đã sạch hoàn toàn và sẵn sàng vận hành.');
    process.exit(0);
  } catch (err) {
    console.error('[reset-db] Lỗi:', err);
    process.exit(1);
  }
}

void main();
