import pg from 'pg';
import type {
  AccountPublic,
  AssignmentInfo,
  Exam,
  ExamCategory,
  GradeLevel,
  NotificationItem,
  Question,
  ResultReleaseMode,
  StudentSummary,
  SubjectId,
  SubmissionRecord,
  TextbookSeries,
  TheoryNote,
  UserAnswer,
  UserRole,
} from '../../shared/types.js';
import { generateId, generateTeacherCode, hashToken, SESSION_TTL_DAYS } from './auth.js';

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
      teacher_id TEXT REFERENCES luyende.accounts(id) ON DELETE SET NULL,
      teacher_code TEXT UNIQUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`ALTER TABLE luyende.accounts ADD COLUMN IF NOT EXISTS teacher_id TEXT REFERENCES luyende.accounts(id) ON DELETE SET NULL`);
  await pool.query(`ALTER TABLE luyende.accounts ADD COLUMN IF NOT EXISTS teacher_code TEXT UNIQUE`);
  // Gán mã gia sư cho các tài khoản giáo viên cũ chưa có mã
  const teachersNoCode = await pool.query(`SELECT id FROM luyende.accounts WHERE role = 'teacher' AND teacher_code IS NULL`);
  for (const row of teachersNoCode.rows) {
    await pool.query(`UPDATE luyende.accounts SET teacher_code = $2 WHERE id = $1`, [row.id, generateTeacherCode()]).catch(() => {});
  }
  // Gán các học sinh cũ chưa có teacher_id vào giáo viên đầu tiên
  await pool.query(`
    UPDATE luyende.accounts
    SET teacher_id = (SELECT id FROM luyende.accounts WHERE role = 'teacher' ORDER BY created_at ASC LIMIT 1)
    WHERE role = 'student' AND teacher_id IS NULL
  `).catch(() => {});
  // Dọn phiên đăng nhập đã hết hạn
  await pool.query(`DELETE FROM luyende.sessions WHERE expires_at < NOW()`).catch(() => {});

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
  await pool.query(
    `ALTER TABLE luyende.assignments ADD COLUMN IF NOT EXISTS result_mode TEXT NOT NULL DEFAULT 'immediate'`,
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
      teacher_note TEXT NOT NULL DEFAULT '',
      question_notes JSONB NOT NULL DEFAULT '{}'::jsonb,
      adjusted_score NUMERIC(5, 2),
      submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      reviewed_at TIMESTAMPTZ,
      feedback_at TIMESTAMPTZ,
      published_at TIMESTAMPTZ
    )
  `);
  await pool.query(`ALTER TABLE luyende.submissions ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ`);
  await pool.query(`ALTER TABLE luyende.submissions ADD COLUMN IF NOT EXISTS teacher_note TEXT NOT NULL DEFAULT ''`);
  await pool.query(`ALTER TABLE luyende.submissions ADD COLUMN IF NOT EXISTS question_notes JSONB NOT NULL DEFAULT '{}'::jsonb`);
  await pool.query(`ALTER TABLE luyende.submissions ADD COLUMN IF NOT EXISTS adjusted_score NUMERIC(5, 2)`);
  await pool.query(`ALTER TABLE luyende.submissions ADD COLUMN IF NOT EXISTS feedback_at TIMESTAMPTZ`);
  await pool.query(`ALTER TABLE luyende.submissions ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ`);
  // Existing historical submissions without published_at default to published so older history stays visible
  await pool.query(`UPDATE luyende.submissions SET published_at = submitted_at WHERE published_at IS NULL AND assignment_id IS NULL`).catch(() => {});
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_submissions_student ON luyende.submissions(student_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_submissions_assignment ON luyende.submissions(assignment_id)`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS luyende.theory_notes (
      id TEXT PRIMARY KEY,
      teacher_id TEXT NOT NULL REFERENCES luyende.accounts(id) ON DELETE CASCADE,
      student_id TEXT REFERENCES luyende.accounts(id) ON DELETE CASCADE,
      subject_id TEXT NOT NULL DEFAULT 'toan',
      grade SMALLINT NOT NULL,
      title TEXT NOT NULL,
      summary TEXT NOT NULL DEFAULT '',
      content TEXT NOT NULL DEFAULT '',
      image_data_url TEXT,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

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

export async function findTeacherByCode(code: string): Promise<string | null> {
  const db = requirePool();
  const res = await db.query<{ id: string }>(
    `SELECT id FROM luyende.accounts WHERE role = 'teacher' AND UPPER(teacher_code) = UPPER($1) LIMIT 1`,
    [code.trim()],
  );
  return res.rows[0]?.id ?? null;
}

export async function getSingleTeacherId(): Promise<string | null> {
  const db = requirePool();
  const res = await db.query<{ id: string }>(`SELECT id FROM luyende.accounts WHERE role = 'teacher' ORDER BY created_at ASC LIMIT 2`);
  if (res.rows.length === 1) return res.rows[0].id;
  return null;
}

export async function createAccount(input: {
  username: string;
  fullName: string;
  passwordHash: string;
  role: UserRole;
  grade: GradeLevel | null;
  teacherId?: string | null;
}): Promise<AccountPublic> {
  const db = requirePool();
  const id = generateId('acc');
  const teacherCode = input.role === 'teacher' ? generateTeacherCode() : null;
  const res = await db.query(
    `INSERT INTO luyende.accounts (id, username, full_name, password_hash, role, grade, teacher_id, teacher_code)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id, username, full_name, role, grade, teacher_id, teacher_code, created_at`,
    [id, input.username, input.fullName, input.passwordHash, input.role, input.grade, input.teacherId ?? null, teacherCode],
  );
  const r = res.rows[0];
  return {
    id: r.id,
    username: r.username,
    fullName: r.full_name,
    role: r.role,
    grade: r.grade ? (Number(r.grade) as GradeLevel) : null,
    teacherId: r.teacher_id ?? null,
    teacherCode: r.teacher_code ?? null,
    createdAt: r.created_at.toISOString(),
  };
}

export async function findAccountByUsername(username: string): Promise<(AccountPublic & { passwordHash: string }) | null> {
  const db = requirePool();
  const res = await db.query(
    `SELECT id, username, full_name, password_hash, role, grade, teacher_id, teacher_code, created_at
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
    teacherId: r.teacher_id ?? null,
    teacherCode: r.teacher_code ?? null,
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
    `SELECT a.id, a.username, a.full_name, a.role, a.grade, a.teacher_id, a.teacher_code, a.created_at
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
    teacherId: r.teacher_id ?? null,
    teacherCode: r.teacher_code ?? null,
    createdAt: r.created_at.toISOString(),
  };
}

// --- STUDENTS & ASSIGNMENTS (STRICT PER-TEACHER ISOLATION) ---

export async function deleteStudentAccount(teacherId: string, studentId: string): Promise<boolean> {
  const db = requirePool();
  const res = await db.query(
    `DELETE FROM luyende.accounts WHERE id = $1 AND role = 'student' AND teacher_id = $2`,
    [studentId, teacherId],
  );
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
  resultMode: ResultReleaseMode;
}): Promise<AssignmentInfo> {
  const db = requirePool();
  let studentName: string | undefined;
  if (input.studentId) {
    const st = await db.query(
      `SELECT full_name FROM luyende.accounts WHERE id = $1 AND role = 'student' AND teacher_id = $2`,
      [input.studentId, input.teacherId],
    );
    if (st.rows.length === 0) throw new Error('Không tìm thấy học sinh thuộc quản lý của bạn.');
    studentName = st.rows[0].full_name;
  }

  const id = generateId('asg');
  const res = await db.query(
    `INSERT INTO luyende.assignments (id, teacher_id, student_id, exam_id, exam_title, grade, note, due_at, result_mode)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING id, teacher_id, student_id, exam_id, exam_title, grade, note, due_at, result_mode, created_at`,
    [
      id,
      input.teacherId,
      input.studentId,
      input.examId,
      input.examTitle,
      input.grade,
      input.note,
      input.dueAt,
      input.resultMode,
    ],
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
    resultMode: r.result_mode === 'after-review' ? 'after-review' : 'immediate',
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
  studentRole: UserRole;
  studentTeacherId: string | null;
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
}): Promise<{ id: string; submittedAt: string; published: boolean }> {
  const db = requirePool();
  let validAssignmentId = input.assignmentId;
  let releaseMode: ResultReleaseMode = 'immediate';

  if (input.studentRole === 'student') {
    // Kiểm tra chống bypass: học sinh chỉ được nộp đề đã được gia sư của mình giao
    if (!input.studentTeacherId) {
      throw new Error('Tài khoản học sinh chưa được gắn với gia sư.');
    }
    const asgCheck = validAssignmentId
      ? await db.query(
          `SELECT id, result_mode FROM luyende.assignments
           WHERE id = $1 AND teacher_id = $2 AND (student_id IS NULL OR student_id = $3) AND exam_id = $4`,
          [validAssignmentId, input.studentTeacherId, input.studentId, input.examId],
        )
      : await db.query(
          `SELECT id, result_mode FROM luyende.assignments
           WHERE teacher_id = $1 AND (student_id IS NULL OR student_id = $2) AND exam_id = $3
           ORDER BY created_at DESC LIMIT 1`,
          [input.studentTeacherId, input.studentId, input.examId],
        );

    if (asgCheck.rows.length === 0) {
      throw new Error('Đề kiểm tra này chưa được gia sư giao cho bạn.');
    }
    validAssignmentId = asgCheck.rows[0].id;
    if (asgCheck.rows[0].result_mode === 'after-review') {
      releaseMode = 'after-review';
    }
  } else if (validAssignmentId) {
    const chk = await db.query(`SELECT id, result_mode FROM luyende.assignments WHERE id = $1`, [validAssignmentId]);
    if (chk.rows.length === 0) validAssignmentId = null;
  }

  const published = releaseMode === 'immediate';
  const id = generateId('sub');
  const res = await db.query(
    `INSERT INTO luyende.submissions (
      id, student_id, assignment_id, exam_id, exam_title, grade, category, mode,
      score, correct_count, total_questions, duration_seconds, answers, published_at
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb, ${published ? 'NOW()' : 'NULL'})
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
  return { id: res.rows[0].id, submittedAt: res.rows[0].submitted_at.toISOString(), published };
}

// --- DASHBOARDS ---

export async function getStudentDashboard(student: AccountPublic): Promise<{
  assignments: AssignmentInfo[];
  submissions: SubmissionRecord[];
}> {
  const db = requirePool();

  const asgRes = student.teacherId
    ? await db.query(
        `SELECT asg.id, asg.teacher_id, t.full_name AS teacher_name, asg.student_id,
                asg.exam_id, asg.exam_title, asg.grade, asg.note, asg.due_at, asg.result_mode, asg.created_at,
                (SELECT MAX(COALESCE(s.adjusted_score, s.score)) FROM luyende.submissions s
                 WHERE s.student_id = $1 AND s.published_at IS NOT NULL AND (s.assignment_id = asg.id OR s.exam_id = asg.exam_id)) AS my_best_score,
                (SELECT MAX(s.submitted_at) FROM luyende.submissions s
                 WHERE s.student_id = $1 AND (s.assignment_id = asg.id OR s.exam_id = asg.exam_id)) AS my_submitted_at,
                EXISTS(SELECT 1 FROM luyende.submissions s
                 WHERE s.student_id = $1 AND s.published_at IS NULL AND (s.assignment_id = asg.id OR s.exam_id = asg.exam_id)) AS my_pending_review
         FROM luyende.assignments asg
         JOIN luyende.accounts t ON t.id = asg.teacher_id
         WHERE asg.teacher_id = $2 AND (asg.student_id IS NULL OR asg.student_id = $1)
         ORDER BY asg.created_at DESC`,
        [student.id, student.teacherId],
      )
    : { rows: [] };

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
    resultMode: r.result_mode === 'after-review' ? 'after-review' : 'immediate',
    createdAt: r.created_at.toISOString(),
    myBestScore: r.my_best_score !== null ? Number(r.my_best_score) : null,
    mySubmittedAt: r.my_submitted_at ? r.my_submitted_at.toISOString() : null,
    myPendingReview: Boolean(r.my_pending_review),
  }));

  const subRes = await db.query(
    `SELECT s.id, s.student_id, a.full_name AS student_name, a.username AS student_username,
            s.assignment_id, s.exam_id, s.exam_title, s.grade, s.category, s.mode,
            s.score, s.adjusted_score, s.correct_count, s.total_questions, s.duration_seconds,
            s.teacher_note, s.submitted_at, s.reviewed_at, s.feedback_at, s.published_at
     FROM luyende.submissions s
     JOIN luyende.accounts a ON a.id = s.student_id
     WHERE s.student_id = $1
     ORDER BY s.submitted_at DESC
     LIMIT 100`,
    [student.id],
  );

  // Chống lộ điểm qua DevTools Network khi bài chưa được gia sư công bố (published_at IS NULL)
  const submissions = subRes.rows.map((r) => {
    const mapped = mapSubmissionRow(r);
    if (!mapped.publishedAt && student.role === 'student') {
      return { ...mapped, score: 0, adjustedScore: null, correctCount: 0, teacherNote: '' };
    }
    return mapped;
  });

  return { assignments, submissions };
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
            AVG(COALESCE(s.adjusted_score, s.score)) AS avg_score
     FROM luyende.accounts a
     LEFT JOIN luyende.submissions s ON s.student_id = a.id
     WHERE a.role = 'student' AND a.teacher_id = $1
     GROUP BY a.id
     ORDER BY a.created_at DESC`,
    [teacherId],
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
            asg.exam_id, asg.exam_title, asg.grade, asg.note, asg.due_at, asg.result_mode, asg.created_at,
            (SELECT COUNT(DISTINCT s.student_id)
             FROM luyende.submissions s
             JOIN luyende.accounts sa ON sa.id = s.student_id AND sa.teacher_id = $1
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
    resultMode: r.result_mode === 'after-review' ? 'after-review' : 'immediate',
    createdAt: r.created_at.toISOString(),
    submissionCount: Number(r.submission_count),
  }));

  const subRes = await db.query(
    `SELECT s.id, s.student_id, a.full_name AS student_name, a.username AS student_username,
            s.assignment_id, s.exam_id, s.exam_title, s.grade, s.category, s.mode,
            s.score, s.adjusted_score, s.correct_count, s.total_questions, s.duration_seconds,
            s.teacher_note, s.submitted_at, s.reviewed_at, s.feedback_at, s.published_at
     FROM luyende.submissions s
     JOIN luyende.accounts a ON a.id = s.student_id
     WHERE a.role = 'student' AND a.teacher_id = $1
     ORDER BY s.submitted_at DESC
     LIMIT 300`,
    [teacherId],
  );

  return { students, assignments, submissions: subRes.rows.map(mapSubmissionRow) };
}

