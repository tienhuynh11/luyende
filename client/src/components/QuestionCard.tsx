import { Bookmark, CheckCircle2, HelpCircle, XCircle } from 'lucide-react';
import { DIFFICULTY_LABELS, type Question, type QuestionResult, type UserAnswer } from '@shared/types';
import { MathText } from './MathText';

interface QuestionCardProps {
  question: Question;
  index: number;
  answer: UserAnswer | undefined;
  result?: QuestionResult;
  showSolution: boolean;
  isFlagged: boolean;
  isPracticeMode: boolean;
  isCheckedInPractice?: boolean;
  onChangeAnswer: (answer: UserAnswer) => void;
  onToggleFlag: () => void;
  onCheckPractice?: () => void;
}

const OPTION_LABELS = ['A', 'B', 'C', 'D'] as const;

export function QuestionCard({
  question,
  index,
  answer,
  result,
  showSolution,
  isFlagged,
  isPracticeMode,
  isCheckedInPractice,
  onChangeAnswer,
  onToggleFlag,
  onCheckPractice,
}: QuestionCardProps) {
  const reveal = showSolution || Boolean(isCheckedInPractice);
  const disabled = showSolution;

  const typeLabel =
    question.type === 'mcq'
      ? 'Chọn 1 đáp án'
      : question.type === 'multi-select'
        ? 'Chọn nhiều đáp án'
        : question.type === 'true-false'
          ? 'Trắc nghiệm Đúng / Sai'
          : 'Trả lời ngắn';

  const statusBadge = reveal && result ? (
    result.isFullyCorrect ? (
      <span className="q-status good">
        <CheckCircle2 size={15} /> Đúng ({result.earnedPoints.toFixed(2)}đ)
      </span>
    ) : result.earnedPoints > 0 ? (
      <span className="q-status warn">
        <HelpCircle size={15} /> Đúng một phần ({result.earnedPoints.toFixed(2)}/{result.maxPoints.toFixed(2)}đ)
      </span>
    ) : (
      <span className="q-status bad">
        <XCircle size={15} /> {result.isAnswered ? 'Chưa đúng' : 'Chưa làm'} (0đ)
      </span>
    )
  ) : null;

  return (
    <article id={`q-${question.id}`} className={`q-card ${reveal && result ? (result.isFullyCorrect ? 'is-good' : 'is-bad') : ''}`}>
      <div className="q-head">
        <div className="q-meta">
          <span className="q-num">Câu {index + 1}</span>
          <span className="q-pill">{typeLabel}</span>
          <span className="q-pill subtle">{DIFFICULTY_LABELS[question.difficulty]}</span>
          {statusBadge}
        </div>
        {!showSolution && (
          <button
            type="button"
            className={`flag-btn ${isFlagged ? 'active' : ''}`}
            onClick={onToggleFlag}
            title="Đánh dấu để xem lại"
          >
            <Bookmark size={16} fill={isFlagged ? 'currentColor' : 'none'} />
            <span className="hide-xs">{isFlagged ? 'Đã đánh dấu' : 'Đánh dấu'}</span>
          </button>
        )}
      </div>

      <div className="q-topic">{question.topic}</div>

      <div className="q-prompt">
        <MathText text={question.prompt} />
      </div>

      {/* PHẦN I: MCQ */}
      {question.type === 'mcq' && (
        <div className="mcq-grid">
          {question.options.map((opt, optIdx) => {
            const selected = answer?.type === 'mcq' && answer.selectedIndex === optIdx;
            const isCorrect = optIdx === question.correctIndex;
            let stateClass = '';
            if (reveal) {
              if (isCorrect) stateClass = 'correct';
              else if (selected && !isCorrect) stateClass = 'wrong';
            } else if (selected) {
              stateClass = 'selected';
            }

            return (
              <button
                key={optIdx}
                type="button"
                disabled={disabled}
                className={`mcq-opt ${stateClass}`}
                onClick={() => onChangeAnswer({ type: 'mcq', selectedIndex: optIdx })}
              >
                <span className="mcq-letter">{OPTION_LABELS[optIdx]}</span>
                <span className="mcq-text">
                  <MathText text={opt} />
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* PHẦN I-B: MULTI-SELECT (CHỌN NHIỀU ĐÁP ÁN) */}
      {question.type === 'multi-select' && (
        <div className="mcq-grid">
          {question.options.map((opt, optIdx) => {
            const currentSet = answer?.type === 'multi-select' ? answer.selectedIndices : [];
            const selected = currentSet.includes(optIdx);
            const isCorrect = question.correctIndices.includes(optIdx);
            let stateClass = '';
            if (reveal) {
              if (isCorrect) stateClass = 'correct';
              else if (selected && !isCorrect) stateClass = 'wrong';
            } else if (selected) {
              stateClass = 'selected';
            }

            const toggleOpt = () => {
              const next = selected
                ? currentSet.filter((i) => i !== optIdx)
                : [...currentSet, optIdx].sort((a, b) => a - b);
              onChangeAnswer({ type: 'multi-select', selectedIndices: next });
            };

            return (
              <button
                key={optIdx}
                type="button"
                disabled={disabled}
                className={`mcq-opt ${stateClass}`}
                onClick={toggleOpt}
              >
                <span className="mcq-letter">{selected ? '✓' : OPTION_LABELS[optIdx]}</span>
                <span className="mcq-text">
                  <MathText text={opt} />
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* PHẦN II: TRUE / FALSE */}
      {question.type === 'true-false' && (
        <div className="tf-list">
          {question.statements.map((stmt) => {
            const currentVal = answer?.type === 'true-false' ? answer.values[stmt.label] : null;
            const setVal = (val: boolean) => {
              const prev =
                answer?.type === 'true-false'
                  ? answer.values
                  : { a: null, b: null, c: null, d: null };
              onChangeAnswer({
                type: 'true-false',
                values: { ...prev, [stmt.label]: val },
              });
            };
            const isStmtCorrect = currentVal === stmt.isTrue;
            return (
              <div
                key={stmt.label}
                className={`tf-row ${reveal ? (isStmtCorrect ? 'correct' : 'wrong') : ''}`}
              >
                <div className="tf-text">
                  <strong className="tf-label">{stmt.label})</strong> <MathText text={stmt.text} />
                </div>
                <div className="tf-actions">
                  <button
                    type="button"
                    disabled={disabled}
                    className={`tf-btn ${currentVal === true ? 'selected' : ''} ${
                      reveal && stmt.isTrue ? 'is-answer' : ''
                    }`}
                    onClick={() => setVal(true)}
                  >
                    Đúng
                  </button>
                  <button
                    type="button"
                    disabled={disabled}
                    className={`tf-btn ${currentVal === false ? 'selected' : ''} ${
                      reveal && !stmt.isTrue ? 'is-answer' : ''
                    }`}
                    onClick={() => setVal(false)}
                  >
                    Sai
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* PHẦN III: SHORT ANSWER */}
      {question.type === 'short-answer' && (
        <div className="sa-box">
          <div className="sa-input-wrap">
            <input
              type="text"
              inputMode="text"
              disabled={disabled}
              className="sa-input"
              placeholder="Nhập đáp số (vd: 12, -3/2 hoặc 4.5)..."
              value={answer?.type === 'short-answer' ? answer.text : ''}
              onChange={(e) => onChangeAnswer({ type: 'short-answer', text: e.target.value })}
            />
            {question.unit && <span className="sa-unit">{question.unit}</span>}
          </div>
          {reveal && (
            <div className="sa-answer">
              Đáp án đúng: <strong><MathText text={question.displayAnswer} /></strong>
              {question.unit ? ` (${question.unit})` : ''}
            </div>
          )}
        </div>
      )}

      {/* Nút kiểm tra ngay ở chế độ luyện tập */}
      {isPracticeMode && !showSolution && !isCheckedInPractice && (
        <div className="q-practice-bar">
          <button type="button" className="btn-secondary btn-sm" onClick={onCheckPractice}>
            Kiểm tra & xem lời giải câu này
          </button>
        </div>
      )}

      {/* LỜI GIẢI CHI TIẾT */}
      {reveal && (
        <div className="solution-box">
          <div className="solution-title">Lời giải chi tiết</div>
          <div className="solution-body">
            <MathText text={question.explanation} />
          </div>
        </div>
      )}
    </article>
  );
}
