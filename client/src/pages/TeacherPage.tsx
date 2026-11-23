import { Download, Eye, Plus, Save, Trash2, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { gradeExam } from '@shared/scoring';
import {
  CATEGORY_LABELS,
  type AssignmentInfo,
  type GradeLevel,
  type ResultReleaseMode,
  type StudentSummary,
  type SubmissionRecord,
} from '@shared/types';
import { QuestionCard } from '../components/QuestionCard';
import {
  apiCreateAssignment,
  apiCreateStudent,
  apiDeleteAssignment,
  apiDeleteStudent,
  apiMarkAllReviewed,
  apiSaveSubmissionFeedback,
  fetchSubmissionDetail,
  fetchTeacherDashboard,
} from '../lib/api';
import { useAuth } from '../lib/authContext';
import { useExams } from '../lib/examStore';

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}p ${s}s` : `${s}s`;
}

export function TeacherPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, loading: authLoading, refreshNotifications } = useAuth();
  const { allExams, getExam } = useExams();

  const preselectExamId = searchParams.get('assign') ?? '';
  const inspectParamId = searchParams.get('inspect') ?? '';
  const preselectExam = preselectExamId ? getExam(preselectExamId) : undefined;

  const [activeTab, setActiveTab] = useState<'results' | 'assignments' | 'students'>(
    preselectExam ? 'assignments' : 'results',
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [students, setStudents] = useState<StudentSummary[]>([]);
  const [assignments, setAssignments] = useState<AssignmentInfo[]>([]);
  const [submissions, setSubmissions] = useState<SubmissionRecord[]>([]);

  // Form: giao đề trực tiếp cho học sinh
  const [assignStudentId, setAssignStudentId] = useState<string>('all');
  const [assignGrade, setAssignGrade] = useState<GradeLevel>(preselectExam?.grade ?? 6);
  const [assignExamId, setAssignExamId] = useState(preselectExam?.id ?? '');
  const [assignDue, setAssignDue] = useState('');
  const [assignNote, setAssignNote] = useState('');
  const [assignResultMode, setAssignResultMode] = useState<ResultReleaseMode>('immediate');

  // Form: tạo nhanh tài khoản học sinh
  const [stuFullName, setStuFullName] = useState('');
  const [stuUsername, setStuUsername] = useState('');
  const [stuPassword, setStuPassword] = useState('');
  const [stuGrade, setStuGrade] = useState<GradeLevel>(6);
  const [stuMsg, setStuMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Bộ lọc bảng điểm
  const [filterStudentId, setFilterStudentId] = useState('all');
  const [filterExamId, setFilterExamId] = useState('all');

  // Xem & chữa bài làm của học sinh
  const [inspectSub, setInspectSub] = useState<SubmissionRecord | null>(null);
  const [inspectLoading, setInspectLoading] = useState(false);
  const [fbTeacherNote, setFbTeacherNote] = useState('');
  const [fbAdjustedScore, setFbAdjustedScore] = useState('');
  const [fbQuestionNotes, setFbQuestionNotes] = useState<Record<string, string>>({});
  const [fbSaving, setFbSaving] = useState(false);
  const [fbSavedMsg, setFbSavedMsg] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchTeacherDashboard();
      setStudents(data.students);
      setAssignments(data.assignments);
      setSubmissions(data.submissions);
    } catch (err) {
      setError((err as Error).message || 'Không tải được dữ liệu.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && user?.role === 'teacher') {
      void loadData();
    }
  }, [authLoading, user, loadData]);

  const gradeExams = useMemo(
    () => allExams.filter((e) => e.grade === assignGrade),
    [allExams, assignGrade],
  );

  useEffect(() => {
    if (gradeExams.length > 0 && !gradeExams.some((e) => e.id === assignExamId)) {
      setAssignExamId(gradeExams[0].id);
    }
  }, [gradeExams, assignExamId]);

  const filteredSubmissions = useMemo(() => {
    return submissions.filter((s) => {
      if (filterStudentId !== 'all' && s.studentId !== filterStudentId) return false;
      if (filterExamId !== 'all' && s.examId !== filterExamId) return false;
      return true;
    });
  }, [submissions, filterStudentId, filterExamId]);

  const distinctExamsInSubmissions = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of submissions) map.set(s.examId, s.examTitle);
    return Array.from(map.entries());
  }, [submissions]);

  const handleInspect = useCallback(async (subId: string) => {
    setInspectLoading(true);
    setFbSavedMsg(null);
    try {
      const { submission } = await fetchSubmissionDetail(subId);
      setInspectSub(submission);
      setFbTeacherNote(submission.teacherNote ?? '');
      setFbAdjustedScore(submission.adjustedScore !== null ? String(submission.adjustedScore) : '');
      setFbQuestionNotes(submission.questionNotes ?? {});
      setSubmissions((prev) =>
        prev.map((s) => (s.id === subId ? { ...s, reviewedAt: submission.reviewedAt ?? new Date().toISOString() } : s)),
      );
      void refreshNotifications();
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setInspectLoading(false);
    }
  }, [refreshNotifications]);

  useEffect(() => {
    if (inspectParamId && !authLoading && user?.role === 'teacher') {
      setActiveTab('results');
      void handleInspect(inspectParamId);
    }
  }, [inspectParamId, authLoading, user, handleInspect]);

  if (authLoading) {
    return <div className="container"><div className="panel">Đang kiểm tra tài khoản...</div></div>;
  }

  if (!user || user.role !== 'teacher') {
    return (
      <div className="container narrow-container">
        <div className="panel">
          <h1>Khu vực dành cho giáo viên</h1>
          <p className="muted-text">Vui lòng đăng nhập bằng tài khoản giáo viên để giao đề và xem điểm học sinh.</p>
          <button type="button" className="btn-primary" onClick={() => navigate('/dang-nhap')}>
            Đăng nhập
          </button>
        </div>
      </div>
    );
  }

  const handleCreateAssignment = async (e: FormEvent) => {
    e.preventDefault();
    const exam = getExam(assignExamId);
    if (!exam) return;
    try {
      const { assignment } = await apiCreateAssignment({
        studentId: assignStudentId === 'all' ? null : assignStudentId,
        examId: exam.id,
        examTitle: exam.title,
        grade: exam.grade,
        note: assignNote,
        dueAt: assignDue ? new Date(assignDue).toISOString() : null,
        resultMode: assignResultMode,
      });
      setAssignments((prev) => [assignment, ...prev]);
      setAssignNote('');
      setAssignDue('');
    } catch (err) {
      alert((err as Error).message);
    }
  };

  const handleDeleteAssignment = async (id: string) => {
    if (!window.confirm('Xóa bài giao này?')) return;
    try {
      await apiDeleteAssignment(id);
      setAssignments((prev) => prev.filter((a) => a.id !== id));
    } catch (err) {
      alert((err as Error).message);
    }
  };

  const handleCreateStudent = async (e: FormEvent) => {
    e.preventDefault();
    setStuMsg(null);
    try {
      const { student } = await apiCreateStudent({
        fullName: stuFullName,
        username: stuUsername,
        password: stuPassword,
        grade: stuGrade,
      });
      setStudents((prev) => [student, ...prev]);
      setStuMsg({
        type: 'ok',
        text: `Đã tạo tài khoản cho ${student.fullName} (tên đăng nhập: ${student.username}).`,
      });
      setStuFullName('');
      setStuUsername('');
      setStuPassword('');
    } catch (err) {
      setStuMsg({ type: 'err', text: (err as Error).message });
    }
  };

  const handleDeleteStudent = async (id: string, name: string) => {
    if (!window.confirm(`Xóa tài khoản học sinh "${name}" và toàn bộ bài nộp của em này?`)) return;
    try {
      await apiDeleteStudent(id);
      setStudents((prev) => prev.filter((s) => s.id !== id));
      setSubmissions((prev) => prev.filter((s) => s.studentId !== id));
    } catch (err) {
      alert((err as Error).message);
    }
  };

  const handleSaveFeedback = async (publishResult: boolean) => {
    if (!inspectSub) return;
    setFbSaving(true);
    setFbSavedMsg(null);
    try {
      const adj = fbAdjustedScore.trim() === '' ? null : Number(fbAdjustedScore);
      const { submission } = await apiSaveSubmissionFeedback(inspectSub.id, {
        teacherNote: fbTeacherNote,
        questionNotes: fbQuestionNotes,
        adjustedScore: adj,
        publishResult,
      });
      setInspectSub(submission);
      setSubmissions((prev) => prev.map((s) => (s.id === submission.id ? { ...s, ...submission } : s)));
      setFbSavedMsg(
        publishResult
          ? 'Đã lưu & công bố kết quả! Học sinh sẽ nhận được thông báo ngay.'
          : 'Đã lưu nháp phần chữa bài (chưa công bố cho học sinh).',
      );
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setFbSaving(false);
    }
  };

  const handleMarkAllReviewed = async () => {
    try {
      await apiMarkAllReviewed();
      const now = new Date().toISOString();
      setSubmissions((prev) => prev.map((s) => ({ ...s, reviewedAt: s.reviewedAt ?? now })));
      void refreshNotifications();
    } catch (err) {
      alert((err as Error).message);
    }
  };

  const handleExportCsv = () => {
    const header = ['Học sinh', 'Tài khoản', 'Đề kiểm tra', 'Điểm', 'Số câu đúng', 'Thời gian (giây)', 'Thời điểm nộp'];
    const rows = filteredSubmissions.map((s) => [
      s.studentName,
      s.studentUsername,
      s.examTitle,
      s.score.toFixed(2),
      `${s.correctCount}/${s.totalQuestions}`,
      String(s.durationSeconds),
      new Date(s.submittedAt).toLocaleString('vi-VN'),
    ]);
    const csv = '\uFEFF' + [header, ...rows].map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bang-diem-thcs-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const inspectExam = inspectSub ? getExam(inspectSub.examId) : undefined;
  const inspectGraded = inspectSub && inspectExam && inspectSub.answers ? gradeExam(inspectExam, inspectSub.answers) : null;

  return (
    <div className="container">
      <div className="page-head">
        <div>
          <h1>Giao bài & Theo dõi học sinh</h1>
          <p className="muted-text">
            {students.length} học sinh · {assignments.length} đề đã giao · {submissions.length} lượt nộp bài
          </p>
        </div>
        <div className="tab-strip">
          <button
            type="button"
            className={`tab-btn ${activeTab === 'results' ? 'active' : ''}`}
            onClick={() => setActiveTab('results')}
          >
            Kết quả ({submissions.length})
          </button>
          <button
            type="button"
            className={`tab-btn ${activeTab === 'assignments' ? 'active' : ''}`}
            onClick={() => setActiveTab('assignments')}
          >
            Giao đề ({assignments.length})
          </button>
          <button
            type="button"
            className={`tab-btn ${activeTab === 'students' ? 'active' : ''}`}
            onClick={() => setActiveTab('students')}
          >
            Học sinh ({students.length})
          </button>
          <button
            type="button"
            className="btn-primary btn-sm"
            onClick={() => navigate('/giao-vien/tao-de')}
          >
            <Plus size={15} /> Tạo đề mới
          </button>
        </div>
      </div>

      {error && <div className="form-error">{error}</div>}
      {loading && <div className="panel">Đang tải dữ liệu...</div>}

      {/* TAB 1: KẾT QUẢ LÀM BÀI */}
      {!loading && activeTab === 'results' && (
        <section className="panel">
          <div className="toolbar-row">
            <div className="toolbar-filters">
              <select
                className="select-input"
                value={filterStudentId}
                onChange={(e) => setFilterStudentId(e.target.value)}
              >
                <option value="all">Tất cả học sinh</option>
                {students.map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.fullName} {st.grade ? `(Lớp ${st.grade})` : ''}
                  </option>
                ))}
              </select>
              <select className="select-input" value={filterExamId} onChange={(e) => setFilterExamId(e.target.value)}>
                <option value="all">Tất cả đề</option>
                {distinctExamsInSubmissions.map(([id, title]) => (
                  <option key={id} value={id}>{title}</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {submissions.some((s) => !s.reviewedAt) && (
                <button type="button" className="btn-secondary btn-sm" onClick={handleMarkAllReviewed}>
                  Đánh dấu đã xem hết
                </button>
              )}
              {filteredSubmissions.length > 0 && (
                <button type="button" className="btn-secondary btn-sm" onClick={handleExportCsv}>
                  <Download size={15} /> Xuất Excel (CSV)
                </button>
              )}
            </div>
          </div>

          {filteredSubmissions.length === 0 ? (
            <div className="empty-inline">
              Chưa có bài nộp nào. Bạn có thể tạo tài khoản cho học sinh ở tab <strong>Học sinh</strong> rồi giao đề ở tab <strong>Giao đề</strong>.
            </div>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Học sinh</th>
                    <th>Đề kiểm tra</th>
                    <th>Điểm</th>
                    <th>Đúng</th>
                    <th>Thời gian</th>
                    <th>Nộp lúc</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSubmissions.map((s) => (
                    <tr key={s.id} className={!s.reviewedAt ? 'row-unread' : ''}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <strong>{s.studentName}</strong>
                          {!s.reviewedAt && <span className="tag">Mới</span>}
                          {!s.publishedAt && <span className="tag-urgent">Chờ công bố</span>}
                          {s.feedbackAt && <span className="book-badge">Đã chữa</span>}
                        </div>
                        <div className="cell-sub">{s.studentUsername}</div>
                      </td>
                      <td>
                        <div>{s.examTitle}</div>
                        <div className="cell-sub">Toán {s.grade} · {CATEGORY_LABELS[s.category]}</div>
                      </td>
                      <td>
                        {(() => {
                          const finalScore = s.adjustedScore ?? s.score;
                          return (
                            <span className={`score-badge ${finalScore >= 8 ? 'good' : finalScore >= 5 ? 'warn' : 'bad'}`}>
                              {finalScore.toFixed(2)}
                            </span>
                          );
                        })()}
                      </td>
                      <td>{s.correctCount}/{s.totalQuestions}</td>
                      <td>{formatDuration(s.durationSeconds)}</td>
                      <td className="cell-nowrap">{new Date(s.submittedAt).toLocaleString('vi-VN')}</td>
                      <td>
                        <button
                          type="button"
                          className="btn-secondary btn-sm"
                          disabled={inspectLoading}
                          onClick={() => handleInspect(s.id)}
                        >
                          <Eye size={14} /> Xem & Sửa
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* TAB 2: GIAO ĐỀ TRỰC TIẾP */}
      {!loading && activeTab === 'assignments' && (
        <div className="stack-gap">
          <section className="panel">
            <h2>Giao đề cho học sinh</h2>
            <form onSubmit={handleCreateAssignment} className="assign-form">
              <div className="field-row">
                <div className="field">
                  <label>Giao cho</label>
                  <select
                    value={assignStudentId}
                    onChange={(e) => {
                      const val = e.target.value;
                      setAssignStudentId(val);
                      const found = students.find((st) => st.id === val);
                      if (found?.grade) setAssignGrade(found.grade);
                    }}
                  >
                    <option value="all">Tất cả học sinh</option>
                    {students.map((st) => (
                      <option key={st.id} value={st.id}>
                        {st.fullName} {st.grade ? `(Lớp ${st.grade})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>Khối đề</label>
                  <select value={assignGrade} onChange={(e) => setAssignGrade(Number(e.target.value) as GradeLevel)}>
                    <option value={6}>Lớp 6</option>
                    <option value={7}>Lớp 7</option>
                    <option value={8}>Lớp 8</option>
                    <option value={9}>Lớp 9</option>
                  </select>
                </div>
              </div>

              <div className="field">
                <label>Chọn đề kiểm tra</label>
                <select value={assignExamId} onChange={(e) => setAssignExamId(e.target.value)}>
                  {gradeExams.map((ex) => (
                    <option key={ex.id} value={ex.id}>
                      [{CATEGORY_LABELS[ex.category]}] {ex.title} ({ex.durationMinutes} phút)
                    </option>
                  ))}
                </select>
              </div>

              <div className="field-row">
                <div className="field">
                  <label>Hạn nộp (tùy chọn)</label>
                  <input type="datetime-local" value={assignDue} onChange={(e) => setAssignDue(e.target.value)} />
                </div>
                <div className="field">
                  <label>Dặn dò (tùy chọn)</label>
                  <input
                    type="text"
                    placeholder="Ví dụ: Làm xong trước buổi học Thứ 5"
                    value={assignNote}
                    onChange={(e) => setAssignNote(e.target.value)}
                  />
                </div>
              </div>

              <div className="field">
                <label>Cách thông báo kết quả cho học sinh</label>
                <select
                  value={assignResultMode}
                  onChange={(e) => setAssignResultMode(e.target.value as ResultReleaseMode)}
                >
                  <option value="immediate">Báo điểm & lời giải chi tiết ngay sau khi nộp</option>
                  <option value="after-review">Chờ gia sư xem, chữa bài và xác nhận công bố mới báo kết quả</option>
                </select>
              </div>

              <div>
                <button type="submit" className="btn-primary">
                  <Plus size={16} /> Giao đề
                </button>
              </div>
            </form>
          </section>

          <section className="panel">
            <h2>Đề đã giao</h2>
            {assignments.length === 0 ? (
              <div className="empty-inline">Chưa có đề nào được giao.</div>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Người nhận</th>
                      <th>Đề kiểm tra</th>
                      <th>Hạn nộp</th>
                      <th>Trạng thái</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {assignments.map((a) => (
                      <tr key={a.id}>
                        <td><strong>{a.studentName}</strong></td>
                        <td>
                          <div>{a.examTitle}</div>
                          <div className="cell-sub">
                            {a.resultMode === 'after-review' ? 'Chờ gia sư duyệt mới báo điểm' : 'Báo điểm ngay'}
                            {a.note ? ` · ${a.note}` : ''}
                          </div>
                        </td>
                        <td className="cell-nowrap">
                          {a.dueAt ? new Date(a.dueAt).toLocaleString('vi-VN') : 'Không giới hạn'}
                        </td>
                        <td>
                          {a.submissionCount && a.submissionCount > 0
                            ? `Đã nộp (${a.submissionCount})`
                            : 'Chưa nộp'}
                        </td>
                        <td>
                          <button
                            type="button"
                            className="icon-btn"
                            title="Xóa bài giao"
                            onClick={() => handleDeleteAssignment(a.id)}
                          >
                            <Trash2 size={15} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}

      {/* TAB 3: HỌC SINH */}
      {!loading && activeTab === 'students' && (
        <div className="stack-gap">
          <section className="panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
              <h2 style={{ margin: 0 }}>Tạo nhanh tài khoản cho học sinh</h2>
              {user.teacherCode && (
                <div className="info-note" style={{ padding: '5px 10px' }}>
                  Mã gia sư của bạn: <strong>{user.teacherCode}</strong>
                </div>
              )}
            </div>
            <p className="muted-text" style={{ marginBottom: 12 }}>
              Học sinh tạo ở đây (hoặc tự đăng ký bằng Mã gia sư của bạn) sẽ chỉ thuộc quyền quản lý của riêng bạn.
            </p>
            <form onSubmit={handleCreateStudent} className="assign-form">
              <div className="field-row">
                <div className="field">
                  <label>Họ và tên học sinh</label>
                  <input
                    type="text"
                    required
                    placeholder="Ví dụ: Nguyễn Minh Anh"
                    value={stuFullName}
                    onChange={(e) => setStuFullName(e.target.value)}
                  />
                </div>
                <div className="field">
                  <label>Khối lớp</label>
                  <select value={stuGrade} onChange={(e) => setStuGrade(Number(e.target.value) as GradeLevel)}>
                    <option value={6}>Lớp 6</option>
                    <option value={7}>Lớp 7</option>
                    <option value={8}>Lớp 8</option>
                    <option value={9}>Lớp 9</option>
                  </select>
                </div>
              </div>
              <div className="field-row">
                <div className="field">
                  <label>Tên đăng nhập</label>
                  <input
                    type="text"
                    required
                    placeholder="Ví dụ: minhanh8"
                    value={stuUsername}
                    onChange={(e) => setStuUsername(e.target.value)}
                  />
                </div>
                <div className="field">
                  <label>Mật khẩu (tối thiểu 6 ký tự)</label>
                  <input
                    type="text"
                    required
                    minLength={6}
                    placeholder="Ví dụ: 123456"
                    value={stuPassword}
                    onChange={(e) => setStuPassword(e.target.value)}
                  />
                </div>
              </div>
              {stuMsg && (
                <div className={stuMsg.type === 'ok' ? 'info-note' : 'form-error'}>{stuMsg.text}</div>
              )}
              <div>
                <button type="submit" className="btn-primary">
                  <Plus size={16} /> Tạo tài khoản học sinh
                </button>
              </div>
            </form>
          </section>

          <section className="panel">
            <h2>Danh sách học sinh ({students.length})</h2>
            {students.length === 0 ? (
              <div className="empty-inline">Chưa có học sinh nào.</div>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Họ tên</th>
                      <th>Tên đăng nhập</th>
                      <th>Khối</th>
                      <th>Số bài đã nộp</th>
                      <th>Điểm TB</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((st) => (
                      <tr key={st.id}>
                        <td><strong>{st.fullName}</strong></td>
                        <td><code>{st.username}</code></td>
                        <td>{st.grade ? `Lớp ${st.grade}` : '-'}</td>
                        <td>{st.submissionCount}</td>
                        <td>{st.avgScore !== null ? st.avgScore.toFixed(2) : '-'}</td>
                        <td>
                          <button
                            type="button"
                            className="icon-btn"
                            title="Xóa học sinh"
                            onClick={() => handleDeleteStudent(st.id, st.fullName)}
                          >
                            <Trash2 size={15} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}

      {/* MODAL XEM & CHỮA BÀI LÀM CỦA HỌC SINH */}
      {inspectSub && (
        <div className="modal-backdrop" onClick={() => setInspectSub(null)}>
          <div className="inspect-modal" onClick={(e) => e.stopPropagation()}>
            <div className="inspect-head">
              <div>
                <h3>{inspectSub.studentName} - {inspectSub.examTitle}</h3>
                <div className="muted-text">
                  Điểm máy chấm: <strong>{inspectSub.score.toFixed(2)}/10</strong>
                  {inspectSub.adjustedScore !== null && ` · Điểm gia sư sửa: ${inspectSub.adjustedScore.toFixed(2)}/10`}
                  {' · '}Đúng {inspectSub.correctCount}/{inspectSub.totalQuestions} câu · {formatDuration(inspectSub.durationSeconds)}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {!inspectSub.publishedAt && (
                  <button
                    type="button"
                    className="btn-secondary btn-sm"
                    disabled={fbSaving}
                    onClick={() => void handleSaveFeedback(false)}
                  >
                    Lưu nháp
                  </button>
                )}
                <button
                  type="button"
                  className="btn-primary btn-sm"
                  disabled={fbSaving}
                  onClick={() => void handleSaveFeedback(true)}
                >
                  <Save size={15} />{' '}
                  {fbSaving
                    ? 'Đang lưu...'
                    : inspectSub.publishedAt
                      ? 'Lưu chữa bài'
                      : 'Xác nhận & Công bố điểm'}
                </button>
                <button type="button" className="icon-btn" onClick={() => setInspectSub(null)}>
                  <X size={18} />
                </button>
              </div>
            </div>
            <div className="inspect-body">
              <div className="panel">
                <div className="field-row" style={{ marginBottom: 10 }}>
                  <div className="field">
                    <label>Nhận xét chung của gia sư</label>
                    <textarea
                      className="editor-textarea"
                      rows={2}
                      placeholder="Ví dụ: Làm tốt phần đại số, cần xem lại cách biến đổi dấu ngoặc ở câu 4..."
                      value={fbTeacherNote}
                      onChange={(e) => setFbTeacherNote(e.target.value)}
                    />
                  </div>
                  <div className="field">
                    <label>Điểm sau khi gia sư chấm lại (để trống nếu giữ nguyên {inspectSub.score.toFixed(2)})</label>
                    <input
                      type="number"
                      step="0.25"
                      min={0}
                      max={10}
                      placeholder={inspectSub.score.toFixed(2)}
                      value={fbAdjustedScore}
                      onChange={(e) => setFbAdjustedScore(e.target.value)}
                    />
                  </div>
                </div>
                {fbSavedMsg && <div className="info-note">{fbSavedMsg}</div>}
              </div>

              {inspectExam && inspectGraded && inspectSub.answers ? (
                inspectExam.questions.map((q, idx) => (
                  <div key={q.id} className="inspect-q-wrap">
                    <QuestionCard
                      question={q}
                      index={idx}
                      answer={inspectSub.answers![q.id]}
                      result={inspectGraded.results[idx]}
                      showSolution={true}
                      isFlagged={false}
                      isPracticeMode={false}
                      onChangeAnswer={() => {}}
                      onToggleFlag={() => {}}
                    />
                    <div className="teacher-q-note">
                      <label>Ghi chú chữa câu {idx + 1} cho học sinh (hỗ trợ $công thức$):</label>
                      <input
                        type="text"
                        placeholder="Nhập lời sửa / nhắc nhở riêng cho câu này..."
                        value={fbQuestionNotes[q.id] ?? ''}
                        onChange={(e) =>
                          setFbQuestionNotes((prev) => ({ ...prev, [q.id]: e.target.value }))
                        }
                      />
                    </div>
                  </div>
                ))
              ) : (
                <p className="muted-text">Không thể hiển thị chi tiết câu hỏi của đề ngẫu nhiên này.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
