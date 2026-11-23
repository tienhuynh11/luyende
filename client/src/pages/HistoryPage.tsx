import { Eye, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { gradeExam } from '@shared/scoring';
import { CATEGORY_LABELS, type GradeLevel, type SubmissionRecord } from '@shared/types';
import { MathText } from '../components/MathText';
import { QuestionCard } from '../components/QuestionCard';
import { fetchStudentDashboard, fetchStudentSubmissionDetail } from '../lib/api';
import { useAuth } from '../lib/authContext';
import { useExams } from '../lib/examStore';

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}p ${s}s` : `${s}s`;
}

export function HistoryPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const { getExam } = useExams();

  const viewParam = searchParams.get('xem') ?? '';

  const [serverSubs, setServerSubs] = useState<SubmissionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [gradeFilter, setGradeFilter] = useState<'all' | GradeLevel>('all');
  const [viewSub, setViewSub] = useState<SubmissionRecord | null>(null);

  useEffect(() => {
    if (!user) {
      setServerSubs([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchStudentDashboard()
      .then((d) => setServerSubs(d.submissions))
      .catch(() => setServerSubs([]))
      .finally(() => setLoading(false));
  }, [user]);

  const openSubmission = useCallback(async (id: string) => {
    try {
      const { submission } = await fetchStudentSubmissionDetail(id);
      setViewSub(submission);
    } catch (err) {
      alert((err as Error).message);
    }
  }, []);

  useEffect(() => {
    if (viewParam && user) {
      void openSubmission(viewParam);
    }
  }, [viewParam, user, openSubmission]);

  const rows = useMemo(() => {
    const list = serverSubs.map((s) => ({
      id: s.id,
      examId: s.examId,
      examTitle: s.examTitle,
      grade: s.grade,
      category: s.category,
      score: s.adjustedScore ?? s.score,
      correctCount: s.correctCount,
      totalQuestions: s.totalQuestions,
      durationSeconds: s.durationSeconds,
      submittedAt: new Date(s.submittedAt).getTime(),
      hasFeedback: Boolean(s.feedbackAt),
      isPublished: Boolean(s.publishedAt),
    }));
    return gradeFilter === 'all' ? list : list.filter((a) => a.grade === gradeFilter);
  }, [serverSubs, gradeFilter]);

  const stats = useMemo(() => {
    const pub = rows.filter((r) => r.isPublished);
    if (pub.length === 0) return { count: rows.length, avg: 0, best: 0, publishedCount: 0 };
    const sum = pub.reduce((acc, a) => acc + a.score, 0);
    const best = Math.max(...pub.map((a) => a.score));
    return { count: rows.length, avg: sum / pub.length, best, publishedCount: pub.length };
  }, [rows]);

  if (authLoading) return <div className="container"><div className="panel">Đang tải...</div></div>;

  if (!user) {
    return (
      <div className="container narrow-container">
        <div className="panel">
          <h1>Lịch sử làm bài</h1>
          <p className="muted-text" style={{ marginBottom: 14 }}>
            Vui lòng đăng nhập để xem lịch sử làm bài và phần chữa bài của gia sư.
          </p>
          <button type="button" className="btn-primary btn-sm" onClick={() => navigate('/dang-nhap')}>
            Đăng nhập
          </button>
        </div>
      </div>
    );
  }

  const viewExam = viewSub ? getExam(viewSub.examId) : undefined;
  const viewGraded = viewSub && viewExam && viewSub.answers ? gradeExam(viewExam, viewSub.answers) : null;

  return (
    <div className="container">
      <div className="page-head">
        <div>
          <h1>Lịch sử làm bài</h1>
          <p className="muted-text">
            Tài khoản {user.fullName} — xem lại điểm số và phần gia sư chữa bài.
          </p>
        </div>
      </div>

      <div className="stats-row">
        <div className="stat-card">
          <small>Số bài đã nộp</small>
          <strong>{stats.count}</strong>
        </div>
        <div className="stat-card">
          <small>Điểm trung bình</small>
          <strong>{stats.publishedCount ? stats.avg.toFixed(2) : '—'}</strong>
        </div>
        <div className="stat-card">
          <small>Điểm cao nhất</small>
          <strong>{stats.publishedCount ? stats.best.toFixed(2) : '—'}</strong>
        </div>
      </div>

      <div className="cat-pills" style={{ margin: '18px 0' }}>
        <button
          type="button"
          className={`pill-btn ${gradeFilter === 'all' ? 'active' : ''}`}
          onClick={() => setGradeFilter('all')}
        >
          Tất cả khối
        </button>
        {([6, 7, 8, 9] as GradeLevel[]).map((g) => (
          <button
            key={g}
            type="button"
            className={`pill-btn ${gradeFilter === g ? 'active' : ''}`}
            onClick={() => setGradeFilter(g)}
          >
            Lớp {g}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="panel">Đang tải lịch sử...</div>
      ) : rows.length === 0 ? (
        <div className="panel empty-inline">
          <p>Chưa có bài làm nào.</p>
          <button type="button" className="btn-primary btn-sm" onClick={() => navigate('/')}>
            Về trang chính
          </button>
        </div>
      ) : (
        <div className="panel table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Đề kiểm tra</th>
                <th>Khối</th>
                <th>Điểm</th>
                <th>Đúng</th>
                <th>Thời gian</th>
                <th>Nộp lúc</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((att) => (
                <tr key={att.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <strong>{att.examTitle}</strong>
                      {att.hasFeedback && <span className="tag">Gia sư đã chữa</span>}
                    </div>
                    <div className="cell-sub">{CATEGORY_LABELS[att.category]}</div>
                  </td>
                  <td>Lớp {att.grade}</td>
                  <td>
                    {att.isPublished ? (
                      <span className={`score-badge ${att.score >= 8 ? 'good' : att.score >= 5 ? 'warn' : 'bad'}`}>
                        {att.score.toFixed(2)}
                      </span>
                    ) : (
                      <span className="book-badge">Chờ chấm</span>
                    )}
                  </td>
                  <td>{att.isPublished ? `${att.correctCount}/${att.totalQuestions}` : '—'}</td>
                  <td>{formatDuration(att.durationSeconds)}</td>
                  <td className="cell-nowrap">{new Date(att.submittedAt).toLocaleString('vi-VN')}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {att.isPublished && (
                        <button
                          type="button"
                          className="btn-secondary btn-sm"
                          onClick={() => void openSubmission(att.id)}
                        >
                          <Eye size={14} /> {att.hasFeedback ? 'Xem chữa bài' : 'Xem lại'}
                        </button>
                      )}
                      {!att.examId.includes('-random-') && (
                        <button
                          type="button"
                          className="btn-secondary btn-sm"
                          onClick={() => navigate(`/de/${att.examId}?mode=exam`)}
                        >
                          Làm lại
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {viewSub && (
        <div className="modal-backdrop" onClick={() => setViewSub(null)}>
          <div className="inspect-modal" onClick={(e) => e.stopPropagation()}>
            <div className="inspect-head">
              <div>
                <h3>{viewSub.examTitle}</h3>
                <div className="muted-text">
                  Điểm: <strong>{(viewSub.adjustedScore ?? viewSub.score).toFixed(2)}/10</strong> · Đúng {viewSub.correctCount}/{viewSub.totalQuestions} câu
                </div>
              </div>
              <button type="button" className="icon-btn" onClick={() => setViewSub(null)} aria-label="Đóng">
                <X size={18} />
              </button>
            </div>
            <div className="inspect-body">
              {viewSub.teacherNote && (
                <div className="teacher-feedback-banner">
                  <strong>Nhận xét của gia sư:</strong>
                  <div><MathText text={viewSub.teacherNote} /></div>
                </div>
              )}

              {viewExam && viewGraded && viewSub.answers ? (
                viewExam.questions.map((q, idx) => {
                  const qNote = viewSub.questionNotes?.[q.id];
                  return (
                    <div key={q.id} className="inspect-q-wrap">
                      <QuestionCard
                        question={q}
                        index={idx}
                        answer={viewSub.answers![q.id]}
                        result={viewGraded.results[idx]}
                        showSolution={true}
                        isFlagged={false}
                        isPracticeMode={false}
                        onChangeAnswer={() => {}}
                        onToggleFlag={() => {}}
                      />
                      {qNote && (
                        <div className="teacher-feedback-banner">
                          <strong>Gia sư chữa câu {idx + 1}:</strong> <MathText text={qNote} />
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <p className="muted-text">Không tìm thấy chi tiết câu hỏi.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
