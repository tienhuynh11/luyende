import { Copy, Download, Eye, Plus, Trash2, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { gradeExam } from '@shared/scoring';
import {
  CATEGORY_LABELS,
  type AssignmentInfo,
  type ClassMemberInfo,
  type ClassroomInfo,
  type GradeLevel,
  type SubmissionRecord,
} from '@shared/types';
import { QuestionCard } from '../components/QuestionCard';
import {
  apiCreateAssignment,
  apiCreateClass,
  apiDeleteAssignment,
  apiDeleteClass,
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
  const { user, loading: authLoading } = useAuth();
  const { allExams, getExam } = useExams();

  const preselectExamId = searchParams.get('assign') ?? '';
  const preselectExam = preselectExamId ? getExam(preselectExamId) : undefined;

  const [activeTab, setActiveTab] = useState<'results' | 'assignments' | 'classes'>(
    preselectExam ? 'assignments' : 'results',
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [classes, setClasses] = useState<ClassroomInfo[]>([]);
  const [membersByClass, setMembersByClass] = useState<Record<string, ClassMemberInfo[]>>({});
  const [assignments, setAssignments] = useState<AssignmentInfo[]>([]);
  const [submissions, setSubmissions] = useState<SubmissionRecord[]>([]);

  // Form: tạo lớp mới
  const [newClassName, setNewClassName] = useState('');
  const [newClassGrade, setNewClassGrade] = useState<GradeLevel>(6);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Form: giao đề mới
  const [assignClassId, setAssignClassId] = useState('');
  const [assignGrade, setAssignGrade] = useState<GradeLevel>(preselectExam?.grade ?? 6);
  const [assignExamId, setAssignExamId] = useState(preselectExam?.id ?? '');
  const [assignDue, setAssignDue] = useState('');
  const [assignNote, setAssignNote] = useState('');

  // Bộ lọc bảng điểm
  const [filterClassId, setFilterClassId] = useState('all');
  const [filterExamId, setFilterExamId] = useState('all');

  // Xem chi tiết bài làm của học sinh
  const [inspectSub, setInspectSub] = useState<SubmissionRecord | null>(null);
  const [inspectLoading, setInspectLoading] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchTeacherDashboard();
      setClasses(data.classes);
      setMembersByClass(data.membersByClass);
      setAssignments(data.assignments);
      setSubmissions(data.submissions);
      if (data.classes.length > 0 && !assignClassId) {
        setAssignClassId(data.classes[0].id);
      }
    } catch (err) {
      setError((err as Error).message || 'Không tải được dữ liệu.');
    } finally {
      setLoading(false);
    }
  }, [assignClassId]);

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
      if (filterClassId !== 'all' && s.classId !== filterClassId) return false;
      if (filterExamId !== 'all' && s.examId !== filterExamId) return false;
      return true;
    });
  }, [submissions, filterClassId, filterExamId]);

  const distinctExamsInSubmissions = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of submissions) map.set(s.examId, s.examTitle);
    return Array.from(map.entries());
  }, [submissions]);

  if (authLoading) {
    return <div className="container"><div className="panel">Đang kiểm tra tài khoản...</div></div>;
  }

  if (!user || user.role !== 'teacher') {
    return (
      <div className="container narrow-container">
        <div className="panel">
          <h1>Khu vực dành cho giáo viên</h1>
          <p className="muted-text">Vui lòng đăng nhập bằng tài khoản giáo viên để tạo lớp, giao đề và xem điểm học sinh.</p>
          <button type="button" className="btn-primary" onClick={() => navigate('/dang-nhap')}>
            Đăng nhập
          </button>
        </div>
      </div>
    );
  }

  const handleCreateClass = async (e: FormEvent) => {
    e.preventDefault();
    if (!newClassName.trim()) return;
    try {
      const { classroom } = await apiCreateClass(newClassName.trim(), newClassGrade);
      setNewClassName('');
      setClasses((prev) => [classroom, ...prev]);
      if (!assignClassId) setAssignClassId(classroom.id);
    } catch (err) {
      alert((err as Error).message);
    }
  };

  const handleDeleteClass = async (classId: string, name: string) => {
    if (!window.confirm(`Xóa lớp "${name}" cùng danh sách giao đề của lớp này?`)) return;
    try {
      await apiDeleteClass(classId);
      setClasses((prev) => prev.filter((c) => c.id !== classId));
      setAssignments((prev) => prev.filter((a) => a.classId !== classId));
    } catch (err) {
      alert((err as Error).message);
    }
  };

  const handleCreateAssignment = async (e: FormEvent) => {
    e.preventDefault();
    const exam = getExam(assignExamId);
    if (!assignClassId || !exam) return;
    try {
      const { assignment } = await apiCreateAssignment({
        classId: assignClassId,
        examId: exam.id,
        examTitle: exam.title,
        grade: exam.grade,
        note: assignNote,
        dueAt: assignDue ? new Date(assignDue).toISOString() : null,
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

  const handleInspect = async (subId: string) => {
    setInspectLoading(true);
    try {
      const { submission } = await fetchSubmissionDetail(subId);
      setInspectSub(submission);
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setInspectLoading(false);
    }
  };

  const handleExportCsv = () => {
    const header = ['Học sinh', 'Tài khoản', 'Lớp', 'Đề kiểm tra', 'Điểm', 'Số câu đúng', 'Thời gian (giây)', 'Thời điểm nộp'];
    const rows = filteredSubmissions.map((s) => [
      s.studentName,
      s.studentUsername,
      s.className ?? '',
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
          <h1>Quản lý lớp học & Giao đề</h1>
          <p className="muted-text">Giáo viên: {user.fullName} · {classes.length} lớp · {assignments.length} đề đang giao</p>
        </div>
        <div className="tab-strip">
          <button
            type="button"
            className={`tab-btn ${activeTab === 'results' ? 'active' : ''}`}
            onClick={() => setActiveTab('results')}
          >
            Kết quả học sinh ({submissions.length})
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
            className={`tab-btn ${activeTab === 'classes' ? 'active' : ''}`}
            onClick={() => setActiveTab('classes')}
          >
            Lớp học ({classes.length})
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

      {/* TAB 1: KẾT QUẢ HỌC SINH */}
      {!loading && activeTab === 'results' && (
        <section className="panel">
          <div className="toolbar-row">
            <div className="toolbar-filters">
              <select className="select-input" value={filterClassId} onChange={(e) => setFilterClassId(e.target.value)}>
                <option value="all">Tất cả lớp</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>{c.name} (Lớp {c.grade})</option>
                ))}
              </select>
              <select className="select-input" value={filterExamId} onChange={(e) => setFilterExamId(e.target.value)}>
                <option value="all">Tất cả đề</option>
                {distinctExamsInSubmissions.map(([id, title]) => (
                  <option key={id} value={id}>{title}</option>
                ))}
              </select>
            </div>
            {filteredSubmissions.length > 0 && (
              <button type="button" className="btn-secondary btn-sm" onClick={handleExportCsv}>
                <Download size={15} /> Xuất Excel (CSV)
              </button>
            )}
          </div>

          {filteredSubmissions.length === 0 ? (
            <div className="empty-inline">
              Chưa có bài nộp nào từ học sinh. Hãy tạo lớp ở tab <strong>Lớp học</strong>, gửi mã lớp cho học sinh và giao đề ở tab <strong>Giao đề</strong>.
            </div>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Học sinh</th>
                    <th>Lớp</th>
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
                    <tr key={s.id}>
                      <td>
                        <strong>{s.studentName}</strong>
                        <div className="cell-sub">{s.studentUsername}</div>
                      </td>
                      <td>{s.className ?? '—'}</td>
                      <td>
                        <div>{s.examTitle}</div>
                        <div className="cell-sub">Toán {s.grade} · {CATEGORY_LABELS[s.category]}</div>
                      </td>
                      <td>
                        <span className={`score-badge ${s.score >= 8 ? 'good' : s.score >= 5 ? 'warn' : 'bad'}`}>
                          {s.score.toFixed(2)}
                        </span>
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
                          <Eye size={14} /> Xem bài
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

      {/* TAB 2: GIAO ĐỀ */}
      {!loading && activeTab === 'assignments' && (
        <div className="stack-gap">
          <section className="panel">
            <h2>Giao đề mới cho lớp</h2>
            {classes.length === 0 ? (
              <p className="muted-text">
                Bạn chưa có lớp nào. Hãy chuyển sang tab{' '}
                <button type="button" className="link-btn" onClick={() => setActiveTab('classes')}>Lớp học</button> để tạo lớp trước.
              </p>
            ) : (
              <form onSubmit={handleCreateAssignment} className="assign-form">
                <div className="field-row">
                  <div className="field">
                    <label>Chọn lớp</label>
                    <select
                      value={assignClassId}
                      onChange={(e) => {
                        const cid = e.target.value;
                        setAssignClassId(cid);
                        const cls = classes.find((c) => c.id === cid);
                        if (cls) setAssignGrade(cls.grade);
                      }}
                    >
                      {classes.map((c) => (
                        <option key={c.id} value={c.id}>{c.name} (Khối {c.grade} · {c.studentCount} HS)</option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label>Khối đề Toán</label>
                    <select value={assignGrade} onChange={(e) => setAssignGrade(Number(e.target.value) as GradeLevel)}>
                      <option value={6}>Toán Lớp 6</option>
                      <option value={7}>Toán Lớp 7</option>
                      <option value={8}>Toán Lớp 8</option>
                      <option value={9}>Toán Lớp 9</option>
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
                    <label>Dặn dò học sinh (tùy chọn)</label>
                    <input
                      type="text"
                      placeholder="Ví dụ: Làm nghiêm túc, nộp trước tối Thứ 6"
                      value={assignNote}
                      onChange={(e) => setAssignNote(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <button type="submit" className="btn-primary">
                    <Plus size={16} /> Giao đề cho lớp
                  </button>
                </div>
              </form>
            )}
          </section>

          <section className="panel">
            <h2>Danh sách đề đã giao</h2>
            {assignments.length === 0 ? (
              <div className="empty-inline">Chưa có đề nào được giao.</div>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Lớp</th>
                      <th>Đề kiểm tra</th>
                      <th>Hạn nộp</th>
                      <th>Đã nộp</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {assignments.map((a) => {
                      const cls = classes.find((c) => c.id === a.classId);
                      return (
                        <tr key={a.id}>
                          <td><strong>{a.className}</strong></td>
                          <td>
                            <div>{a.examTitle}</div>
                            {a.note && <div className="cell-sub">{a.note}</div>}
                          </td>
                          <td className="cell-nowrap">
                            {a.dueAt ? new Date(a.dueAt).toLocaleString('vi-VN') : 'Không giới hạn'}
                          </td>
                          <td>
                            {a.submissionCount ?? 0}/{cls?.studentCount ?? 0} HS
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
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}

      {/* TAB 3: LỚP HỌC */}
      {!loading && activeTab === 'classes' && (
        <div className="stack-gap">
          <section className="panel">
            <h2>Tạo lớp học mới</h2>
            <form onSubmit={handleCreateClass} className="inline-form">
              <input
                type="text"
                required
                placeholder="Tên lớp (vd: 8A1, 6A2...)"
                value={newClassName}
                onChange={(e) => setNewClassName(e.target.value)}
              />
              <select value={newClassGrade} onChange={(e) => setNewClassGrade(Number(e.target.value) as GradeLevel)}>
                <option value={6}>Khối 6</option>
                <option value={7}>Khối 7</option>
                <option value={8}>Khối 8</option>
                <option value={9}>Khối 9</option>
              </select>
              <button type="submit" className="btn-primary">
                <Plus size={16} /> Tạo lớp
              </button>
            </form>
          </section>

          {classes.length === 0 ? (
            <div className="panel empty-inline">Chưa có lớp nào. Tạo lớp đầu tiên để lấy mã lớp gửi cho học sinh.</div>
          ) : (
            <div className="class-grid">
              {classes.map((cls) => {
                const members = membersByClass[cls.id] ?? [];
                return (
                  <div key={cls.id} className="panel class-card">
                    <div className="class-card-head">
                      <div>
                        <h3>Lớp {cls.name}</h3>
                        <span className="muted-text">Khối {cls.grade} · {members.length} học sinh</span>
                      </div>
                      <button
                        type="button"
                        className="icon-btn"
                        title="Xóa lớp"
                        onClick={() => handleDeleteClass(cls.id, cls.name)}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>

                    <div className="class-code-box">
                      <span>Mã lớp: <strong>{cls.code}</strong></span>
                      <button
                        type="button"
                        className="btn-secondary btn-sm"
                        onClick={() => {
                          void navigator.clipboard?.writeText(cls.code);
                          setCopiedCode(cls.code);
                          setTimeout(() => setCopiedCode(null), 2000);
                        }}
                      >
                        <Copy size={14} /> {copiedCode === cls.code ? 'Đã chép' : 'Chép mã'}
                      </button>
                    </div>

                    {members.length > 0 ? (
                      <ul className="member-list">
                        {members.map((m) => (
                          <li key={m.studentId}>
                            <span>{m.fullName}</span>
                            <small>{m.username}</small>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="cell-sub">Gửi mã <strong>{cls.code}</strong> để học sinh đăng ký và tham gia lớp.</div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* MODAL XEM CHI TIẾT BÀI LÀM CỦA HỌC SINH */}
      {inspectSub && (
        <div className="modal-backdrop" onClick={() => setInspectSub(null)}>
          <div className="inspect-modal" onClick={(e) => e.stopPropagation()}>
            <div className="inspect-head">
              <div>
                <h3>{inspectSub.studentName} — {inspectSub.examTitle}</h3>
                <div className="muted-text">
                  Điểm: <strong>{inspectSub.score.toFixed(2)}/10</strong> · Đúng {inspectSub.correctCount}/{inspectSub.totalQuestions} câu · Thời gian {formatDuration(inspectSub.durationSeconds)}
                </div>
              </div>
              <button type="button" className="icon-btn" onClick={() => setInspectSub(null)}>
                <X size={18} />
              </button>
            </div>
            <div className="inspect-body">
              {inspectExam && inspectGraded && inspectSub.answers ? (
                inspectExam.questions.map((q, idx) => (
                  <QuestionCard
                    key={q.id}
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
