import type { IncomingMessage, ServerResponse } from 'node:http';
import type { AccountPublic, Exam, ExamCategory, GradeLevel, UserAnswer, UserRole } from '../../shared/types.js';
import {
  checkRateLimit,
  clearSessionCookie,
  generateSessionToken,
  getClientIp,
  hashPassword,
  parseCookies,
  safeEqualString,
  SESSION_COOKIE,
  setSessionCookie,
  validatePassword,
  validateUsername,
  verifyPassword,
} from './auth.js';
import {
  countTeachers,
  createAccount,
  createAssignment,
  createSession,
  deleteAssignment,
  deleteOrHideStoredExam,
  deleteSession,
  deleteStudentAccount,
  deleteTheoryNote,
  findAccountByUsername,
  findTeacherByCode,
  getAccountBySessionToken,
  getNotificationsForUser,
  getSingleTeacherId,
  getStudentDashboard,
  getSubmissionForStudent,
  getSubmissionForTeacher,
  getTeacherDashboard,
  isDbEnabled,
  listStoredExamsForTeacher,
  listTheoryNotesForUser,
  markAllSubmissionsReviewed,
  saveSubmission,
  saveSubmissionFeedback,
  upsertStoredExam,
  upsertTheoryNote,
} from './db.js';
import {
  applyLiveAction,
  getLiveRoomStateForUser,
  isLiveRoomActiveForTeacher,
  registerLiveClient,
  type LiveActionPayload,
} from './liveRoom.js';

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

async function readJson<T>(req: IncomingMessage, maxBytes = 1024 * 1024): Promise<T> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buf.length;
    if (size > maxBytes) throw new Error('Dữ liệu gửi lên quá lớn.');
    chunks.push(buf);
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  return (raw ? JSON.parse(raw) : {}) as T;
}

async function getCurrentUser(req: IncomingMessage): Promise<{ user: AccountPublic; token: string } | null> {
  const cookies = parseCookies(req);
  const token = cookies[SESSION_COOKIE];
  if (!token) return null;
  const user = await getAccountBySessionToken(token);
  if (!user) return null;
  return { user, token };
}

function isValidGrade(g: unknown): g is GradeLevel {
  return g === 6 || g === 7 || g === 8 || g === 9;
}

