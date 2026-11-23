import {
  ArrowLeft,
  Clock,
  LayoutGrid,
  RotateCcw,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { gradeExam } from '@shared/scoring';
import {
  CATEGORY_LABELS,
  TEXTBOOK_LABELS,
  type GradeLevel,
  type UserAnswer,
} from '@shared/types';
import { QuestionCard } from '../components/QuestionCard';
import { generateCustomMathExam } from '../content';
import { apiSaveSubmission, fetchStudentDashboard } from '../lib/api';
import { useAuth } from '../lib/authContext';
import { useExams } from '../lib/examStore';

function formatTime(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
}

function getRatingLabel(score: number): { text: string; cls: string } {
  if (score >= 9) return { text: 'Xuất sắc', cls: 'good' };
  if (score >= 8) return { text: 'Giỏi', cls: 'good' };
  if (score >= 6.5) return { text: 'Khá', cls: 'warn' };
  if (score >= 5) return { text: 'Đạt', cls: 'warn' };
  return { text: 'Chưa đạt', cls: 'bad' };
}

export function ExamPage() {
  const navigate = useNavigate();
  const params = useParams<{ examId?: string; grade?: string; seed?: string }>();
  const [searchParams] = useSearchParams();
  const { user, refreshNotifications } = useAuth();
  const { getExam } = useExams();

  const modeParam = searchParams.get('mode') === 'practice' ? 'practice' : 'exam';
  const assignmentId = searchParams.get('assignment');

  const exam = useMemo(() => {
    if (params.examId) return getExam(params.examId);
    const g = Number(params.grade) as GradeLevel;
    const seed = Number(params.seed) || 12345;
    if (g === 6 || g === 7 || g === 8 || g === 9) {
      return generateCustomMathExam(g, seed);
    }
    return undefined;
  }, [params.examId, params.grade, params.seed, getExam]);

  const [mode, setMode] = useState<'exam' | 'practice'>(assignmentId ? 'exam' : modeParam);
  const [answers, setAnswers] = useState<Record<string, UserAnswer>>({});
  const [flagged, setFlagged] = useState<string[]>([]);
  const [checkedPracticeIds, setCheckedPracticeIds] = useState<Record<string, boolean>>({});
  const [startedAt, setStartedAt] = useState<number>(() => Date.now());
  const [remainingSeconds, setRemainingSeconds] = useState<number>(exam ? exam.durationMinutes * 60 : 900);
  const [submitted, setSubmitted] = useState(false);
  const [resultPublished, setResultPublished] = useState(true);
  const [syncSaved, setSyncSaved] = useState<'idle' | 'saved' | 'error'>('idle');
  const [reviewFilter, setReviewFilter] = useState<'all' | 'wrong'>('all');
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [accessState, setAccessState] = useState<'checking' | 'allowed' | 'denied'>('checking');

  // Chống bypass URL trực tiếp: học sinh chỉ được mở đề gia sư đã giao cho mình
  useEffect(() => {
    if (!exam) return;
    if (!user || user.role !== 'student') {
      setAccessState('allowed');
      return;
    }
    setAccessState('checking');
    fetchStudentDashboard()
      .then((d) => {
        const ok = d.assignments.some((a) => a.examId === exam.id);
        setAccessState(ok ? 'allowed' : 'denied');
      })
      .catch(() => setAccessState('denied'));
  }, [exam, user]);

  useEffect(() => {
    if (!exam || submitted || mode !== 'exam') return;
    const timer = window.setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          window.clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [exam, submitted, mode]);

  useEffect(() => {
    if (exam && !submitted && mode === 'exam' && remainingSeconds === 0) {
      handleSubmit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remainingSeconds]);

  const graded = useMemo(() => (exam ? gradeExam(exam, answers) : null), [exam, answers]);

  const resultMap = useMemo(() => {
    const map = new Map<string, NonNullable<typeof graded>['results'][number]>();
    if (!graded) return map;
    for (const r of graded.results) map.set(r.questionId, r);
    return map;
  }, [graded]);

  if (!exam || !graded) {
    return (
      <div className="container">
        <div className="panel empty-inline">
          <p>Không tìm thấy đề kiểm tra này.</p>
          <button type="button" className="btn-primary" onClick={() => navigate('/')}>
            Quay lại
          </button>
        </div>
      </div>
    );
  }

  if (user?.role === 'student' && accessState === 'checking') {
    return (
      <div className="container">
        <div className="panel empty-inline">Đang kiểm tra quyền truy cập đề...</div>
      </div>
    );
  }

  if (user?.role === 'student' && accessState === 'denied') {
    return (
      <div className="container narrow-container" style={{ marginTop: 24 }}>
        <div className="panel" style={{ textAlign: 'center' }}>
          <h2 style={{ marginBottom: 8 }}>Chưa được phép làm đề này</h2>
          <p className="muted-text" style={{ marginBottom: 14 }}>
            Đề kiểm tra này chưa được gia sư giao cho bạn.
          </p>
          <button type="button" className="btn-primary btn-sm" onClick={() => navigate('/')}>
            Về bài tập được giao
          </button>
        </div>
      </div>
    );
  }

  const handleAnswerChange = (qId: string, ans: UserAnswer) => {
    if (submitted) return;
    setAnswers((prev) => ({ ...prev, [qId]: ans }));
  };

  const handleToggleFlag = (qId: string) => {
    setFlagged((prev) => (prev.includes(qId) ? prev.filter((x) => x !== qId) : [...prev, qId]));
  };

  const handleSubmit = () => {
    if (submitted) return;
    setShowConfirmModal(false);
    setSubmitted(true);

    const elapsed = Math.max(1, Math.round((Date.now() - startedAt) / 1000));

    if (user) {
      apiSaveSubmission({
        assignmentId,
        examId: exam.id,
        examTitle: exam.title,
        grade: exam.grade,
        category: exam.category,
        mode,
        score: graded.score,
        correctCount: graded.correctCount,
        totalQuestions: exam.questions.length,
        durationSeconds: elapsed,
        answers,
      })
        .then((res) => {
          setSyncSaved('saved');
          setResultPublished(res.published);
          void refreshNotifications();
        })
        .catch(() => setSyncSaved('error'));
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleRetry = () => {
    setAnswers({});
    setFlagged([]);
    setCheckedPracticeIds({});
    setStartedAt(Date.now());
    setRemainingSeconds(exam.durationMinutes * 60);
    setSubmitted(false);
    setResultPublished(true);
    setSyncSaved('idle');
    setReviewFilter('all');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const scrollToQuestion = (qId: string) => {
    setMobileSheetOpen(false);
    const el = document.getElementById(`q-${qId}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const answeredCount = graded.answeredCount;
  const rating = getRatingLabel(graded.score);

  const visibleQuestions = exam.questions
    .map((q, i) => ({ q, i }))
    .filter(({ q }) => {
      if (!submitted || reviewFilter === 'all') return true;
      return !resultMap.get(q.id)?.isFullyCorrect;
    });

  const partStats = [
    { key: 'mcq', label: 'Phần I · Trắc nghiệm 4 lựa chọn' },
    { key: 'true-false', label: 'Phần II · Đúng / Sai' },
    { key: 'short-answer', label: 'Phần III · Trả lời ngắn' },
  ]
    .map((p) => {
      const qs = exam.questions.filter((q) => q.type === p.key);
      if (qs.length === 0) return null;
      const earned = qs.reduce((acc, q) => acc + (resultMap.get(q.id)?.earnedPoints ?? 0), 0);
      const max = qs.reduce((acc, q) => acc + (resultMap.get(q.id)?.maxPoints ?? 0), 0);
      const full = qs.filter((q) => resultMap.get(q.id)?.isFullyCorrect).length;
      return { ...p, count: qs.length, full, earned, max };
    })
    .filter(Boolean);

  const navGrid = (
    <div className="q-nav-grid">
      {exam.questions.map((q, idx) => {
        const res = resultMap.get(q.id);
        const isAns = Boolean(res?.isAnswered);
        const isFlg = flagged.includes(q.id);
        let cls = 'q-nav-btn';
        if (submitted && resultPublished) {
          cls += res?.isFullyCorrect ? ' good' : ' bad';
        } else {
          if (isAns) cls += ' answered';
          if (isFlg) cls += ' flagged';
        }
        return (
          <button key={q.id} type="button" className={cls} onClick={() => scrollToQuestion(q.id)}>
            {idx + 1}
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="container exam-page">
      <div className="exam-header-bar">
        <button type="button" className="back-btn" onClick={() => navigate('/')}>
          <ArrowLeft size={16} /> Kho đề
        </button>

        <div className="exam-header-info">
          <div className="exam-badges">
            <span className={`cat-badge cat-${exam.category}`}>{CATEGORY_LABELS[exam.category]}</span>
            <span className="book-badge">Toán Lớp {exam.grade}</span>
            <span className="book-badge hide-xs">{TEXTBOOK_LABELS[exam.textbook]}</span>
            {assignmentId && <span className="tag">Bài giáo viên giao</span>}
          </div>
          <h1>{exam.title}</h1>
          {exam.sourceNote && <div className="exam-source">{exam.sourceNote}</div>}
        </div>

        {!submitted && !assignmentId && (
          <div className="mode-switch">
            <button
              type="button"
              className={`seg-btn ${mode === 'exam' ? 'active' : ''}`}
              onClick={() => setMode('exam')}
            >
              Thi thử
            </button>
            <button
              type="button"
              className={`seg-btn ${mode === 'practice' ? 'active' : ''}`}
              onClick={() => setMode('practice')}
            >
              Luyện từng câu
            </button>
          </div>
        )}
      </div>

      {/* Mobile sticky bar */}
      <div className="mobile-exam-bar">
        <div className={`timer-pill ${remainingSeconds < 300 && mode === 'exam' && !submitted ? 'urgent' : ''}`}>
          <Clock size={15} />
          {submitted
            ? resultPublished
              ? `${graded.score.toFixed(2)} / 10đ`
              : 'Đã nộp bài'
            : mode === 'exam'
              ? formatTime(remainingSeconds)
              : 'Luyện tập'}
        </div>
        <button type="button" className="btn-secondary btn-sm" onClick={() => setMobileSheetOpen(true)}>
          <LayoutGrid size={15} /> Phiếu ({answeredCount}/{exam.questions.length})
        </button>
        {!submitted ? (
          <button type="button" className="btn-primary btn-sm" onClick={() => setShowConfirmModal(true)}>
            Nộp bài
          </button>
        ) : (
          <button type="button" className="btn-primary btn-sm" onClick={handleRetry}>
            <RotateCcw size={14} /> Làm lại
          </button>
        )}
      </div>

      {submitted && !resultPublished && (
        <section className="panel" style={{ marginBottom: 18, borderLeft: '3px solid var(--accent)' }}>
          <h2 style={{ marginBottom: 6 }}>Đã nộp bài thành công</h2>
          <p className="muted-text" style={{ marginBottom: 14 }}>
            Đề này đang ở chế độ <strong>chờ gia sư xem và xác nhận công bố kết quả</strong>. Khi gia sư chấm chữa và
            xác nhận xong, điểm số cùng lời giải chi tiết sẽ hiển thị ở mục <strong>Lịch sử</strong> và báo ở chuông
            thông báo.
          </p>
          <button type="button" className="btn-primary btn-sm" onClick={() => navigate('/')}>
            Quay về bài tập được giao
          </button>
        </section>
      )}

      {submitted && resultPublished && (
        <section className="result-banner">
          <div className="result-score-col">
            <div className="result-score-box">
              <strong>{graded.score.toFixed(2)}</strong>
              <span>/ 10 điểm</span>
            </div>
            <span className={`rating-pill ${rating.cls}`}>{rating.text}</span>
          </div>

          <div className="result-details">
            <h2>Kết quả bài làm</h2>
            <p>
              Đúng trọn vẹn <strong>{graded.correctCount}/{exam.questions.length}</strong> câu.
              {syncSaved === 'saved' && ' Kết quả đã được lưu lên hệ thống cho giáo viên theo dõi.'}
              {syncSaved === 'error' && ' (Chưa gửi được kết quả lên máy chủ, đã lưu tạm trên máy.)'}
            </p>
            <div className="part-breakdown">
              {partStats.map(
                (ps) =>
                  ps && (
                    <div key={ps.key} className="part-stat">
                      <span>{ps.label}</span>
                      <strong>
                        {ps.full}/{ps.count} câu ({ps.earned.toFixed(2)}/{ps.max.toFixed(2)}đ)
                      </strong>
                    </div>
                  ),
              )}
            </div>
            <div className="result-actions">
              <button type="button" className="btn-primary btn-sm" onClick={handleRetry}>
                <RotateCcw size={15} /> Làm lại đề này
              </button>
              <button type="button" className="btn-secondary btn-sm" onClick={() => navigate('/')}>
                Về kho đề
              </button>
            </div>
          </div>
        </section>
      )}

      <div className="exam-layout">
        <div className="exam-questions-col">
          {submitted && resultPublished && (
            <div className="review-filter-bar">
              <span>Đáp án & Lời giải chi tiết</span>
              <div className="cat-pills">
                <button
                  type="button"
                  className={`pill-btn ${reviewFilter === 'all' ? 'active' : ''}`}
                  onClick={() => setReviewFilter('all')}
                >
                  Tất cả ({exam.questions.length})
                </button>
                <button
                  type="button"
                  className={`pill-btn ${reviewFilter === 'wrong' ? 'active' : ''}`}
                  onClick={() => setReviewFilter('wrong')}
                >
                  Câu chưa đúng ({exam.questions.length - graded.correctCount})
                </button>
              </div>
            </div>
          )}

          {visibleQuestions.length === 0 ? (
            <div className="panel empty-inline">Bạn đã làm đúng tất cả các câu hỏi trong đề này.</div>
          ) : (
            visibleQuestions.map(({ q, i }) => (
              <QuestionCard
                key={q.id}
                question={q}
                index={i}
                answer={answers[q.id]}
                result={resultMap.get(q.id)}
                showSolution={submitted && resultPublished}
                isFlagged={flagged.includes(q.id)}
                isPracticeMode={mode === 'practice'}
                isCheckedInPractice={Boolean(checkedPracticeIds[q.id])}
                onChangeAnswer={(ans) => handleAnswerChange(q.id, ans)}
                onToggleFlag={() => handleToggleFlag(q.id)}
                onCheckPractice={() => setCheckedPracticeIds((prev) => ({ ...prev, [q.id]: true }))}
              />
            ))
          )}

          {!submitted && (
            <div className="bottom-submit-box">
              <p>
                Đã trả lời <strong>{answeredCount}/{exam.questions.length}</strong> câu.
              </p>
              <button type="button" className="btn-primary" onClick={() => setShowConfirmModal(true)}>
                Nộp bài & Xem lời giải
              </button>
            </div>
          )}
        </div>

        <aside className="exam-sidebar">
          <div className="sidebar-card">
            {!submitted ? (
              <div className={`sidebar-timer ${remainingSeconds < 300 && mode === 'exam' ? 'urgent' : ''}`}>
                <Clock size={17} />
                <div>
                  <small>{mode === 'exam' ? 'Thời gian còn lại' : 'Chế độ luyện từng câu'}</small>
                  <strong>{mode === 'exam' ? formatTime(remainingSeconds) : 'Không giới hạn'}</strong>
                </div>
              </div>
            ) : (
              <div className="sidebar-score">
                <small>{resultPublished ? 'Điểm số' : 'Trạng thái'}</small>
                <strong>{resultPublished ? `${graded.score.toFixed(2)} / 10` : 'Chờ gia sư chấm'}</strong>
              </div>
            )}

            <div className="sidebar-progress">
              <div className="sidebar-progress-top">
                <span>Đã làm</span>
                <strong>{answeredCount}/{exam.questions.length}</strong>
              </div>
              <div className="progress-track">
                <div
                  className="progress-fill"
                  style={{ width: `${Math.round((answeredCount / exam.questions.length) * 100)}%` }}
                />
              </div>
            </div>

            <div className="sidebar-section-title">Phiếu câu hỏi</div>
            {navGrid}

            <div className="nav-legend">
              {!submitted ? (
                <>
                  <span><i className="dot answered" /> Đã làm</span>
                  <span><i className="dot flagged" /> Đánh dấu</span>
                  <span><i className="dot" /> Chưa làm</span>
                </>
              ) : (
                <>
                  <span><i className="dot good" /> Đúng</span>
                  <span><i className="dot bad" /> Sai</span>
                </>
              )}
            </div>

            {!submitted ? (
              <button type="button" className="btn-primary full-width" onClick={() => setShowConfirmModal(true)}>
                Nộp bài
              </button>
            ) : (
              <button type="button" className="btn-primary full-width" onClick={handleRetry}>
                <RotateCcw size={15} /> Làm lại đề này
              </button>
            )}
          </div>
        </aside>
      </div>

      {mobileSheetOpen && (
        <div className="modal-backdrop" onClick={() => setMobileSheetOpen(false)}>
          <div className="mobile-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-header">
              <strong>Phiếu câu hỏi ({answeredCount}/{exam.questions.length})</strong>
              <button type="button" className="icon-btn" onClick={() => setMobileSheetOpen(false)}>
                <X size={18} />
              </button>
            </div>
            {navGrid}
          </div>
        </div>
      )}

      {showConfirmModal && (
        <div className="modal-backdrop" onClick={() => setShowConfirmModal(false)}>
          <div className="confirm-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Xác nhận nộp bài?</h3>
            <p>
              Bạn đã làm <strong>{answeredCount}/{exam.questions.length}</strong> câu.
              {answeredCount < exam.questions.length
                ? ` Còn ${exam.questions.length - answeredCount} câu chưa chọn đáp án.`
                : ''}
            </p>
            <div className="modal-actions">
              <button type="button" className="btn-secondary" onClick={() => setShowConfirmModal(false)}>
                Kiểm tra lại
              </button>
              <button type="button" className="btn-primary" onClick={handleSubmit}>
                Nộp bài
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
