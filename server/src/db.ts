import pg from 'pg';
import type {
  AccountPublic,
  AssignmentInfo,
  ClassMemberInfo,
  ClassroomInfo,
  ExamCategory,
  GradeLevel,
  SubmissionRecord,
  UserAnswer,
  UserRole,
} from '../../shared/types.js';
import { generateClassCode, generateId, hashToken, SESSION_TTL_DAYS } from './auth.js';

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
    CREATE TABLE IF NOT EXISTS luyende.classes (
      id TEXT PRIMARY KEY,
      teacher_id TEXT NOT NULL REFERENCES luyende.accounts(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      grade SMALLINT NOT NULL,
      code TEXT UNIQUE NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS luyende.class_members (
      class_id TEXT NOT NULL REFERENCES luyende.classes(id) ON DELETE CASCADE,
      student_id TEXT NOT NULL REFERENCES luyende.accounts(id) ON DELETE CASCADE,
      joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (class_id, student_id)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS luyende.assignments (
      id TEXT PRIMARY KEY,
      teacher_id TEXT NOT NULL REFERENCES luyende.accounts(id) ON DELETE CASCADE,
      class_id TEXT NOT NULL REFERENCES luyende.classes(id) ON DELETE CASCADE,
      exam_id TEXT NOT NULL,
      exam_title TEXT NOT NULL,
      grade SMALLINT NOT NULL,
      note TEXT NOT NULL DEFAULT '',
      due_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

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

// --- CLASSROOMS ---

export async function createClass(teacherId: string, name: string, grade: GradeLevel): Promise<ClassroomInfo> {
  const db = requirePool();
  const id = generateId('cls');
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateClassCode(grade);
    try {
      const res = await db.query(
        `INSERT INTO luyende.classes (id, teacher_id, name, grade, code)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, teacher_id, name, grade, code, created_at`,
        [id, teacherId, name, grade, code],
      );
      const r = res.rows[0];
      return {
        id: r.id,
        teacherId: r.teacher_id,
        name: r.name,
        grade: Number(r.grade) as GradeLevel,
        code: r.code,
        studentCount: 0,
        createdAt: r.created_at.toISOString(),
      };
    } catch (e) {
      if ((e as { code?: string }).code !== '23505') throw e;
    }
  }
  throw new Error('Không tạo được mã lớp, vui lòng thử lại.');
}

export async function deleteClass(teacherId: string, classId: string): Promise<boolean> {
  const db = requirePool();
  const res = await db.query(`DELETE FROM luyende.classes WHERE id = $1 AND teacher_id = $2`, [classId, teacherId]);
  return (res.rowCount ?? 0) > 0;
}

export async function joinClassByCode(studentId: string, code: string): Promise<ClassroomInfo | null> {
  const db = requirePool();
  const clsRes = await db.query(
    `SELECT c.id, c.teacher_id, c.name, c.grade, c.code, c.created_at, a.full_name AS teacher_name
     FROM luyende.classes c
     JOIN luyende.accounts a ON a.id = c.teacher_id
     WHERE UPPER(c.code) = UPPER($1)`,
    [code.trim()],
  );
  const c = clsRes.rows[0];
  if (!c) return null;

  await db.query(
    `INSERT INTO luyende.class_members (class_id, student_id)
     VALUES ($1, $2)
     ON CONFLICT (class_id, student_id) DO NOTHING`,
    [c.id, studentId],
  );

  const cntRes = await db.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM luyende.class_members WHERE class_id = $1`,
    [c.id],
  );

  return {
    id: c.id,
    teacherId: c.teacher_id,
    teacherName: c.teacher_name,
    name: c.name,
    grade: Number(c.grade) as GradeLevel,
    code: c.code,
    studentCount: Number(cntRes.rows[0]?.count ?? 1),
    createdAt: c.created_at.toISOString(),
  };
}

// --- ASSIGNMENTS ---

export async function createAssignment(input: {
  teacherId: string;
  classId: string;
  examId: string;
  examTitle: string;
  grade: GradeLevel;
  note: string;
  dueAt: string | null;
}): Promise<AssignmentInfo> {
  const db = requirePool();
  // Verify teacher owns class
  const own = await db.query(`SELECT name FROM luyende.classes WHERE id = $1 AND teacher_id = $2`, [
    input.classId,
    input.teacherId,
  ]);
  if (own.rows.length === 0) throw new Error('Bạn không có quyền giao bài cho lớp này.');

  const id = generateId('asg');
  const res = await db.query(
    `INSERT INTO luyende.assignments (id, teacher_id, class_id, exam_id, exam_title, grade, note, due_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id, teacher_id, class_id, exam_id, exam_title, grade, note, due_at, created_at`,
    [id, input.teacherId, input.classId, input.examId, input.examTitle, input.grade, input.note, input.dueAt],
  );
  const r = res.rows[0];
  return {
    id: r.id,
    teacherId: r.teacher_id,
    classId: r.class_id,
    className: own.rows[0].name,
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
  classes: ClassroomInfo[];
  assignments: AssignmentInfo[];
  submissions: SubmissionRecord[];
}> {
  const db = requirePool();

  const clsRes = await db.query(
    `SELECT c.id, c.teacher_id, a.full_name AS teacher_name, c.name, c.grade, c.code, c.created_at,
            (SELECT COUNT(*) FROM luyende.class_members cm2 WHERE cm2.class_id = c.id)::int AS student_count
     FROM luyende.class_members cm
     JOIN luyende.classes c ON c.id = cm.class_id
     JOIN luyende.accounts a ON a.id = c.teacher_id
     WHERE cm.student_id = $1
     ORDER BY cm.joined_at DESC`,
    [studentId],
  );

  const classes: ClassroomInfo[] = clsRes.rows.map((r) => ({
    id: r.id,
    teacherId: r.teacher_id,
    teacherName: r.teacher_name,
    name: r.name,
    grade: Number(r.grade) as GradeLevel,
    code: r.code,
    studentCount: Number(r.student_count),
    createdAt: r.created_at.toISOString(),
  }));

  const asgRes = await db.query(
    `SELECT asg.id, asg.teacher_id, t.full_name AS teacher_name, asg.class_id, c.name AS class_name,
            asg.exam_id, asg.exam_title, asg.grade, asg.note, asg.due_at, asg.created_at,
            (SELECT MAX(s.score) FROM luyende.submissions s
             WHERE s.student_id = $1 AND (s.assignment_id = asg.id OR s.exam_id = asg.exam_id)) AS my_best_score,
            (SELECT MAX(s.submitted_at) FROM luyende.submissions s
             WHERE s.student_id = $1 AND (s.assignment_id = asg.id OR s.exam_id = asg.exam_id)) AS my_submitted_at
     FROM luyende.class_members cm
     JOIN luyende.assignments asg ON asg.class_id = cm.class_id
     JOIN luyende.classes c ON c.id = asg.class_id
     JOIN luyende.accounts t ON t.id = asg.teacher_id
     WHERE cm.student_id = $1
     ORDER BY asg.created_at DESC`,
    [studentId],
  );

  const assignments: AssignmentInfo[] = asgRes.rows.map((r) => ({
    id: r.id,
    teacherId: r.teacher_id,
    teacherName: r.teacher_name,
    classId: r.class_id,
    className: r.class_name,
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
            s.assignment_id, asg.class_id, c.name AS class_name,
            s.exam_id, s.exam_title, s.grade, s.category, s.mode,
            s.score, s.correct_count, s.total_questions, s.duration_seconds, s.submitted_at
     FROM luyende.submissions s
     JOIN luyende.accounts a ON a.id = s.student_id
     LEFT JOIN luyende.assignments asg ON asg.id = s.assignment_id
     LEFT JOIN luyende.classes c ON c.id = asg.class_id
     WHERE s.student_id = $1
     ORDER BY s.submitted_at DESC
     LIMIT 100`,
    [studentId],
  );

  const submissions: SubmissionRecord[] = subRes.rows.map(mapSubmissionRow);

  return { classes, assignments, submissions };
}

export async function getTeacherDashboard(teacherId: string): Promise<{
  classes: ClassroomInfo[];
  membersByClass: Record<string, ClassMemberInfo[]>;
  assignments: AssignmentInfo[];
  submissions: SubmissionRecord[];
}> {
  const db = requirePool();

  const clsRes = await db.query(
    `SELECT c.id, c.teacher_id, c.name, c.grade, c.code, c.created_at,
            (SELECT COUNT(*) FROM luyende.class_members cm WHERE cm.class_id = c.id)::int AS student_count
     FROM luyende.classes c
     WHERE c.teacher_id = $1
     ORDER BY c.created_at DESC`,
    [teacherId],
  );

  const classes: ClassroomInfo[] = clsRes.rows.map((r) => ({
    id: r.id,
    teacherId: r.teacher_id,
    name: r.name,
    grade: Number(r.grade) as GradeLevel,
    code: r.code,
    studentCount: Number(r.student_count),
    createdAt: r.created_at.toISOString(),
  }));

  const memRes = await db.query(
    `SELECT cm.class_id, a.id AS student_id, a.username, a.full_name, a.grade, cm.joined_at
     FROM luyende.class_members cm
     JOIN luyende.classes c ON c.id = cm.class_id
     JOIN luyende.accounts a ON a.id = cm.student_id
     WHERE c.teacher_id = $1
     ORDER BY a.full_name ASC`,
    [teacherId],
  );

  const membersByClass: Record<string, ClassMemberInfo[]> = {};
  for (const r of memRes.rows) {
    if (!membersByClass[r.class_id]) membersByClass[r.class_id] = [];
    membersByClass[r.class_id].push({
      studentId: r.student_id,
      username: r.username,
      fullName: r.full_name,
      grade: r.grade ? (Number(r.grade) as GradeLevel) : null,
      joinedAt: r.joined_at.toISOString(),
    });
  }

  const asgRes = await db.query(
    `SELECT asg.id, asg.teacher_id, asg.class_id, c.name AS class_name,
            asg.exam_id, asg.exam_title, asg.grade, asg.note, asg.due_at, asg.created_at,
            (SELECT COUNT(DISTINCT s.student_id)
             FROM luyende.submissions s
             JOIN luyende.class_members cm ON cm.student_id = s.student_id AND cm.class_id = asg.class_id
             WHERE s.assignment_id = asg.id OR s.exam_id = asg.exam_id)::int AS submission_count
     FROM luyende.assignments asg
     JOIN luyende.classes c ON c.id = asg.class_id
     WHERE asg.teacher_id = $1
     ORDER BY asg.created_at DESC`,
    [teacherId],
  );

  const assignments: AssignmentInfo[] = asgRes.rows.map((r) => ({
    id: r.id,
    teacherId: r.teacher_id,
    classId: r.class_id,
    className: r.class_name,
    examId: r.exam_id,
    examTitle: r.exam_title,
    grade: Number(r.grade) as GradeLevel,
    note: r.note,
    dueAt: r.due_at ? r.due_at.toISOString() : null,
    createdAt: r.created_at.toISOString(),
    submissionCount: Number(r.submission_count),
  }));

  // All submissions by students who belong to any class of this teacher
  const subRes = await db.query(
    `SELECT DISTINCT ON (s.id)
            s.id, s.student_id, a.full_name AS student_name, a.username AS student_username,
            s.assignment_id, c.id AS class_id, c.name AS class_name,
            s.exam_id, s.exam_title, s.grade, s.category, s.mode,
            s.score, s.correct_count, s.total_questions, s.duration_seconds, s.submitted_at
     FROM luyende.submissions s
     JOIN luyende.accounts a ON a.id = s.student_id
     JOIN luyende.class_members cm ON cm.student_id = s.student_id
     JOIN luyende.classes c ON c.id = cm.class_id
     WHERE c.teacher_id = $1
     ORDER BY s.id, s.submitted_at DESC`,
    [teacherId],
  );

  const submissions = subRes.rows
    .map(mapSubmissionRow)
    .sort((x, y) => new Date(y.submittedAt).getTime() - new Date(x.submittedAt).getTime())
    .slice(0, 300);

  return { classes, membersByClass, assignments, submissions };
}

export async function getSubmissionForTeacher(
  teacherId: string,
  submissionId: string,
): Promise<SubmissionRecord | null> {
  const db = requirePool();
  const res = await db.query(
    `SELECT s.id, s.student_id, a.full_name AS student_name, a.username AS student_username,
            s.assignment_id, c.id AS class_id, c.name AS class_name,
            s.exam_id, s.exam_title, s.grade, s.category, s.mode,
            s.score, s.correct_count, s.total_questions, s.duration_seconds, s.answers, s.submitted_at
     FROM luyende.submissions s
     JOIN luyende.accounts a ON a.id = s.student_id
     JOIN luyende.class_members cm ON cm.student_id = s.student_id
     JOIN luyende.classes c ON c.id = cm.class_id
     WHERE s.id = $1 AND c.teacher_id = $2
     LIMIT 1`,
    [submissionId, teacherId],
  );
  if (res.rows.length === 0) return null;
  const r = res.rows[0];
  return {
    ...mapSubmissionRow(r),
    answers: r.answers as Record<string, UserAnswer>,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapSubmissionRow(r: any): SubmissionRecord {
  return {
    id: r.id,
    studentId: r.student_id,
    studentName: r.student_name,
    studentUsername: r.student_username,
    assignmentId: r.assignment_id,
    classId: r.class_id ?? null,
    className: r.class_name ?? null,
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