export async function getSubmissionForTeacher(teacherId: string, submissionId: string): Promise<SubmissionRecord | null> {
  const db = requirePool();
  const res = await db.query(
    `SELECT s.id, s.student_id, a.full_name AS student_name, a.username AS student_username,
            s.assignment_id, s.exam_id, s.exam_title, s.grade, s.category, s.mode,
            s.score, s.adjusted_score, s.correct_count, s.total_questions, s.duration_seconds,
            s.answers, s.teacher_note, s.question_notes, s.submitted_at, s.reviewed_at, s.feedback_at, s.published_at
     FROM luyende.submissions s
     JOIN luyende.accounts a ON a.id = s.student_id
     WHERE s.id = $1 AND a.teacher_id = $2
     LIMIT 1`,
    [submissionId, teacherId],
  );
  if (res.rows.length === 0) return null;
  await db.query(`UPDATE luyende.submissions SET reviewed_at = COALESCE(reviewed_at, NOW()) WHERE id = $1`, [
    submissionId,
  ]);
  const r = res.rows[0];
  return {
    ...mapSubmissionRow(r),
    reviewedAt: r.reviewed_at ? r.reviewed_at.toISOString() : new Date().toISOString(),
    answers: r.answers as Record<string, UserAnswer>,
    questionNotes: (r.question_notes ?? {}) as Record<string, string>,
  };
}