export async function handleApi(req: IncomingMessage, res: ServerResponse, path: string) {
  try {
    // Public config
    if (path === '/api/config' && req.method === 'GET') {
      const dbReady = isDbEnabled();
      const teacherCount = dbReady ? await countTeachers() : 0;
      const inviteConfigured = Boolean(process.env.TEACHER_INVITE_CODE?.trim());
      return sendJson(res, 200, {
        dbEnabled: dbReady,
        needsFirstTeacher: dbReady && teacherCount === 0,
        teacherInviteRequired: dbReady && (teacherCount > 0 || inviteConfigured),
        teacherCodeRequiredForStudent: dbReady && teacherCount > 1,
      });
    }

    if (!isDbEnabled()) {
      if (path === '/api/exams' && req.method === 'GET') {
        return sendJson(res, 200, { exams: [] });
      }
      return sendJson(res, 503, { error: 'Máy chủ chưa kết nối cơ sở dữ liệu Postgres (DATABASE_URL).' });
    }

    // Teacher/student scoped custom exams (guests get empty array - no leaking private exams)
    if (path === '/api/exams' && req.method === 'GET') {
      const sess = await getCurrentUser(req);
      if (!sess) return sendJson(res, 200, { exams: [] });
      const tid = sess.user.role === 'teacher' ? sess.user.id : sess.user.teacherId;
      const rows = await listStoredExamsForTeacher(tid);
      return sendJson(res, 200, { exams: rows });
    }

    // --- AUTH ---
    if (path === '/api/auth/me' && req.method === 'GET') {
      const sess = await getCurrentUser(req);
      return sendJson(res, 200, { user: sess?.user ?? null });
    }

    if (path === '/api/auth/register' && req.method === 'POST') {
      const ip = getClientIp(req);
      if (!checkRateLimit(`reg:${ip}`, 10, 15 * 60 * 1000)) {
        return sendJson(res, 429, { error: 'Bạn thao tác quá nhanh, vui lòng thử lại sau ít phút.' });
      }

      const body = await readJson<{
        username?: string;
        fullName?: string;
        password?: string;
        role?: UserRole;
        grade?: number;
        teacherCode?: string;
        teacherInviteCode?: string;
      }>(req);

      const username = validateUsername(body.username ?? '');
      if (!username) {
        return sendJson(res, 400, {
          error: 'Tên đăng nhập dài 3-32 ký tự, chỉ gồm chữ thường không dấu, số, dấu chấm hoặc gạch dưới.',
        });
      }
      const fullName = (body.fullName ?? '').trim();
      if (fullName.length < 2 || fullName.length > 80) {
        return sendJson(res, 400, { error: 'Họ và tên phải từ 2 đến 80 ký tự.' });
      }
      if (!validatePassword(body.password ?? '')) {
        return sendJson(res, 400, { error: 'Mật khẩu cần tối thiểu 6 ký tự.' });
      }

      const role: UserRole = body.role === 'teacher' ? 'teacher' : 'student';
      const grade: GradeLevel | null = role === 'student' && isValidGrade(Number(body.grade))
        ? (Number(body.grade) as GradeLevel)
        : null;

      let boundTeacherId: string | null = null;

      if (role === 'teacher') {
        const existingTeachers = await countTeachers();
        const expectedCode = process.env.TEACHER_INVITE_CODE?.trim();
        const provided = body.teacherInviteCode?.trim() ?? '';
        if (existingTeachers > 0) {
          if (!expectedCode || !safeEqualString(provided, expectedCode)) {
            return sendJson(res, 403, {
              error: 'Đã có tài khoản giáo viên. Cần mã mời giáo viên hợp lệ (TEACHER_INVITE_CODE) để đăng ký thêm.',
            });
          }
        } else if (expectedCode && !safeEqualString(provided, expectedCode)) {
          return sendJson(res, 403, { error: 'Mã mời giáo viên không đúng.' });
        }
      } else {
        const code = (body.teacherCode ?? '').trim();
        if (code) {
          boundTeacherId = await findTeacherByCode(code);
          if (!boundTeacherId) {
            return sendJson(res, 400, { error: 'Mã gia sư không tồn tại. Vui lòng kiểm tra lại.' });
          }
        } else {
          const singleTid = await getSingleTeacherId();
          const teacherCount = await countTeachers();
          if (teacherCount > 1) {
            return sendJson(res, 400, { error: 'Hệ thống có nhiều giáo viên, vui lòng nhập Mã gia sư.' });
          }
          boundTeacherId = singleTid;
        }
      }

      const existing = await findAccountByUsername(username);
      if (existing) {
        return sendJson(res, 409, { error: 'Tên đăng nhập này đã được sử dụng.' });
      }

      const passwordHash = await hashPassword(body.password!);
      const user = await createAccount({ username, fullName, passwordHash, role, grade, teacherId: boundTeacherId });

      const token = generateSessionToken();
      await createSession(user.id, token);
      setSessionCookie(req, res, token);

      return sendJson(res, 201, { user });
    }

    if (path === '/api/auth/login' && req.method === 'POST') {
      const ip = getClientIp(req);
      if (!checkRateLimit(`login:${ip}`, 15, 10 * 60 * 1000)) {
        return sendJson(res, 429, { error: 'Thử đăng nhập quá nhiều lần. Vui lòng đợi 10 phút.' });
      }

      const body = await readJson<{ username?: string; password?: string }>(req);
      const username = validateUsername(body.username ?? '');
      if (!username || typeof body.password !== 'string') {
        return sendJson(res, 400, { error: 'Tên đăng nhập hoặc mật khẩu không đúng.' });
      }

      const account = await findAccountByUsername(username);
      if (!account || !(await verifyPassword(body.password, account.passwordHash))) {
        return sendJson(res, 401, { error: 'Tên đăng nhập hoặc mật khẩu không đúng.' });
      }

      const token = generateSessionToken();
      await createSession(account.id, token);
      setSessionCookie(req, res, token);

      const { passwordHash: _omit, ...publicUser } = account;
      void _omit;
      return sendJson(res, 200, { user: publicUser });
    }

    if (path === '/api/auth/logout' && req.method === 'POST') {
      const cookies = parseCookies(req);
      const token = cookies[SESSION_COOKIE];
      if (token) await deleteSession(token);
      clearSessionCookie(req, res);
      return sendJson(res, 200, { ok: true });
    }

    // --- AUTHENTICATED ROUTES ---
    const sess = await getCurrentUser(req);
    if (!sess) {
      return sendJson(res, 401, { error: 'Vui lòng đăng nhập để tiếp tục.' });
    }
    const { user } = sess;

    // Notifications for logged-in user (student or teacher)
    if (path === '/api/notifications' && req.method === 'GET') {
      const items = await getNotificationsForUser(user);
      const live = isLiveRoomActiveForTeacher(user.role === 'teacher' ? user.id : user.teacherId);
      if (live.active && user.role === 'student') {
        items.unshift({
          id: 'live-room-active',
          kind: 'live-class',
          title: `${live.hostName || 'Gia sư'} đang mở phòng dạy trực tiếp`,
          detail: 'Bấm để vào bảng trắng & học trực tiếp ngay',
          link: '/day-hoc',
          urgent: true,
          timestamp: live.startedAt ?? new Date().toISOString(),
        });
      }
      return sendJson(res, 200, { count: items.length, items, liveActive: live.active });
    }

    // Live teaching room (SSE + actions)
    if (path === '/api/live/stream' && req.method === 'GET') {
      registerLiveClient(user, res);
      return;
    }

    if (path === '/api/live/state' && req.method === 'GET') {
      return sendJson(res, 200, { state: getLiveRoomStateForUser(user) });
    }

    if (path === '/api/live/action' && req.method === 'POST') {
      const action = await readJson<LiveActionPayload>(req, 3 * 1024 * 1024);
      const result = applyLiveAction(user, action);
      if (!result.ok) return sendJson(res, 403, { error: result.error });
      return sendJson(res, 200, { ok: true });
    }

    // Theory notes (accessible to both teacher & student)
    if (path === '/api/theory' && req.method === 'GET') {
      const notes = await listTheoryNotesForUser(user);
      return sendJson(res, 200, { notes });
    }

    // Student views their own submission & teacher's feedback
    if (path.startsWith('/api/student/submissions/') && req.method === 'GET') {
      const subId = decodeURIComponent(path.slice('/api/student/submissions/'.length));
      const submission = await getSubmissionForStudent(user.id, subId);
      if (!submission) return sendJson(res, 404, { error: 'Không tìm thấy bài làm.' });
      return sendJson(res, 200, { submission });
    }

    // Student dashboard
    if (path === '/api/student/dashboard' && req.method === 'GET') {
      const data = await getStudentDashboard(user);
      return sendJson(res, 200, data);
    }

    // Save exam submission (any logged-in user)
    if (path === '/api/submissions' && req.method === 'POST') {
      const body = await readJson<{
        assignmentId?: string | null;
        examId?: string;
        examTitle?: string;
        grade?: number;
        category?: ExamCategory;
        mode?: 'exam' | 'practice';
        score?: number;
        correctCount?: number;
        totalQuestions?: number;
        durationSeconds?: number;
        answers?: Record<string, UserAnswer>;
      }>(req);

      if (!body.examId || !body.examTitle || !isValidGrade(Number(body.grade))) {
        return sendJson(res, 400, { error: 'Dữ liệu bài nộp không hợp lệ.' });
      }
      const score = Math.max(0, Math.min(10, Number(body.score ?? 0)));
      const saved = await saveSubmission({
        studentId: user.id,
        studentRole: user.role,
        studentTeacherId: user.teacherId,
        assignmentId: body.assignmentId ?? null,
        examId: body.examId,
        examTitle: body.examTitle,
        grade: Number(body.grade) as GradeLevel,
        category: body.category ?? 'cuoi-hk1',
        mode: body.mode === 'practice' ? 'practice' : 'exam',
        score,
        correctCount: Math.max(0, Number(body.correctCount ?? 0)),
        totalQuestions: Math.max(1, Number(body.totalQuestions ?? 1)),
        durationSeconds: Math.max(1, Number(body.durationSeconds ?? 1)),
        answers: body.answers ?? {},
      });
      return sendJson(res, 201, saved);
    }

    // --- TEACHER ROUTES ---
    if (path.startsWith('/api/teacher/')) {
      if (user.role !== 'teacher') {
        return sendJson(res, 403, { error: 'Chức năng này chỉ dành cho tài khoản giáo viên.' });
      }

      if (path === '/api/teacher/dashboard' && req.method === 'GET') {
        const data = await getTeacherDashboard(user.id);
        return sendJson(res, 200, data);
      }

      if (path === '/api/teacher/students' && req.method === 'POST') {
        const body = await readJson<{ username?: string; fullName?: string; password?: string; grade?: number }>(req);
        const username = validateUsername(body.username ?? '');
        if (!username) {
          return sendJson(res, 400, { error: 'Tên đăng nhập dài 3-32 ký tự, chỉ gồm chữ thường không dấu, số, dấu chấm hoặc gạch dưới.' });
        }
        const fullName = (body.fullName ?? '').trim();
        if (fullName.length < 2 || fullName.length > 80) {
          return sendJson(res, 400, { error: 'Họ và tên phải từ 2 đến 80 ký tự.' });
        }
        if (!validatePassword(body.password ?? '')) {
          return sendJson(res, 400, { error: 'Mật khẩu cần tối thiểu 6 ký tự.' });
        }
        const existing = await findAccountByUsername(username);
        if (existing) return sendJson(res, 409, { error: 'Tên đăng nhập này đã tồn tại.' });

        const grade = isValidGrade(Number(body.grade)) ? (Number(body.grade) as GradeLevel) : 6;
        const passwordHash = await hashPassword(body.password!);
        const account = await createAccount({
          username,
          fullName,
          passwordHash,
          role: 'student',
          grade,
          teacherId: user.id,
        });
        return sendJson(res, 201, {
          student: {
            id: account.id,
            username: account.username,
            fullName: account.fullName,
            grade: account.grade,
            createdAt: account.createdAt,
            submissionCount: 0,
            avgScore: null,
          },
        });
      }

      if (path.startsWith('/api/teacher/students/') && req.method === 'DELETE') {
        const studentId = decodeURIComponent(path.slice('/api/teacher/students/'.length));
        const ok = await deleteStudentAccount(user.id, studentId);
        return ok ? sendJson(res, 200, { ok: true }) : sendJson(res, 404, { error: 'Không tìm thấy học sinh thuộc quản lý của bạn.' });
      }

      if (path === '/api/teacher/assignments' && req.method === 'POST') {
        const body = await readJson<{
          studentId?: string | null;
          examId?: string;
          examTitle?: string;
          grade?: number;
          note?: string;
          dueAt?: string | null;
          resultMode?: 'immediate' | 'after-review';
        }>(req);

        if (!body.examId || !body.examTitle || !isValidGrade(Number(body.grade))) {
          return sendJson(res, 400, { error: 'Thiếu thông tin đề kiểm tra.' });
        }
        const dueAt = body.dueAt && !Number.isNaN(Date.parse(body.dueAt)) ? new Date(body.dueAt).toISOString() : null;
        const assignment = await createAssignment({
          teacherId: user.id,
          studentId: body.studentId ? String(body.studentId) : null,
          examId: body.examId,
          examTitle: body.examTitle,
          grade: Number(body.grade) as GradeLevel,
          note: (body.note ?? '').trim().slice(0, 300),
          dueAt,
          resultMode: body.resultMode === 'after-review' ? 'after-review' : 'immediate',
        });
        return sendJson(res, 201, { assignment });
      }

      if (path.startsWith('/api/teacher/assignments/') && req.method === 'DELETE') {
        const asgId = decodeURIComponent(path.slice('/api/teacher/assignments/'.length));
        const ok = await deleteAssignment(user.id, asgId);
        return ok ? sendJson(res, 200, { ok: true }) : sendJson(res, 404, { error: 'Không tìm thấy bài giao.' });
      }

      if (path === '/api/teacher/submissions/review-all' && req.method === 'POST') {
        await markAllSubmissionsReviewed(user.id);
        return sendJson(res, 200, { ok: true });
      }

      if (path.startsWith('/api/teacher/submissions/') && path.endsWith('/feedback') && req.method === 'POST') {
        const subId = decodeURIComponent(
          path.slice('/api/teacher/submissions/'.length, -'/feedback'.length),
        );
        const body = await readJson<{
          teacherNote?: string;
          questionNotes?: Record<string, string>;
          adjustedScore?: number | null;
          publishResult?: boolean;
        }>(req);
        const updated = await saveSubmissionFeedback(user.id, subId, {
          teacherNote: body.teacherNote ?? '',
          questionNotes: body.questionNotes ?? {},
          adjustedScore:
            body.adjustedScore === null || body.adjustedScore === undefined || String(body.adjustedScore) === ''
              ? null
              : Number(body.adjustedScore),
          publishResult: Boolean(body.publishResult),
        });
        if (!updated) return sendJson(res, 404, { error: 'Không tìm thấy bài làm thuộc học sinh của bạn.' });
        return sendJson(res, 200, { submission: updated });
      }

      if (path === '/api/teacher/theory' && req.method === 'POST') {
        const body = await readJson<{
          id?: string;
          studentId?: string | null;
          subjectId?: string;
          grade?: number;
          title?: string;
          summary?: string;
          content?: string;
          imageDataUrl?: string | null;
        }>(req, 3 * 1024 * 1024);

        if (!body.title?.trim() || !isValidGrade(Number(body.grade))) {
          return sendJson(res, 400, { error: 'Bài lý thuyết cần có tiêu đề và khối lớp (6-9).' });
        }
        const note = await upsertTheoryNote(user.id, {
          id: body.id,
          studentId: body.studentId ? String(body.studentId) : null,
          subjectId: (body.subjectId || 'toan') as Exam['subjectId'],
          grade: Number(body.grade) as GradeLevel,
          title: body.title,
          summary: body.summary ?? '',
          content: body.content ?? '',
          imageDataUrl: body.imageDataUrl ?? null,
        });
        return sendJson(res, 200, { note });
      }

      if (path.startsWith('/api/teacher/theory/') && req.method === 'DELETE') {
        const noteId = decodeURIComponent(path.slice('/api/teacher/theory/'.length));
        const ok = await deleteTheoryNote(user.id, noteId);
        return ok ? sendJson(res, 200, { ok: true }) : sendJson(res, 404, { error: 'Không tìm thấy bài lý thuyết.' });
      }

      if (path.startsWith('/api/teacher/submissions/') && req.method === 'GET') {
        const subId = decodeURIComponent(path.slice('/api/teacher/submissions/'.length));
        const submission = await getSubmissionForTeacher(user.id, subId);
        if (!submission) return sendJson(res, 404, { error: 'Không tìm thấy bài làm thuộc học sinh của bạn.' });
        return sendJson(res, 200, { submission });
      }

      if (path === '/api/teacher/exams' && req.method === 'POST') {
        const body = await readJson<{ exam?: Exam }>(req);
        const exam = body.exam;
        if (!exam || !exam.title?.trim() || !isValidGrade(Number(exam.grade)) || !Array.isArray(exam.questions) || exam.questions.length === 0) {
          return sendJson(res, 400, { error: 'Đề kiểm tra cần có tiêu đề, khối lớp (6-9) và ít nhất 1 câu hỏi.' });
        }
        const saved = await upsertStoredExam(user.id, {
          ...exam,
          grade: Number(exam.grade) as GradeLevel,
        });
        return sendJson(res, 200, { stored: saved });
      }

      if (path.startsWith('/api/teacher/exams/') && req.method === 'DELETE') {
        const examId = decodeURIComponent(path.slice('/api/teacher/exams/'.length));
        const urlObj = new URL(req.url ?? path, 'http://localhost');
        const mode = urlObj.searchParams.get('mode') === 'hide' ? 'hide' : 'delete';
        await deleteOrHideStoredExam(user.id, examId, mode);
        return sendJson(res, 200, { ok: true });
      }
    }

    return sendJson(res, 404, { error: 'Không tìm thấy API.' });
  } catch (err) {
    console.error('[api] lỗi:', err);
    return sendJson(res, 500, { error: (err as Error).message || 'Lỗi máy chủ.' });
  }
}
