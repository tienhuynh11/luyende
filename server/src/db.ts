import pg from 'pg';
import { emptyProgress, mergeProgress } from '../../shared/scoring.js';
import type { UserProgress } from '../../shared/types.js';

const { Pool } = pg;

let pool: pg.Pool | null = null;

export function isDbEnabled(): boolean {
  return Boolean(pool);
}

export async function initDb(): Promise<boolean> {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    console.log('[db] Không có DATABASE_URL — chạy chế độ lưu cục bộ (localStorage).');
    return false;
  }

  pool = new Pool({
    connectionString: url,
    ssl: url.includes('localhost') || url.includes('127.0.0.1') ? undefined : { rejectUnauthorized: false },
    max: 5,
  });

  await pool.query(`CREATE SCHEMA IF NOT EXISTS luyende`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS luyende.users (
      code TEXT PRIMARY KEY,
      progress JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  console.log('[db] Postgres (schema luyende) sẵn sàng');
  return true;
}

export async function getProgress(code: string): Promise<UserProgress | null> {
  if (!pool) return null;
  const res = await pool.query<{ progress: UserProgress }>(
    `SELECT progress FROM luyende.users WHERE code = $1`,
    [code],
  );
  return res.rows[0]?.progress ?? null;
}

export async function syncProgress(code: string, incoming: UserProgress): Promise<UserProgress> {
  if (!pool) return incoming;
  const existing = (await getProgress(code)) ?? emptyProgress();
  const merged = mergeProgress(existing, incoming);
  await pool.query(
    `INSERT INTO luyende.users (code, progress, updated_at)
     VALUES ($1, $2::jsonb, NOW())
     ON CONFLICT (code) DO UPDATE SET progress = $2::jsonb, updated_at = NOW()`,
    [code, JSON.stringify(merged)],
  );
  return merged;
}