export async function getSubmissionForStudent(studentId: string, submissionId: string): Promise<SubmissionRecord | null> {
  const db = requirePool();
  const res = await db.query(
    `SELECT s.id, s.student_id, a.full_name AS student_name, a.username AS student_username,
            s.assignment_id, s.exam_id, s.exam_title, s.grade, s.category, s.mode,
            s.score, s.adjusted_score, s.correct_count, s.total_questions, s.duration_seconds,
            s.answers, s.teacher_note, s.question_notes, s.submitted_at, s.reviewed_at, s.feedback_at, s.published_at
     FROM luyende.submissions s
     JOIN luyende.accounts a ON a.id = s.student_id
     WHERE s.id = $1 AND s.student_id = $2
     LIMIT 1`,
    [submissionId, studentId],
  );
  if (res.rows.length === 0) return null;
  const r = res.rows[0];
  if (!r.published_at) {
    return null;
  }
  return {
    ...mapSubmissionRow(r),
    answers: r.answers as Record<string, UserAnswer>,
    questionNotes: (r.question_notes ?? {}) as Record<string, string>,
  };
}

export async function saveSubmissionFeedback(
  teacherId: string,
  submissionId: string,
  input: {
    teacherNote: string;
    questionNotes: Record<string, string>;
    adjustedScore: number | null;
    publishResult?: boolean;
  },
): Promise<SubmissionRecord | null> {
  const db = requirePool();
  // Kiểm tra học sinh nộp bài này thuộc quyền quản lý của giáo viên
  const own = await db.query(
    `SELECT s.id FROM luyende.submissions s
     JOIN luyende.accounts a ON a.id = s.student_id
     WHERE s.id = $1 AND a.teacher_id = $2`,
    [submissionId, teacherId],
  );
  if (own.rows.length === 0) return null;

  const cleanNotes: Record<string, string> = {};
  for (const [k, v] of Object.entries(input.questionNotes ?? {})) {
    const trimmed = String(v ?? '').trim();
    if (trimmed) cleanNotes[k] = trimmed.slice(0, 1000);
  }
  const adj =
    input.adjustedScore !== null && Number.isFinite(input.adjustedScore)
      ? Math.max(0, Math.min(10, Math.round(input.adjustedScore * 100) / 100))
      : null;

  const publishSql = input.publishResult ? ', published_at = COALESCE(published_at, NOW())' : '';

  await db.query(
    `UPDATE luyende.submissions
     SET teacher_note = $2,
         question_notes = $3::jsonb,
         adjusted_score = $4,
         reviewed_at = COALESCE(reviewed_at, NOW()),
         feedback_at = NOW()
         ${publishSql}
     WHERE id = $1`,
    [submissionId, (input.teacherNote ?? '').trim().slice(0, 2000), JSON.stringify(cleanNotes), adj],
  );
  return getSubmissionForTeacher(teacherId, submissionId);
}

