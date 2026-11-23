import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  LayoutGrid,
  RotateCcw,
  Send,
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
import { generateCustomMathExam, getExamById } from '../content';
import { clearDraft, loadDraft, recordAttempt, saveDraft } from '../lib/storage';

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
  return { text: 'Cần cố gắng thêm', cls: 'bad' };
}

export function ExamPage() {
  const navigate = useNavigate();
  const params = useParams<{ examId?: string; grade?: string; seed?: string }>();
  const [searchParams] = useSearchParams();
  const modeParam = searchParams.get('mode') === 'practice' ? 'practice' : 'exam';

  const exam = useMemo(() => {
    if (params.examId) return getExamById(params.examId);
    const g = Number(params.grade) as GradeLevel;
    const seed = Number(params.seed) || 12345;
    if (g === 6 || g === 7 || g === 8 || g === 9) {
      return generateCustomMathExam(g, seed);
    }
    return undefined;
  }, [params.examId, params.grade, params.seed]);

  const initialDraft = useMemo(() => (exam ? loadDraft(exam.id) : null), [exam]);

  const [mode, setMode] = useState<'exam' | 'practice'>(initialDraft?.mode ?? modeParam);
  const [answers, setAnswers] = useState<Record<string, UserAnswer>>(initialDraft?.answers ?? {});
  const [flagged, setFlagged] = useState<string[]>(initialDraft?.flagged ?? []);
  const [checkedPracticeIds, setCheckedPracticeIds] = useState<Record<string, boolean>>({});
  const [startedAt, setStartedAt] = useState<number>(initialDraft?.startedAt ?? Date.now());
  const [remainingSeconds, setRemainingSeconds] = useState<number>(
    initialDraft?.remainingSeconds ?? (exam ? exam.durationMinutes * 60 : 900),
  );
  const [submitted, setSubmitted] = useState(false);
  const [reviewFilter, setReviewFilter] = useState<'all' | 'wrong'>('all');
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Countdown timer in exam mode
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

  // Auto-submit when timer hits 0
  useEffect(() => {
    if (exam && !submitted && mode === 'exam' && remainingSeconds === 0) {
      handleSubmit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remainingSeconds]);

  // Auto-save draft
  useEffect(() => {
    if (!exam || submitted) return;
    saveDraft({
      examId: exam.id,
      mode,
      startedAt,
      remainingSeconds,
      answers,
      flagged,
      updatedAt: Date.now(),
    });
  }, [exam, submitted, mode, startedAt, remainingSeconds, answers, flagged]);

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
        <div className="empty-state">
          <p>Không tìm thấy đề kiểm tra này.</p>
          <button type="button" className="btn-primary" onClick={() => navigate('/')}>
            Quay lại kho đề
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
    clearDraft(exam.id);

    const elapsed = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
    recordAttempt({
      id: `${exam.id}-${Date.now()}`,
      examId: exam.id,
      subjectId: exam.subjectId,
      grade: exam.grade,
      examTitle: exam.title,
      category: exam.category,
      mode,
      startedAt,
      submittedAt: Date.now(),
      durationSeconds: elapsed,
      score: graded.score,
      correctCount: graded.correctCount,
      totalQuestions: exam.questions.length,
      answers,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleRetry = () => {
    clearDraft(exam.id);
    setAnswers({});
    setFlagged([]);
    setCheckedPracticeIds({});
    setStartedAt(Date.now());
    setRemainingSeconds(exam.durationMinutes * 60);
    setSubmitted(false);
    setReviewFilter('all');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const scrollToQuestion = (qId: string) => {
    setMobileSheetOpen(false);
    const el = document.getElementById(`q-${qId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const answeredCount = graded.answeredCount;
  const rating = getRatingLabel(graded.score);

  const visibleQuestions = exam.questions
    .map((q, i) => ({ q, i }))
    .filter(({ q }) => {
      if (!submitted || reviewFilter === 'all') return true;
      const res = resultMap.get(q.id);
      return !res?.isFullyCorrect;
    });

  // Part breakdown after submission
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
        if (submitted) {
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
      {/* Thanh tiêu đề đề thi */}
      <div className="exam-header-bar">
        <button type="button" className="back-btn" onClick={() => navigate('/')}>
          <ArrowLeft size={17} /> Kho đề
        </button>

        <div className="exam-header-info">
          <div className="exam-badges">
            <span className={`cat-badge cat-${exam.category}`}>{CATEGORY_LABELS[exam.category]}</span>
            <span className="book-badge">Toán Lớp {exam.grade}</span>
            <span className="book-badge hide-xs">{TEXTBOOK_LABELS[exam.textbook]}</span>
          </div>
          <h1>{exam.title}</h1>
          {exam.sourceNote && <div className="exam-source">{exam.sourceNote}</div>}
        </div>

        {!submitted && (
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
              Luyện tập
            </button>
          </div>
        )}
      </div>

      {/* Mobile sticky bar */}
      <div className="mobile-exam-bar">
        <div className={`timer-pill ${remainingSeconds < 300 && mode === 'exam' && !submitted ? 'urgent' : ''}`}>
          <Clock size={15} />
          {submitted ? `${graded.score.toFixed(2)} / 10đ` : mode === 'exam' ? formatTime(remainingSeconds) : 'Luyện tập'}
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

      {/* Kết quả sau khi nộp bài */}
      {submitted && (
        <section className="result-banner">
          <div className="result-score-col">
            <div className="result-score-ring">
              <strong>{graded.score.toFixed(2)}</strong>
              <span>/ 10 điểm</span>
            </div>
            <span className={`rating-pill ${rating.cls}`}>{rating.text}</span>
          </div>

          <div className="result-details">
            <h2>Hoàn thành bài kiểm tra!</h2>
            <p>
              Bạn làm đúng trọn vẹn <strong>{graded.correctCount}/{exam.questions.length}</strong> câu. Dưới đây là{' '}
              <strong>đáp án và lời giải chi tiết</strong> cho từng câu hỏi để bạn đối chiếu và rút kinh nghiệm.
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
              <button type="button" className="btn-primary" onClick={handleRetry}>
                <RotateCcw size={16} /> Làm lại đề này
              </button>
              <button type="button" className="btn-secondary" onClick={() => navigate('/')}>
                Chọn đề khác
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Layout 2 cột trên PC, 1 cột trên Mobile */}
      <div className="exam-layout">
        <div className="exam-questions-col">
          {submitted && (
            <div className="review-filter-bar">
              <span>Xem lời giải chi tiết:</span>
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
            <div className="empty-state">
              <CheckCircle2 size={28} /> Tuyệt vời! Bạn đã làm đúng tất cả các câu hỏi trong đề này.
            </div>
          ) : (
            visibleQuestions.map(({ q, i }) => (
              <QuestionCard
                key={q.id}
                question={q}
                index={i}
                answer={answers[q.id]}
                result={resultMap.get(q.id)}
                showSolution={submitted}
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
                Đã trả lời <strong>{answeredCount}/{exam.questions.length}</strong> câu hỏi.
              </p>
              <button type="button" className="btn-primary" onClick={() => setShowConfirmModal(true)}>
                <Send size={16} /> Nộp bài & Xem lời giải chi tiết
              </button>
            </div>
          )}
        </div>

        {/* Sidebar phiếu trả lời trên PC */}
        <aside className="exam-sidebar">
          <div className="sidebar-card">
            {!submitted ? (
              <div className={`sidebar-timer ${remainingSeconds < 300 && mode === 'exam' ? 'urgent' : ''}`}>
                <Clock size={18} />
                <div>
                  <small>{mode === 'exam' ? 'Thời gian còn lại' : 'Chế độ Luyện tập'}</small>
                  <strong>{mode === 'exam' ? formatTime(remainingSeconds) : 'Không giới hạn'}</strong>
                </div>
              </div>
            ) : (
              <div className="sidebar-score">
                <small>Điểm số của bạn</small>
                <strong>{graded.score.toFixed(2)} / 10</strong>
              </div>
            )}

            <div className="sidebar-progress">
              <div className="sidebar-progress-top">
                <span>Tiến độ làm bài</span>
                <strong>
                  {answeredCount}/{exam.questions.length}
                </strong>
              </div>
              <div className="progress-track">
                <div
                  className="progress-fill"
                  style={{ width: `${Math.round((answeredCount / exam.questions.length) * 100)}%` }}
                />
              </div>
            </div>

            <div className="sidebar-section-title">Bảng câu hỏi</div>
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
                  <span><i className="dot bad" /> Chưa đúng</span>
                </>
              )}
            </div>

            {!submitted ? (
              <button
                type="button"
                className="btn-primary full-width"
                onClick={() => setShowConfirmModal(true)}
              >
                <Send size={16} /> Nộp bài & Xem lời giải
              </button>
            ) : (
              <button type="button" className="btn-primary full-width" onClick={handleRetry}>
                <RotateCcw size={16} /> Làm lại đề này
              </button>
            )}
          </div>
        </aside>
      </div>

      {/* Mobile Question Navigator Drawer */}
      {mobileSheetOpen && (
        <div className="modal-backdrop" onClick={() => setMobileSheetOpen(false)}>
          <div className="mobile-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-header">
              <strong>Phiếu trả lời ({answeredCount}/{exam.questions.length})</strong>
              <button type="button" className="icon-btn" onClick={() => setMobileSheetOpen(false)}>
                <X size={18} />
              </button>
            </div>
            {navGrid}
          </div>
        </div>
      )}

      {/* Confirm Submit Modal */}
      {showConfirmModal && (
        <div className="modal-backdrop" onClick={() => setShowConfirmModal(false)}>
          <div className="confirm-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Xác nhận nộp bài?</h3>
            <p>
              Bạn đã hoàn thành <strong>{answeredCount}/{exam.questions.length}</strong> câu hỏi.
              {answeredCount < exam.questions.length
                ? ` Vẫn còn ${exam.questions.length - answeredCount} câu chưa trả lời.`
                : ' Tất cả các câu hỏi đã được trả lời.'}
            </p>
            <p className="muted-text">Sau khi nộp bài, hệ thống sẽ chấm điểm tự động và hiển thị lời giải chi tiết từng câu.</p>
            <div className="modal-actions">
              <button type="button" className="btn-secondary" onClick={() => setShowConfirmModal(false)}>
                Kiểm tra lại
              </button>
              <button type="button" className="btn-primary" onClick={handleSubmit}>
                Nộp bài ngay
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
