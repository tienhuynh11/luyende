import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt);

export const SESSION_COOKIE = 'luyende_sid';
export const SESSION_TTL_DAYS = 14;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const derived = (await scryptAsync(password, salt, 64)) as Buffer;
  return `scrypt$${salt}$${derived.toString('hex')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const [, salt, hashHex] = parts;
  const derived = (await scryptAsync(password, salt, 64)) as Buffer;
  const expected = Buffer.from(hashHex, 'hex');
  if (derived.length !== expected.length) return false;
  return timingSafeEqual(derived, expected);
}

export function generateSessionToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function generateId(prefix: string): string {
  return `${prefix}_${randomBytes(8).toString('hex')}`;
}

export function generateClassCode(grade: number): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let suffix = '';
  const buf = randomBytes(4);
  for (let i = 0; i < 4; i++) {
    suffix += chars[buf[i] % chars.length];
  }
  return `T${grade}-${suffix}`;
}

export function parseCookies(req: IncomingMessage): Record<string, string> {
  const header = req.headers.cookie;
  if (!header) return {};
  const out: Record<string, string> = {};
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  }
  return out;
}

export function isSecureRequest(req: IncomingMessage): boolean {
  const proto = req.headers['x-forwarded-proto'];
  if (typeof proto === 'string') return proto.split(',')[0].trim() === 'https';
  return process.env.NODE_ENV === 'production';
}

export function setSessionCookie(req: IncomingMessage, res: ServerResponse, token: string) {
  const maxAge = SESSION_TTL_DAYS * 24 * 60 * 60;
  const parts = [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAge}`,
  ];
  if (isSecureRequest(req)) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

export function clearSessionCookie(req: IncomingMessage, res: ServerResponse) {
  const parts = [`${SESSION_COOKIE}=`, 'Path=/', 'HttpOnly', 'SameSite=Lax', 'Max-Age=0'];
  if (isSecureRequest(req)) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

export function getClientIp(req: IncomingMessage): string {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.trim()) {
    return fwd.split(',')[0].trim();
  }
  return req.socket.remoteAddress || 'unknown';
}

// In-memory sliding window rate limiter for auth endpoints
const buckets = new Map<string, number[]>();

export function checkRateLimit(key: string, maxRequests: number, windowMs: number): boolean {
  const now = Date.now();
  const list = buckets.get(key) ?? [];
  const recent = list.filter((t) => now - t < windowMs);
  if (recent.length >= maxRequests) {
    buckets.set(key, recent);
    return false;
  }
  recent.push(now);
  buckets.set(key, recent);
  if (buckets.size > 2000) {
    for (const [k, v] of buckets.entries()) {
      if (v.length === 0 || now - v[v.length - 1] > windowMs) buckets.delete(k);
    }
  }
  return true;
}

export function validateUsername(raw: string): string | null {
  const clean = raw.trim().toLowerCase();
  if (!/^[a-z0-9._-]{3,32}$/.test(clean)) return null;
  return clean;
}

export function validatePassword(raw: string): boolean {
  return typeof raw === 'string' && raw.length >= 6 && raw.length <= 128;
}