export async function markAllSubmissionsReviewed(teacherId: string): Promise<void> {
  const db = requirePool();
  await db.query(
    `UPDATE luyende.submissions s
     SET reviewed_at = NOW()
     FROM luyende.accounts a
     WHERE s.student_id = a.id AND a.teacher_id = $1 AND s.reviewed_at IS NULL`,
    [teacherId],
  );
}

export async function getNotificationsForUser(user: AccountPublic): Promise<NotificationItem[]> {
  const db = requirePool();
  const items: NotificationItem[] = [];

  if (user.role === 'teacher') {
    // 1. Bài làm mới của HỌC SINH THUỘC GIÁO VIÊN NÀY nộp chưa xem
    const unrev = await db.query(
      `SELECT s.id, a.full_name AS student_name, s.exam_title, s.score, s.submitted_at
       FROM luyende.submissions s
       JOIN luyende.accounts a ON a.id = s.student_id
       WHERE a.role = 'student' AND a.teacher_id = $1 AND s.reviewed_at IS NULL
       ORDER BY s.submitted_at DESC
       LIMIT 20`,
      [user.id],
    );
    for (const r of unrev.rows) {
      items.push({
        id: `sub-${r.id}`,
        kind: 'new-submission',
        title: `${r.student_name} vừa nộp bài (${Number(r.score).toFixed(2)}đ)`,
        detail: r.exam_title,
        link: `/giao-vien?inspect=${r.id}`,
        urgent: false,
        timestamp: r.submitted_at.toISOString(),
        submissionId: r.id,
      });
    }

    // 2. Bài đã giao quá hạn mà chưa có học sinh nào nộp
    const overdue = await db.query(
      `SELECT asg.id, asg.exam_title, asg.due_at, COALESCE(st.full_name, 'Học sinh') AS student_name
       FROM luyende.assignments asg
       LEFT JOIN luyende.accounts st ON st.id = asg.student_id
       WHERE asg.teacher_id = $1
         AND asg.due_at IS NOT NULL
         AND asg.due_at < NOW()
         AND NOT EXISTS (
           SELECT 1 FROM luyende.submissions s
           WHERE (s.assignment_id = asg.id OR s.exam_id = asg.exam_id)
             AND (asg.student_id IS NULL OR s.student_id = asg.student_id)
         )
       ORDER BY asg.due_at DESC
       LIMIT 10`,
      [user.id],
    );
    for (const r of overdue.rows) {
      items.push({
        id: `ov-${r.id}`,
        kind: 'overdue-assignment',
        title: `${r.student_name} chưa nộp bài (đã quá hạn)`,
        detail: r.exam_title,
        link: '/giao-vien',
        urgent: true,
        timestamp: r.due_at.toISOString(),
      });
    }
  } else {
    // Học sinh: chỉ các đề của GIA SƯ CỦA MÌNH giao nhưng chưa nộp
    const pending = user.teacherId
      ? await db.query(
          `SELECT asg.id, asg.exam_id, asg.exam_title, asg.due_at, asg.created_at, asg.note
           FROM luyende.assignments asg
           WHERE asg.teacher_id = $2 AND (asg.student_id IS NULL OR asg.student_id = $1)
             AND NOT EXISTS (
               SELECT 1 FROM luyende.submissions s
               WHERE s.student_id = $1 AND (s.assignment_id = asg.id OR s.exam_id = asg.exam_id)
             )
           ORDER BY asg.due_at ASC NULLS LAST, asg.created_at DESC
           LIMIT 20`,
          [user.id, user.teacherId],
        )
      : { rows: [] };
    const now = Date.now();
    for (const r of pending.rows) {
      const dueMs = r.due_at ? new Date(r.due_at).getTime() : null;
      const isOverdue = dueMs !== null && dueMs < now;
      const isDueSoon = dueMs !== null && !isOverdue && dueMs - now < 24 * 60 * 60 * 1000;
      items.push({
        id: `asg-${r.id}`,
        kind: isOverdue ? 'overdue-assignment' : 'pending-assignment',
        title: isOverdue
          ? `Quá hạn: ${r.exam_title}`
          : isDueSoon
            ? `Sắp hết hạn: ${r.exam_title}`
            : `Bài mới cần làm: ${r.exam_title}`,
        detail: r.due_at
          ? `Hạn nộp: ${new Date(r.due_at).toLocaleString('vi-VN')}${r.note ? ` · ${r.note}` : ''}`
          : r.note || 'Bấm để vào làm bài ngay',
        link: `/de/${r.exam_id}?mode=exam&assignment=${r.id}`,
        urgent: isOverdue || isDueSoon,
        timestamp: (r.due_at ?? r.created_at).toISOString(),
      });
    }

    // Học sinh: bài làm vừa được gia sư chữa & công bố trong 7 ngày gần đây
    const fbRes = await db.query(
      `SELECT id, exam_title, teacher_note, adjusted_score, score, COALESCE(feedback_at, published_at) AS notified_at
       FROM luyende.submissions
       WHERE student_id = $1 AND published_at IS NOT NULL
         AND (feedback_at IS NOT NULL OR published_at > submitted_at + INTERVAL '5 seconds')
         AND COALESCE(feedback_at, published_at) > NOW() - INTERVAL '7 days'
       ORDER BY COALESCE(feedback_at, published_at) DESC
       LIMIT 5`,
      [user.id],
    );
    for (const r of fbRes.rows) {
      const finalScore = r.adjusted_score !== null ? Number(r.adjusted_score) : Number(r.score);
      items.push({
        id: `fb-${r.id}`,
        kind: 'teacher-feedback',
        title: `Gia sư đã công bố & chữa bài: ${r.exam_title} (${finalScore.toFixed(2)}đ)`,
        detail: r.teacher_note || 'Bấm để xem điểm và nhận xét chữa bài của gia sư',
        link: `/lich-su?xem=${r.id}`,
        urgent: false,
        timestamp: r.notified_at.toISOString(),
        submissionId: r.id,
      });
    }
  }

  return items;
}

