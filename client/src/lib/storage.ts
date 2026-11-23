import { emptyProgress, mergeProgress } from '@shared/scoring';
import type { ExamAttempt, UserAnswer, UserProgress } from '@shared/types';

const PROGRESS_KEY = 'luyende_progress_v1';
const CODE_KEY = 'luyende_sync_code_v1';
const THEME_KEY = 'luyende_theme_v1';
const DRAFT_PREFIX = 'luyende_draft_v1_';

export interface ExamDraft {
  examId: string;
  mode: 'exam' | 'practice';
  startedAt: number;
  remainingSeconds: number;
  answers: Record<string, UserAnswer>;
  flagged: string[];
  updatedAt: number;
}

export function loadProgress(): UserProgress {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    if (!raw) return emptyProgress();
    const parsed = JSON.parse(raw) as UserProgress;
    if (!Array.isArray(parsed.attempts)) return emptyProgress();
    return parsed;
  } catch {
    return emptyProgress();
  }
}

export function saveProgress(progress: UserProgress): void {
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
  } catch {
    // ignore quota errors
  }
}

export function recordAttempt(attempt: ExamAttempt): UserProgress {
  const current = loadProgress();
  const next = mergeProgress(current, {
    version: 1,
    updatedAt: Date.now(),
    attempts: [attempt],
  });
  saveProgress(next);
  void pushSyncIfConfigured(next);
  return next;
}

export function clearProgress(): void {
  localStorage.removeItem(PROGRESS_KEY);
}

export function loadDraft(examId: string): ExamDraft | null {
  try {
    const raw = localStorage.getItem(DRAFT_PREFIX + examId);
    if (!raw) return null;
    return JSON.parse(raw) as ExamDraft;
  } catch {
    return null;
  }
}

export function saveDraft(draft: ExamDraft): void {
  try {
    localStorage.setItem(DRAFT_PREFIX + draft.examId, JSON.stringify(draft));
  } catch {
    // ignore
  }
}

export function clearDraft(examId: string): void {
  localStorage.removeItem(DRAFT_PREFIX + examId);
}

export function getSyncCode(): string | null {
  return localStorage.getItem(CODE_KEY);
}

export function setSyncCode(code: string | null): void {
  if (!code) localStorage.removeItem(CODE_KEY);
  else localStorage.setItem(CODE_KEY, code.trim().toUpperCase());
}

export async function checkServerSyncEnabled(): Promise<boolean> {
  try {
    const res = await fetch('/api/config');
    if (!res.ok) return false;
    const data = (await res.json()) as { syncEnabled?: boolean };
    return Boolean(data.syncEnabled);
  } catch {
    return false;
  }
}

export async function pushSyncIfConfigured(progress: UserProgress): Promise<UserProgress | null> {
  const code = getSyncCode();
  if (!code) return null;
  try {
    const res = await fetch('/api/sync', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code, progress }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { progress?: UserProgress };
    if (data.progress) {
      saveProgress(data.progress);
      return data.progress;
    }
    return null;
  } catch {
    return null;
  }
}

export async function registerCloudSync(): Promise<{ code?: string; error?: string }> {
  try {
    const res = await fetch('/api/sync/register', { method: 'POST' });
    const data = (await res.json()) as { code?: string; error?: string };
    if (!res.ok || !data.code) return { error: data.error || 'Không tạo được mã đồng bộ.' };
    setSyncCode(data.code);
    await pushSyncIfConfigured(loadProgress());
    return { code: data.code };
  } catch {
    return { error: 'Không kết nối được máy chủ.' };
  }
}

export async function restoreFromCloudCode(code: string): Promise<{ progress?: UserProgress; error?: string }> {
  const clean = code.trim().toUpperCase();
  try {
    const res = await fetch('/api/sync', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code: clean, progress: loadProgress() }),
    });
    const data = (await res.json()) as { progress?: UserProgress; error?: string };
    if (!res.ok || !data.progress) return { error: data.error || 'Mã khôi phục không hợp lệ.' };
    setSyncCode(clean);
    saveProgress(data.progress);
    return { progress: data.progress };
  } catch {
    return { error: 'Không kết nối được máy chủ.' };
  }
}

export type ThemeMode = 'light' | 'dark';

export function getInitialTheme(): ThemeMode {
  const saved = localStorage.getItem(THEME_KEY);
  if (saved === 'light' || saved === 'dark') return saved;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function applyTheme(theme: ThemeMode): void {
  localStorage.setItem(THEME_KEY, theme);
  document.documentElement.setAttribute('data-theme', theme);
}
