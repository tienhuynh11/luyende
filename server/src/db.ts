import pg from 'pg';
import type {
  AccountPublic,
  AssignmentInfo,
  Exam,
  ExamCategory,
  GradeLevel,
  Question,
  StudentSummary,
  SubjectId,
  SubmissionRecord,
  TextbookSeries,
  UserAnswer,
  UserRole,
} from '../../shared/types.js';
import { generateId, hashToken, SESSION_TTL_DAYS } from './auth.js';

const { Pool } = pg;

let pool: pg.Pool | null = null;

export function isDbEnabled(): boolean {
  return Boolean(pool);
}

function requirePool(): pg.Pool {
  if (!pool) throw new Error('Chưa kết nối cơ sở dữ liệu Postgres (DATABASE_URL).');
  return pool;
}

export async function initDb(): Promise<boolean> {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    console.log('[db] Không có DATABASE_URL — chỉ chạy chế độ luyện tập cục bộ.');
    return false;
  }

  pool = new Pool({
    connectionString: url,
    ssl: url.includes('localhost') || url.includes('127.0.0.1') ? undefined : { rejectUnauthorized: false },
    max: 8,
  });

  await pool.query(`CREATE SCHEMA IF NOT EXISTS luyende`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS luyende.accounts (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      full_name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('teacher', 'student')),
      grade SMALLINT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS luyende.sessions (
      token_hash TEXT PRIMARY KEY,
      account_id TEXT NOT NULL REFERENCES luyende.accounts(id) ON DELETE CASCADE,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_sessions_account ON luyende.sessions(account_id)`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS luyende.assignments (
      id TEXT PRIMARY KEY,
      teacher_id TEXT NOT NULL REFERENCES luyende.accounts(id) ON DELETE CASCADE,
      class_id TEXT,
      student_id TEXT REFERENCES luyende.accounts(id) ON DELETE CASCADE,
      exam_id TEXT NOT NULL,
      exam_title TEXT NOT NULL,
      grade SMALLINT NOT NULL,
      note TEXT NOT NULL DEFAULT '',
      due_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  // Safe migration if assignments table already existed with NOT NULL class_id
  await pool.query(`ALTER TABLE luyende.assignments ALTER COLUMN class_id DROP NOT NULL`).catch(() => {});
  await pool.query(
    `ALTER TABLE luyende.assignments ADD COLUMN IF NOT EXISTS student_id TEXT REFERENCES luyende.accounts(id) ON DELETE CASCADE`,
  );

  await pool.query(`
    CREATE TABLE IF NOT EXISTS luyende.submissions (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL REFERENCES luyende.accounts(id) ON DELETE CASCADE,
      assignment_id TEXT REFERENCES luyende.assignments(id) ON DELETE SET NULL,
      exam_id TEXT NOT NULL,
      exam_title TEXT NOT NULL,
      grade SMALLINT NOT NULL,
      category TEXT NOT NULL,
      mode TEXT NOT NULL,
      score NUMERIC(5, 2) NOT NULL,
      correct_count INT NOT NULL,
      total_questions INT NOT NULL,
      duration_seconds INT NOT NULL,
      answers JSONB NOT NULL,
      submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_submissions_student ON luyende.submissions(student_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_submissions_assignment ON luyende.submissions(assignment_id)`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS luyende.custom_exams (
      id TEXT PRIMARY KEY,
      teacher_id TEXT NOT NULL REFERENCES luyende.accounts(id) ON DELETE CASCADE,
      subject_id TEXT NOT NULL DEFAULT 'toan',
      grade SMALLINT NOT NULL,
      title TEXT NOT NULL,
      subtitle TEXT NOT NULL DEFAULT '',
      category TEXT NOT NULL,
      textbook TEXT NOT NULL DEFAULT 'chung',
      duration_minutes INT NOT NULL DEFAULT 45,
      source_note TEXT NOT NULL DEFAULT '',
      topics JSONB NOT NULL DEFAULT '[]'::jsonb,
      questions JSONB NOT NULL DEFAULT '[]'::jsonb,
      is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  console.log('[db] Postgres (schema luyende) sẵn sàng');
  return true;
}

export async function countTeachers(): Promise<number> {
  const db = requirePool();
  const res = await db.query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM luyende.accounts WHERE role = 'teacher'`);
  return Number(res.rows[0]?.count ?? 0);
}

export async function createAccount(input: {
  username: string;
  fullName: string;
  passwordHash: string;
  role: UserRole;
  grade: GradeLevel | null;
}): Promise<AccountPublic> {
  const db = requirePool();
  const id = generateId('acc');
  const res = await db.query(
    `INSERT INTO luyende.accounts (id, username, full_name, password_hash, role, grade)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, username, full_name, role, grade, created_at`,
    [id, input.username, input.fullName, input.passwordHash, input.role, input.grade],
  );
  const r = res.rows[0];
  return {
    id: r.id,
    username: r.username,
    fullName: r.full_name,
    role: r.role,
    grade: r.grade ? (Number(r.grade) as GradeLevel) : null,
    createdAt: r.created_at.toISOString(),
  };
}

export async function findAccountByUsername(username: string): Promise<(AccountPublic & { passwordHash: string }) | null> {
  const db = requirePool();
  const res = await db.query(
    `SELECT id, username, full_name, password_hash, role, grade, created_at
     FROM luyende.accounts WHERE username = $1`,
    [username],
  );
  const r = res.rows[0];
  if (!r) return null;
  return {
    id: r.id,
    username: r.username,
    fullName: r.full_name,
    passwordHash: r.password_hash,
    role: r.role,
    grade: r.grade ? (Number(r.grade) as GradeLevel) : null,
    createdAt: r.created_at.toISOString(),
  };
}

export async function createSession(accountId: string, rawToken: string): Promise<void> {
  const db = requirePool();
  const tokenHash = hashToken(rawToken);
  await db.query(
    `INSERT INTO luyende.sessions (token_hash, account_id, expires_at)
     VALUES ($1, $2, NOW() + ($3 || ' days')::interval)`,
    [tokenHash, accountId, String(SESSION_TTL_DAYS)],
  );
}

export async function deleteSession(rawToken: string): Promise<void> {
  const db = requirePool();
  await db.query(`DELETE FROM luyende.sessions WHERE token_hash = $1`, [hashToken(rawToken)]);
}

export async function getAccountBySessionToken(rawToken: string): Promise<AccountPublic | null> {
  if (!pool) return null;
  const res = await pool.query(
    `SELECT a.id, a.username, a.full_name, a.role, a.grade, a.created_at
     FROM luyende.sessions s
     JOIN luyende.accounts a ON a.id = s.account_id
     WHERE s.token_hash = $1 AND s.expires_at > NOW()`,
    [hashToken(rawToken)],
  );
  const r = res.rows[0];
  if (!r) return null;
  return {
    id: r.id,
    username: r.username,
    fullName: r.full_name,
    role: r.role,
    grade: r.grade ? (Number(r.grade) as GradeLevel) : null,
    createdAt: r.created_at.toISOString(),
  };
}

// --- STUDENTS & ASSIGNMENTS (DIRECT TUTOR FLOW) ---

export async function deleteStudentAccount(studentId: string): Promise<boolean> {
  const db = requirePool();
  const res = await db.query(`DELETE FROM luyende.accounts WHERE id = $1 AND role = 'student'`, [studentId]);
  return (res.rowCount ?? 0) > 0;
}

export async function createAssignment(input: {
  teacherId: string;
  studentId: string | null;
  examId: string;
  examTitle: string;
  grade: GradeLevel;
  note: string;
  dueAt: string | null;
}): Promise<AssignmentInfo> {
  const db = requirePool();
  let studentName: string | undefined;
  if (input.studentId) {
    const st = await db.query(`SELECT full_name FROM luyende.accounts WHERE id = $1 AND role = 'student'`, [
      input.studentId,
    ]);
    if (st.rows.length === 0) throw new Error('Không tìm thấy học sinh này.');
    studentName = st.rows[0].full_name;
  }

  const id = generateId('asg');
  const res = await db.query(
    `INSERT INTO luyende.assignments (id, teacher_id, student_id, exam_id, exam_title, grade, note, due_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id, teacher_id, student_id, exam_id, exam_title, grade, note, due_at, created_at`,
    [id, input.teacherId, input.studentId, input.examId, input.examTitle, input.grade, input.note, input.dueAt],
  );
  const r = res.rows[0];
  return {
    id: r.id,
    teacherId: r.teacher_id,
    studentId: r.student_id ?? null,
    studentName: studentName ?? 'Tất cả học sinh',
    examId: r.exam_id,
    examTitle: r.exam_title,
    grade: Number(r.grade) as GradeLevel,
    note: r.note,
    dueAt: r.due_at ? r.due_at.toISOString() : null,
    createdAt: r.created_at.toISOString(),
    submissionCount: 0,
  };
}

export async function deleteAssignment(teacherId: string, assignmentId: string): Promise<boolean> {
  const db = requirePool();
  const res = await db.query(`DELETE FROM luyende.assignments WHERE id = $1 AND teacher_id = $2`, [
    assignmentId,
    teacherId,
  ]);
  return (res.rowCount ?? 0) > 0;
}

// --- SUBMISSIONS ---

export async function saveSubmission(input: {
  studentId: string;
  assignmentId: string | null;
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
  const db = requirePool();
  let validAssignmentId = input.assignmentId;
  if (validAssignmentId) {
    const chk = await db.query(`SELECT id FROM luyende.assignments WHERE id = $1`, [validAssignmentId]);
    if (chk.rows.length === 0) validAssignmentId = null;
  }

  const id = generateId('sub');
  const res = await db.query(
    `INSERT INTO luyende.submissions (
      id, student_id, assignment_id, exam_id, exam_title, grade, category, mode,
      score, correct_count, total_questions, duration_seconds, answers
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb)
    RETURNING id, submitted_at`,
    [
      id,
      input.studentId,
      validAssignmentId,
      input.examId,
      input.examTitle,
      input.grade,
      input.category,
      input.mode,
      input.score,
      input.correctCount,
      input.totalQuestions,
      input.durationSeconds,
      JSON.stringify(input.answers),
    ],
  );
  return { id: res.rows[0].id, submittedAt: res.rows[0].submitted_at.toISOString() };
}

// --- DASHBOARDS ---

export async function getStudentDashboard(studentId: string): Promise<{
  assignments: AssignmentInfo[];
  submissions: SubmissionRecord[];
}> {
  const db = requirePool();

  const asgRes = await db.query(
    `SELECT asg.id, asg.teacher_id, t.full_name AS teacher_name, asg.student_id,
            asg.exam_id, asg.exam_title, asg.grade, asg.note, asg.due_at, asg.created_at,
            (SELECT MAX(s.score) FROM luyende.submissions s
             WHERE s.student_id = $1 AND (s.assignment_id = asg.id OR s.exam_id = asg.exam_id)) AS my_best_score,
            (SELECT MAX(s.submitted_at) FROM luyende.submissions s
             WHERE s.student_id = $1 AND (s.assignment_id = asg.id OR s.exam_id = asg.exam_id)) AS my_submitted_at
     FROM luyende.assignments asg
     JOIN luyende.accounts t ON t.id = asg.teacher_id
     WHERE asg.student_id IS NULL OR asg.student_id = $1
     ORDER BY asg.created_at DESC`,
    [studentId],
  );

  const assignments: AssignmentInfo[] = asgRes.rows.map((r) => ({
    id: r.id,
    teacherId: r.teacher_id,
    teacherName: r.teacher_name,
    studentId: r.student_id ?? null,
    examId: r.exam_id,
    examTitle: r.exam_title,
    grade: Number(r.grade) as GradeLevel,
    note: r.note,
    dueAt: r.due_at ? r.due_at.toISOString() : null,
    createdAt: r.created_at.toISOString(),
    myBestScore: r.my_best_score !== null ? Number(r.my_best_score) : null,
    mySubmittedAt: r.my_submitted_at ? r.my_submitted_at.toISOString() : null,
  }));

  const subRes = await db.query(
    `SELECT s.id, s.student_id, a.full_name AS student_name, a.username AS student_username,
            s.assignment_id, s.exam_id, s.exam_title, s.grade, s.category, s.mode,
            s.score, s.correct_count, s.total_questions, s.duration_seconds, s.submitted_at
     FROM luyende.submissions s
     JOIN luyende.accounts a ON a.id = s.student_id
     WHERE s.student_id = $1
     ORDER BY s.submitted_at DESC
     LIMIT 100`,
    [studentId],
  );

  return { assignments, submissions: subRes.rows.map(mapSubmissionRow) };
}

export async function getTeacherDashboard(teacherId: string): Promise<{
  students: StudentSummary[];
  assignments: AssignmentInfo[];
  submissions: SubmissionRecord[];
}> {
  const db = requirePool();

  const stuRes = await db.query(
    `SELECT a.id, a.username, a.full_name, a.grade, a.created_at,
            COUNT(s.id)::int AS submission_count,
            AVG(s.score) AS avg_score
     FROM luyende.accounts a
     LEFT JOIN luyende.submissions s ON s.student_id = a.id
     WHERE a.role = 'student'
     GROUP BY a.id
     ORDER BY a.created_at DESC`,
  );

  const students: StudentSummary[] = stuRes.rows.map((r) => ({
    id: r.id,
    username: r.username,
    fullName: r.full_name,
    grade: r.grade ? (Number(r.grade) as GradeLevel) : null,
    createdAt: r.created_at.toISOString(),
    submissionCount: Number(r.submission_count),
    avgScore: r.avg_score !== null ? Number(r.avg_score) : null,
  }));

  const asgRes = await db.query(
    `SELECT asg.id, asg.teacher_id, asg.student_id, st.full_name AS student_name,
            asg.exam_id, asg.exam_title, asg.grade, asg.note, asg.due_at, asg.created_at,
            (SELECT COUNT(DISTINCT s.student_id)
             FROM luyende.submissions s
             WHERE (s.assignment_id = asg.id OR s.exam_id = asg.exam_id)
               AND (asg.student_id IS NULL OR s.student_id = asg.student_id))::int AS submission_count
     FROM luyende.assignments asg
     LEFT JOIN luyende.accounts st ON st.id = asg.student_id
     WHERE asg.teacher_id = $1
     ORDER BY asg.created_at DESC`,
    [teacherId],
  );

  const assignments: AssignmentInfo[] = asgRes.rows.map((r) => ({
    id: r.id,
    teacherId: r.teacher_id,
    studentId: r.student_id ?? null,
    studentName: r.student_name ?? 'Tất cả học sinh',
    examId: r.exam_id,
    examTitle: r.exam_title,
    grade: Number(r.grade) as GradeLevel,
    note: r.note,
    dueAt: r.due_at ? r.due_at.toISOString() : null,
    createdAt: r.created_at.toISOString(),
    submissionCount: Number(r.submission_count),
  }));

  const subRes = await db.query(
    `SELECT s.id, s.student_id, a.full_name AS student_name, a.username AS student_username,
            s.assignment_id, s.exam_id, s.exam_title, s.grade, s.category, s.mode,
            s.score, s.correct_count, s.total_questions, s.duration_seconds, s.submitted_at
     FROM luyende.submissions s
     JOIN luyende.accounts a ON a.id = s.student_id
     WHERE a.role = 'student'
     ORDER BY s.submitted_at DESC
     LIMIT 300`,
  );

  return { students, assignments, submissions: subRes.rows.map(mapSubmissionRow) };
}

export async function getSubmissionForTeacher(submissionId: string): Promise<SubmissionRecord | null> {
  const db = requirePool();
  const res = await db.query(
    `SELECT s.id, s.student_id, a.full_name AS student_name, a.username AS student_username,
            s.assignment_id, s.exam_id, s.exam_title, s.grade, s.category, s.mode,
            s.score, s.correct_count, s.total_questions, s.duration_seconds, s.answers, s.submitted_at
     FROM luyende.submissions s
     JOIN luyende.accounts a ON a.id = s.student_id
     WHERE s.id = $1
     LIMIT 1`,
    [submissionId],
  );
  if (res.rows.length === 0) return null;
  const r = res.rows[0];
  return {
    ...mapSubmissionRow(r),
    answers: r.answers as Record<string, UserAnswer>,
  };
}

// --- CUSTOM & EDITED EXAMS ---

export interface StoredExamRow {
  exam: Exam;
  isDeleted: boolean;
  teacherId: string;
  updatedAt: string;
}

export async function listStoredExams(): Promise<StoredExamRow[]> {
  if (!pool) return [];
  const res = await pool.query(
    `SELECT id, teacher_id, subject_id, grade, title, subtitle, category, textbook,
            duration_minutes, source_note, topics, questions, is_deleted, updated_at
     FROM luyende.custom_exams
     ORDER BY updated_at DESC`,
  );
  return res.rows.map((r) => ({
    teacherId: r.teacher_id,
    isDeleted: Boolean(r.is_deleted),
    updatedAt: r.updated_at.toISOString(),
    exam: {
      id: r.id,
      subjectId: (r.subject_id || 'toan') as SubjectId,
      grade: Number(r.grade) as GradeLevel,
      title: r.title,
      subtitle: r.subtitle || '',
      category: (r.category || 'cuoi-hk1') as ExamCategory,
      textbook: (r.textbook || 'chung') as TextbookSeries,
      term: 'HK1',
      schoolYear: '2026–2027',
      durationMinutes: Number(r.duration_minutes) || 45,
      topics: Array.isArray(r.topics) ? r.topics : [],
      questions: Array.isArray(r.questions) ? (r.questions as Question[]) : [],
      sourceNote: r.source_note || undefined,
    },
  }));
}

export async function upsertStoredExam(teacherId: string, exam: Exam): Promise<StoredExamRow> {
  const db = requirePool();
  const id = exam.id?.trim() || generateId('exam');
  const topics =
    exam.topics && exam.topics.length > 0
      ? exam.topics
      : Array.from(new Set(exam.questions.map((q) => q.topic).filter(Boolean)));

  const res = await db.query(
    `INSERT INTO luyende.custom_exams (
      id, teacher_id, subject_id, grade, title, subtitle, category, textbook,
      duration_minutes, source_note, topics, questions, is_deleted, updated_at
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12::jsonb,FALSE,NOW())
    ON CONFLICT (id) DO UPDATE SET
      teacher_id = $2,
      subject_id = $3,
      grade = $4,
      title = $5,
      subtitle = $6,
      category = $7,
      textbook = $8,
      duration_minutes = $9,
      source_note = $10,
      topics = $11::jsonb,
      questions = $12::jsonb,
      is_deleted = FALSE,
      updated_at = NOW()
    RETURNING id, teacher_id, subject_id, grade, title, subtitle, category, textbook,
              duration_minutes, source_note, topics, questions, is_deleted, updated_at`,
    [
      id,
      teacherId,
      exam.subjectId || 'toan',
      exam.grade,
      exam.title.trim(),
      (exam.subtitle || '').trim(),
      exam.category || 'cuoi-hk1',
      exam.textbook || 'chung',
      Math.max(5, Math.min(180, Number(exam.durationMinutes) || 45)),
      (exam.sourceNote || '').trim(),
      JSON.stringify(topics),
      JSON.stringify(exam.questions),
    ],
  );
  const r = res.rows[0];
  return {
    teacherId: r.teacher_id,
    isDeleted: Boolean(r.is_deleted),
    updatedAt: r.updated_at.toISOString(),
    exam: {
      id: r.id,
      subjectId: r.subject_id as SubjectId,
      grade: Number(r.grade) as GradeLevel,
      title: r.title,
      subtitle: r.subtitle || '',
      category: r.category as ExamCategory,
      textbook: r.textbook as TextbookSeries,
      term: 'HK1',
      schoolYear: '2026–2027',
      durationMinutes: Number(r.duration_minutes),
      topics: Array.isArray(r.topics) ? r.topics : [],
      questions: Array.isArray(r.questions) ? (r.questions as Question[]) : [],
      sourceNote: r.source_note || undefined,
    },
  };
}

export async function deleteOrHideStoredExam(
  teacherId: string,
  examId: string,
  mode: 'delete' | 'hide',
): Promise<void> {
  const db = requirePool();
  if (mode === 'delete') {
    await db.query(`DELETE FROM luyende.custom_exams WHERE id = $1`, [examId]);
  } else {
    await db.query(
      `INSERT INTO luyende.custom_exams (
        id, teacher_id, subject_id, grade, title, category, is_deleted, updated_at
      ) VALUES ($1, $2, 'toan', 6, '', 'cuoi-hk1', TRUE, NOW())
      ON CONFLICT (id) DO UPDATE SET is_deleted = TRUE, updated_at = NOW()`,
      [examId, teacherId],
    );
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapSubmissionRow(r: any): SubmissionRecord {
  return {
    id: r.id,
    studentId: r.student_id,
    studentName: r.student_name,
    studentUsername: r.student_username,
    assignmentId: r.assignment_id,
    examId: r.exam_id,
    examTitle: r.exam_title,
    grade: Number(r.grade) as GradeLevel,
    category: r.category as ExamCategory,
    mode: r.mode === 'practice' ? 'practice' : 'exam',
    score: Number(r.score),
    correctCount: Number(r.correct_count),
    totalQuestions: Number(r.total_questions),
    durationSeconds: Number(r.duration_seconds),
    submittedAt: r.submitted_at.toISOString(),
  };
}