// --- CUSTOM & EDITED EXAMS ---

export interface StoredExamRow {
  exam: Exam;
  isDeleted: boolean;
  teacherId: string;
  updatedAt: string;
}

export async function listStoredExamsForTeacher(teacherId: string | null): Promise<StoredExamRow[]> {
  if (!pool || !teacherId) return [];
  const res = await pool.query(
    `SELECT id, teacher_id, subject_id, grade, title, subtitle, category, textbook,
            duration_minutes, source_note, topics, questions, is_deleted, updated_at
     FROM luyende.custom_exams
     WHERE teacher_id = $1
     ORDER BY updated_at DESC`,
    [teacherId],
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
      schoolYear: '2026-2027',
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
  // Không cho giáo viên khác ghi đè đề của giáo viên khác
  const existing = await db.query<{ teacher_id: string }>(
    `SELECT teacher_id FROM luyende.custom_exams WHERE id = $1`,
    [id],
  );
  if (existing.rows.length > 0 && existing.rows[0].teacher_id !== teacherId) {
    throw new Error('Bạn không có quyền chỉnh sửa đề của giáo viên khác.');
  }
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
      schoolYear: '2026-2027',
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
    await db.query(`DELETE FROM luyende.custom_exams WHERE id = $1 AND teacher_id = $2`, [examId, teacherId]);
  } else {
    const existing = await db.query<{ teacher_id: string }>(
      `SELECT teacher_id FROM luyende.custom_exams WHERE id = $1`,
      [examId],
    );
    if (existing.rows.length > 0 && existing.rows[0].teacher_id !== teacherId) {
      throw new Error('Bạn không có quyền ẩn đề của giáo viên khác.');
    }
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
    adjustedScore: r.adjusted_score !== null && r.adjusted_score !== undefined ? Number(r.adjusted_score) : null,
    correctCount: Number(r.correct_count),
    totalQuestions: Number(r.total_questions),
    durationSeconds: Number(r.duration_seconds),
    teacherNote: r.teacher_note ?? '',
    submittedAt: r.submitted_at.toISOString(),
    reviewedAt: r.reviewed_at ? r.reviewed_at.toISOString() : null,
    feedbackAt: r.feedback_at ? r.feedback_at.toISOString() : null,
    publishedAt: r.published_at ? r.published_at.toISOString() : null,
  };
}

