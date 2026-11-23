import type {
  AccountPublic,
  AssignmentInfo,
  Exam,
  ExamCategory,
  GradeLevel,
  NotificationItem,
  StudentSummary,
  SubmissionRecord,
  UserAnswer,
  UserRole,
} from '@shared/types';

export interface StoredExamDto {
  exam: Exam;
  isDeleted: boolean;
  teacherId: string;
  updatedAt: string;
}

export interface ServerConfig {
  dbEnabled: boolean;
  needsFirstTeacher: boolean;
  teacherInviteRequired: boolean;
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    credentials: 'include',
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
    ...init,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || `Lỗi ${res.status}`);
  }
  return data as T;
}

export function fetchConfig(): Promise<ServerConfig> {
  return request<ServerConfig>('/api/config');
}

export function fetchMe(): Promise<{ user: AccountPublic | null }> {
  return request<{ user: AccountPublic | null }>('/api/auth/me');
}

export function apiLogin(username: string, password: string): Promise<{ user: AccountPublic }> {
  return request<{ user: AccountPublic }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
}

export function apiRegister(payload: {
  username: string;
  fullName: string;
  password: string;
  role: UserRole;
  grade?: GradeLevel;
  teacherInviteCode?: string;
}): Promise<{ user: AccountPublic }> {
  return request('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function apiLogout(): Promise<{ ok: boolean }> {
  return request('/api/auth/logout', { method: 'POST' });
}

export function fetchStudentDashboard(): Promise<{
  assignments: AssignmentInfo[];
  submissions: SubmissionRecord[];
}> {
  return request('/api/student/dashboard');
}

export function apiSaveSubmission(payload: {
  assignmentId?: string | null;
  examId: string;
  examTitle: string;
  grade: GradeLevel;
  category: ExamCategory;
  mode: 'exam' | 'practice';
  score: number;
  correctCount: number;
  totalQuestions: number;
  durationSeconds: number;
  answers: Record<string, UserAnswer>;
}): Promise<{ id: string; submittedAt: string }> {
  return request('/api/submissions', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function fetchTeacherDashboard(): Promise<{
  students: StudentSummary[];
  assignments: AssignmentInfo[];
  submissions: SubmissionRecord[];
}> {
  return request('/api/teacher/dashboard');
}

export function apiCreateStudent(payload: {
  username: string;
  fullName: string;
  password: string;
  grade: GradeLevel;
}): Promise<{ student: StudentSummary }> {
  return request('/api/teacher/students', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function apiDeleteStudent(studentId: string): Promise<{ ok: boolean }> {
  return request(`/api/teacher/students/${encodeURIComponent(studentId)}`, { method: 'DELETE' });
}

export function apiCreateAssignment(payload: {
  studentId: string | null;
  examId: string;
  examTitle: string;
  grade: GradeLevel;
  note: string;
  dueAt: string | null;
}): Promise<{ assignment: AssignmentInfo }> {
  return request('/api/teacher/assignments', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function apiDeleteAssignment(assignmentId: string): Promise<{ ok: boolean }> {
  return request(`/api/teacher/assignments/${encodeURIComponent(assignmentId)}`, { method: 'DELETE' });
}

export function fetchSubmissionDetail(submissionId: string): Promise<{ submission: SubmissionRecord }> {
  return request(`/api/teacher/submissions/${encodeURIComponent(submissionId)}`);
}

export function fetchStoredExams(): Promise<{ exams: StoredExamDto[] }> {
  return request('/api/exams');
}

export function apiSaveExam(exam: Exam): Promise<{ stored: StoredExamDto }> {
  return request('/api/teacher/exams', {
    method: 'POST',
    body: JSON.stringify({ exam }),
  });
}

export function apiDeleteOrHideExam(examId: string, mode: 'delete' | 'hide'): Promise<{ ok: boolean }> {
  return request(`/api/teacher/exams/${encodeURIComponent(examId)}?mode=${mode}`, {
    method: 'DELETE',
  });
}

export function fetchNotifications(): Promise<{ count: number; items: NotificationItem[] }> {
  return request('/api/notifications');
}

export function apiMarkAllReviewed(): Promise<{ ok: boolean }> {
  return request('/api/teacher/submissions/review-all', { method: 'POST' });
}