// --- THEORY NOTES (BỘ LÝ THUYẾT) ---

export async function listTheoryNotesForUser(user: AccountPublic): Promise<TheoryNote[]> {
  const db = requirePool();
  const res =
    user.role === 'teacher'
      ? await db.query(
          `SELECT n.id, n.teacher_id, t.full_name AS teacher_name, n.student_id, st.full_name AS student_name,
                  n.subject_id, n.grade, n.title, n.summary, n.content, n.image_data_url, n.updated_at
           FROM luyende.theory_notes n
           JOIN luyende.accounts t ON t.id = n.teacher_id
           LEFT JOIN luyende.accounts st ON st.id = n.student_id
           WHERE n.teacher_id = $1
           ORDER BY n.updated_at DESC`,
          [user.id],
        )
      : user.teacherId
        ? await db.query(
            `SELECT n.id, n.teacher_id, t.full_name AS teacher_name, n.student_id, NULL AS student_name,
                    n.subject_id, n.grade, n.title, n.summary, n.content, n.image_data_url, n.updated_at
             FROM luyende.theory_notes n
             JOIN luyende.accounts t ON t.id = n.teacher_id
             WHERE n.teacher_id = $2 AND (n.student_id IS NULL OR n.student_id = $1)
             ORDER BY n.updated_at DESC`,
            [user.id, user.teacherId],
          )
        : { rows: [] };

  return res.rows.map((r) => ({
    id: r.id,
    teacherId: r.teacher_id,
    teacherName: r.teacher_name,
    studentId: r.student_id ?? null,
    studentName: r.student_name ?? 'Tất cả học sinh',
    subjectId: (r.subject_id || 'toan') as SubjectId,
    grade: Number(r.grade) as GradeLevel,
    title: r.title,
    summary: r.summary ?? '',
    content: r.content ?? '',
    imageDataUrl: r.image_data_url ?? null,
    updatedAt: r.updated_at.toISOString(),
  }));
}

export async function upsertTheoryNote(
  teacherId: string,
  input: {
    id?: string;
    studentId: string | null;
    subjectId: SubjectId;
    grade: GradeLevel;
    title: string;
    summary: string;
    content: string;
    imageDataUrl: string | null;
  },
): Promise<TheoryNote> {
  const db = requirePool();
  const id = input.id?.trim() || generateId('thy');
  const existing = await db.query<{ teacher_id: string }>(
    `SELECT teacher_id FROM luyende.theory_notes WHERE id = $1`,
    [id],
  );
  if (existing.rows.length > 0 && existing.rows[0].teacher_id !== teacherId) {
    throw new Error('Bạn không có quyền sửa bài lý thuyết của giáo viên khác.');
  }
  if (input.studentId) {
    const st = await db.query(`SELECT id FROM luyende.accounts WHERE id = $1 AND role = 'student' AND teacher_id = $2`, [
      input.studentId,
      teacherId,
    ]);
    if (st.rows.length === 0) throw new Error('Học sinh này không thuộc quản lý của bạn.');
  }
  const res = await db.query(
    `INSERT INTO luyende.theory_notes (
       id, teacher_id, student_id, subject_id, grade, title, summary, content, image_data_url, updated_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW())
     ON CONFLICT (id) DO UPDATE SET
       student_id = $3,
       subject_id = $4,
       grade = $5,
       title = $6,
       summary = $7,
       content = $8,
       image_data_url = $9,
       updated_at = NOW()
     RETURNING id, teacher_id, student_id, subject_id, grade, title, summary, content, image_data_url, updated_at`,
    [
      id,
      teacherId,
      input.studentId || null,
      input.subjectId || 'toan',
      input.grade,
      input.title.trim().slice(0, 180),
      (input.summary ?? '').trim().slice(0, 400),
      (input.content ?? '').slice(0, 30000),
      input.imageDataUrl && input.imageDataUrl.startsWith('data:image/') ? input.imageDataUrl : null,
    ],
  );
  const r = res.rows[0];
  return {
    id: r.id,
    teacherId: r.teacher_id,
    studentId: r.student_id ?? null,
    subjectId: r.subject_id as SubjectId,
    grade: Number(r.grade) as GradeLevel,
    title: r.title,
    summary: r.summary ?? '',
    content: r.content ?? '',
    imageDataUrl: r.image_data_url ?? null,
    updatedAt: r.updated_at.toISOString(),
  };
}

export async function deleteTheoryNote(teacherId: string, noteId: string): Promise<boolean> {
  const db = requirePool();
  const res = await db.query(`DELETE FROM luyende.theory_notes WHERE id = $1 AND teacher_id = $2`, [noteId, teacherId]);
  return (res.rowCount ?? 0) > 0;
}
