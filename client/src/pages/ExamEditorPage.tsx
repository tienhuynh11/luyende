import { ArrowDown, ArrowLeft, ArrowUp, Copy, Plus, RotateCcw, Save, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  CATEGORY_LABELS,
  DIFFICULTY_LABELS,
  TEXTBOOK_LABELS,
  type DifficultyLevel,
  type Exam,
  type ExamCategory,
  type GradeLevel,
  type McqQuestion,
  type MultiSelectQuestion,
  type Question,
  type ShortAnswerQuestion,
  type SubjectId,
  type TextbookSeries,
  type TrueFalseQuestion,
} from '@shared/types';
import { MathText } from '../components/MathText';
import { SUBJECTS } from '../content';
import { apiDeleteOrHideExam, apiSaveExam } from '../lib/api';
import { useAuth } from '../lib/authContext';
import { useExams } from '../lib/examStore';

const MATH_SNIPPETS = [
  { label: 'Phân số', code: '$\\dfrac{a}{b}$' },
  { label: 'Căn', code: '$\\sqrt{x}$' },
  { label: 'Lũy thừa', code: '$x^{2}$' },
  { label: 'Góc', code: '$\\widehat{ABC}$' },
  { label: 'Độ', code: '$90^\\circ$' },
  { label: 'Tam giác', code: '$\\triangle ABC$' },
  { label: '≤', code: '$\\le$' },
  { label: '≥', code: '$\\ge$' },
  { label: '≠', code: '$\\ne$' },
  { label: '∥', code: '$\\parallel$' },
  { label: '⊥', code: '$\\perp$' },
];

function makeId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function createEmptyMcq(): McqQuestion {
  return {
    id: makeId('mcq'),
    type: 'mcq',
    prompt: 'Nhập nội dung câu hỏi... (có thể gõ công thức như $x^2 - 4 = 0$)',
    options: ['Phương án A', 'Phương án B', 'Phương án C', 'Phương án D'],
    correctIndex: 0,
    explanation: 'Nhập lời giải chi tiết cho câu này...',
    topic: 'Tổng hợp',
    difficulty: 'thong-hieu',
  };
}

function createEmptyMultiSelect(): MultiSelectQuestion {
  return {
    id: makeId('ms'),
    type: 'multi-select',
    prompt: 'Chọn tất cả các khẳng định đúng sau đây:',
    options: ['Khẳng định A', 'Khẳng định B', 'Khẳng định C', 'Khẳng định D'],
    correctIndices: [0, 1],
    explanation: 'Giải thích lý do các đáp án đúng...',
    topic: 'Tổng hợp',
    difficulty: 'thong-hieu',
  };
}

function createEmptyTrueFalse(): TrueFalseQuestion {
  return {
    id: makeId('tf'),
    type: 'true-false',
    prompt: 'Xét tính Đúng / Sai của các khẳng định sau:',
    statements: [
      { label: 'a', text: 'Khẳng định a)', isTrue: true },
      { label: 'b', text: 'Khẳng định b)', isTrue: false },
      { label: 'c', text: 'Khẳng định c)', isTrue: true },
      { label: 'd', text: 'Khẳng định d)', isTrue: false },
    ],
    explanation: '• a) Đúng vì...\n• b) Sai vì...\n• c) Đúng vì...\n• d) Sai vì...',
    topic: 'Tổng hợp',
    difficulty: 'thong-hieu',
  };
}

function createEmptyShortAnswer(): ShortAnswerQuestion {
  return {
    id: makeId('sa'),
    type: 'short-answer',
    prompt: 'Tính giá trị của biểu thức...',
    acceptedAnswers: ['0'],
    displayAnswer: '$0$',
    unit: '',
    explanation: 'Lời giải chi tiết...',
    topic: 'Tổng hợp',
    difficulty: 'van-dung',
  };
}

function createBlankExam(): Exam {
  return {
    id: makeId('custom'),
    subjectId: 'toan',
    grade: 6,
    title: 'Đề kiểm tra mới',
    subtitle: 'Đề do giáo viên biên soạn',
    category: 'cuoi-hk1',
    textbook: 'chung',
    term: 'HK1',
    schoolYear: '2026-2027',
    durationMinutes: 45,
    topics: [],
    questions: [createEmptyMcq()],
    sourceNote: 'Giáo viên biên soạn',
  };
}

export function ExamEditorPage() {
  const navigate = useNavigate();
  const { examId } = useParams<{ examId?: string }>();
  const { user, loading: authLoading } = useAuth();
  const { getExam, isBuiltIn, isOverridden, reloadExams } = useExams();

  const [draft, setDraft] = useState<Exam>(() => {
    if (examId) {
      const found = getExam(examId);
      if (found) return structuredClone(found);
    }
    return createBlankExam();
  });

  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [previewOpen, setPreviewOpen] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!examId) return;
    const found = getExam(examId);
    if (found) {
      setDraft(structuredClone(found));
    }
  }, [examId, getExam]);

  if (authLoading) {
    return <div className="container"><div className="panel">Đang tải...</div></div>;
  }

  if (!user || user.role !== 'teacher') {
    return (
      <div className="container narrow-container">
        <div className="panel">
          <h1>Chỉ giáo viên mới được sửa đề</h1>
          <p className="muted-text">Vui lòng đăng nhập bằng tài khoản giáo viên.</p>
          <button type="button" className="btn-primary" onClick={() => navigate('/dang-nhap')}>
            Đăng nhập
          </button>
        </div>
      </div>
    );
  }

  const editingBuiltIn = isBuiltIn(draft.id);
  const hasOverride = isOverridden(draft.id);

  const updateQuestion = (index: number, nextQ: Question) => {
    setDraft((prev) => {
      const qs = [...prev.questions];
      qs[index] = nextQ;
      return { ...prev, questions: qs };
    });
  };

  const moveQuestion = (index: number, delta: -1 | 1) => {
    setDraft((prev) => {
      const target = index + delta;
      if (target < 0 || target >= prev.questions.length) return prev;
      const qs = [...prev.questions];
      [qs[index], qs[target]] = [qs[target], qs[index]];
      return { ...prev, questions: qs };
    });
  };

  const duplicateQuestion = (index: number) => {
    setDraft((prev) => {
      const copy = structuredClone(prev.questions[index]);
      copy.id = makeId(copy.type);
      const qs = [...prev.questions];
      qs.splice(index + 1, 0, copy);
      return { ...prev, questions: qs };
    });
  };

  const removeQuestion = (index: number) => {
    if (draft.questions.length <= 1) {
      alert('Đề kiểm tra cần có ít nhất 1 câu hỏi.');
      return;
    }
    setDraft((prev) => ({
      ...prev,
      questions: prev.questions.filter((_, i) => i !== index),
    }));
  };

  const appendQuestion = (q: Question) => {
    setDraft((prev) => ({ ...prev, questions: [...prev.questions, q] }));
    setPreviewOpen((prev) => ({ ...prev, [q.id]: true }));
  };

  const handleSave = async () => {
    if (!draft.title.trim()) {
      setStatusMsg({ type: 'err', text: 'Vui lòng nhập tiêu đề đề kiểm tra.' });
      return;
    }
    setSaving(true);
    setStatusMsg(null);
    try {
      const { stored } = await apiSaveExam(draft);
      await reloadExams();
      setStatusMsg({ type: 'ok', text: 'Đã lưu đề thành công! Học sinh sẽ thấy phiên bản mới ngay.' });
      if (!examId) {
        navigate(`/giao-vien/sua-de/${stored.exam.id}`, { replace: true });
      }
    } catch (err) {
      setStatusMsg({ type: 'err', text: (err as Error).message });
    } finally {
      setSaving(false);
    }
  };

  const handleDuplicateAsNew = async () => {
    const newId = makeId('custom');
    const copy: Exam = {
      ...structuredClone(draft),
      id: newId,
      title: `${draft.title} (Bản sao)`,
    };
    setSaving(true);
    setStatusMsg(null);
    try {
      await apiSaveExam(copy);
      await reloadExams();
      setDraft(copy);
      setStatusMsg({ type: 'ok', text: 'Đã nhân bản thành đề mới độc lập.' });
      navigate(`/giao-vien/sua-de/${newId}`, { replace: true });
    } catch (err) {
      setStatusMsg({ type: 'err', text: (err as Error).message });
    } finally {
      setSaving(false);
    }
  };

  const handleResetBuiltIn = async () => {
    if (!window.confirm('Khôi phục đề này về nguyên bản ban đầu của hệ thống?')) return;
    setSaving(true);
    try {
      await apiDeleteOrHideExam(draft.id, 'delete');
      await reloadExams();
      setStatusMsg({ type: 'ok', text: 'Đã khôi phục đề gốc.' });
    } catch (err) {
      setStatusMsg({ type: 'err', text: (err as Error).message });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteOrHide = async () => {
    const msg = editingBuiltIn
      ? 'Ẩn đề mặc định này khỏi kho đề của học sinh? (Bạn có thể khôi phục sau nếu cần)'
      : 'Xóa vĩnh viễn đề tự tạo này?';
    if (!window.confirm(msg)) return;
    setSaving(true);
    try {
      await apiDeleteOrHideExam(draft.id, editingBuiltIn ? 'hide' : 'delete');
      await reloadExams();
      navigate('/');
    } catch (err) {
      setStatusMsg({ type: 'err', text: (err as Error).message });
      setSaving(false);
    }
  };

  return (
    <div className="container">
      <div className="page-head">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button type="button" className="back-btn" onClick={() => navigate(-1)}>
            <ArrowLeft size={16} /> Quay lại
          </button>
          <div>
            <h1>{examId ? 'Chỉnh sửa đề kiểm tra' : 'Tạo đề kiểm tra mới'}</h1>
            <div className="muted-text">
              {editingBuiltIn
                ? hasOverride
                  ? 'Đề hệ thống (đã chỉnh sửa riêng)'
                  : 'Đề hệ thống — lưu sẽ tạo bản chỉnh sửa riêng trên máy chủ'
                : 'Đề tự biên soạn'}
            </div>
          </div>
        </div>

        <div className="editor-top-actions">
          {examId && (
            <button type="button" className="btn-secondary btn-sm" disabled={saving} onClick={handleDuplicateAsNew}>
              <Copy size={15} /> Nhân bản thành đề mới
            </button>
          )}
          {hasOverride && (
            <button type="button" className="btn-secondary btn-sm" disabled={saving} onClick={handleResetBuiltIn}>
              <RotateCcw size={15} /> Khôi phục đề gốc
            </button>
          )}
          {examId && (
            <button type="button" className="btn-secondary btn-sm" disabled={saving} onClick={handleDeleteOrHide}>
              <Trash2 size={15} /> Xóa đề
            </button>
          )}
          <button type="button" className="btn-primary btn-sm" disabled={saving} onClick={handleSave}>
            <Save size={15} /> {saving ? 'Đang lưu...' : 'Lưu đề'}
          </button>
        </div>
      </div>

      {statusMsg && (
        <div className={statusMsg.type === 'ok' ? 'info-note' : 'form-error'} style={{ marginBottom: 14 }}>
          {statusMsg.text}
        </div>
      )}

      {/* THÔNG TIN CHUNG CỦA ĐỀ */}
      <section className="panel" style={{ marginBottom: 16 }}>
        <h2>Thông tin chung</h2>
        <div className="form-stack">
          <div className="field">
            <label>Tiêu đề đề kiểm tra</label>
            <input
              type="text"
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            />
          </div>

          <div className="field">
            <label>Mô tả ngắn</label>
            <input
              type="text"
              value={draft.subtitle}
              onChange={(e) => setDraft({ ...draft, subtitle: e.target.value })}
            />
          </div>

          <div className="editor-meta-grid">
            <div className="field">
              <label>Môn học</label>
              <select
                value={draft.subjectId}
                onChange={(e) => setDraft({ ...draft, subjectId: e.target.value as SubjectId })}
              >
                {SUBJECTS.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            <div className="field">
              <label>Khối lớp</label>
              <select
                value={draft.grade}
                onChange={(e) => setDraft({ ...draft, grade: Number(e.target.value) as GradeLevel })}
              >
                <option value={6}>Lớp 6</option>
                <option value={7}>Lớp 7</option>
                <option value={8}>Lớp 8</option>
                <option value={9}>Lớp 9</option>
              </select>
            </div>

            <div className="field">
              <label>Kỳ kiểm tra</label>
              <select
                value={draft.category}
                onChange={(e) => setDraft({ ...draft, category: e.target.value as ExamCategory })}
              >
                {(Object.keys(CATEGORY_LABELS) as ExamCategory[]).map((k) => (
                  <option key={k} value={k}>{CATEGORY_LABELS[k]}</option>
                ))}
              </select>
            </div>

            <div className="field">
              <label>Bộ sách</label>
              <select
                value={draft.textbook}
                onChange={(e) => setDraft({ ...draft, textbook: e.target.value as TextbookSeries })}
              >
                {(Object.keys(TEXTBOOK_LABELS) as TextbookSeries[]).map((k) => (
                  <option key={k} value={k}>{TEXTBOOK_LABELS[k]}</option>
                ))}
              </select>
            </div>

            <div className="field">
              <label>Thời gian (phút)</label>
              <input
                type="number"
                min={5}
                max={180}
                value={draft.durationMinutes}
                onChange={(e) => setDraft({ ...draft, durationMinutes: Number(e.target.value) || 45 })}
              />
            </div>

            <div className="field">
              <label>Ghi chú nguồn</label>
              <input
                type="text"
                value={draft.sourceNote ?? ''}
                onChange={(e) => setDraft({ ...draft, sourceNote: e.target.value })}
              />
            </div>
          </div>
        </div>
      </section>

      {/* THANH CHÈN KÝ HIỆU TOÁN NHANH */}
      <div className="snippet-bar">
        <span className="muted-inline">Chép nhanh công thức LaTeX (bấm để copy):</span>
        {MATH_SNIPPETS.map((sn) => (
          <button
            key={sn.label}
            type="button"
            className="snippet-btn"
            onClick={() => void navigator.clipboard?.writeText(sn.code)}
            title={`Copy ${sn.code}`}
          >
            {sn.label}
          </button>
        ))}
      </div>

      {/* DANH SÁCH CÂU HỎI */}
      <div className="stack-gap">
        {draft.questions.map((q, idx) => {
          const isPreview = Boolean(previewOpen[q.id]);
          return (
            <section key={q.id} className="panel editor-q-card">
              <div className="editor-q-head">
                <div className="q-meta">
                  <span className="q-num">Câu {idx + 1}</span>
                  <span className="q-pill">
                    {q.type === 'mcq'
                      ? 'Chọn 1 đáp án'
                      : q.type === 'multi-select'
                        ? 'Chọn nhiều đáp án'
                        : q.type === 'true-false'
                          ? 'Đúng / Sai (4 ý)'
                          : 'Trả lời ngắn'}
                  </span>
                  <button
                    type="button"
                    className="link-btn"
                    style={{ fontSize: 13 }}
                    onClick={() => setPreviewOpen((p) => ({ ...p, [q.id]: !p[q.id] }))}
                  >
                    {isPreview ? 'Ẩn xem trước' : 'Xem trước công thức'}
                  </button>
                </div>

                <div className="editor-q-tools">
                  <button type="button" className="icon-btn" title="Đưa lên" disabled={idx === 0} onClick={() => moveQuestion(idx, -1)}>
                    <ArrowUp size={15} />
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    title="Đưa xuống"
                    disabled={idx === draft.questions.length - 1}
                    onClick={() => moveQuestion(idx, 1)}
                  >
                    <ArrowDown size={15} />
                  </button>
                  <button type="button" className="icon-btn" title="Nhân bản câu này" onClick={() => duplicateQuestion(idx)}>
                    <Copy size={15} />
                  </button>
                  <button type="button" className="icon-btn" title="Xóa câu này" onClick={() => removeQuestion(idx)}>
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>

              <div className="field-row" style={{ marginBottom: 10 }}>
                <div className="field">
                  <label>Chuyên đề</label>
                  <input
                    type="text"
                    value={q.topic}
                    onChange={(e) => updateQuestion(idx, { ...q, topic: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>Mức độ</label>
                  <select
                    value={q.difficulty}
                    onChange={(e) => updateQuestion(idx, { ...q, difficulty: e.target.value as DifficultyLevel })}
                  >
                    {(Object.keys(DIFFICULTY_LABELS) as DifficultyLevel[]).map((d) => (
                      <option key={d} value={d}>{DIFFICULTY_LABELS[d]}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="field" style={{ marginBottom: 10 }}>
                <label>Đề bài (gõ công thức Toán trong cặp dấu <code>$...$</code>)</label>
                <textarea
                  className="editor-textarea"
                  rows={2}
                  value={q.prompt}
                  onChange={(e) => updateQuestion(idx, { ...q, prompt: e.target.value })}
                />
                {isPreview && (
                  <div className="preview-box">
                    <MathText text={q.prompt} />
                  </div>
                )}
              </div>

              {/* MCQ EDITOR */}
              {q.type === 'mcq' && (
                <div className="editor-opts">
                  <label style={{ fontSize: 13.5, fontWeight: 600 }}>4 phương án (tích chọn đáp án đúng):</label>
                  {(['A', 'B', 'C', 'D'] as const).map((letter, optIdx) => (
                    <div key={letter} className="editor-opt-row">
                      <input
                        type="radio"
                        name={`correct-${q.id}`}
                        checked={q.correctIndex === optIdx}
                        onChange={() => updateQuestion(idx, { ...q, correctIndex: optIdx as 0 | 1 | 2 | 3 })}
                      />
                      <strong style={{ width: 20 }}>{letter}.</strong>
                      <input
                        type="text"
                        className="sa-input"
                        style={{ maxWidth: 'none' }}
                        value={q.options[optIdx]}
                        onChange={(e) => {
                          const opts = [...q.options] as [string, string, string, string];
                          opts[optIdx] = e.target.value;
                          updateQuestion(idx, { ...q, options: opts });
                        }}
                      />
                      {isPreview && (
                        <span className="opt-preview">
                          <MathText text={q.options[optIdx]} />
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* MULTI-SELECT EDITOR */}
              {q.type === 'multi-select' && (
                <div className="editor-opts">
                  <label style={{ fontSize: 13.5, fontWeight: 600 }}>4 phương án (tích chọn tất cả đáp án đúng):</label>
                  {(['A', 'B', 'C', 'D'] as const).map((letter, optIdx) => {
                    const checked = q.correctIndices.includes(optIdx);
                    return (
                      <div key={letter} className="editor-opt-row">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            const next = checked
                              ? q.correctIndices.filter((i) => i !== optIdx)
                              : [...q.correctIndices, optIdx].sort((a, b) => a - b);
                            updateQuestion(idx, { ...q, correctIndices: next.length ? next : [optIdx] });
                          }}
                        />
                        <strong style={{ width: 20 }}>{letter}.</strong>
                        <input
                          type="text"
                          className="sa-input"
                          style={{ maxWidth: 'none' }}
                          value={q.options[optIdx]}
                          onChange={(e) => {
                            const opts = [...q.options] as [string, string, string, string];
                            opts[optIdx] = e.target.value;
                            updateQuestion(idx, { ...q, options: opts });
                          }}
                        />
                        {isPreview && (
                          <span className="opt-preview">
                            <MathText text={q.options[optIdx]} />
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* TRUE/FALSE EDITOR */}
              {q.type === 'true-false' && (
                <div className="editor-opts">
                  <label style={{ fontSize: 13.5, fontWeight: 600 }}>4 ý Đúng / Sai:</label>
                  {q.statements.map((stmt, sIdx) => (
                    <div key={stmt.label} className="editor-opt-row">
                      <strong style={{ width: 22 }}>{stmt.label})</strong>
                      <input
                        type="text"
                        className="sa-input"
                        style={{ maxWidth: 'none' }}
                        value={stmt.text}
                        onChange={(e) => {
                          const stmts = [...q.statements] as TrueFalseQuestion['statements'];
                          stmts[sIdx] = { ...stmt, text: e.target.value };
                          updateQuestion(idx, { ...q, statements: stmts });
                        }}
                      />
                      <select
                        className="select-input"
                        value={stmt.isTrue ? 'true' : 'false'}
                        onChange={(e) => {
                          const stmts = [...q.statements] as TrueFalseQuestion['statements'];
                          stmts[sIdx] = { ...stmt, isTrue: e.target.value === 'true' };
                          updateQuestion(idx, { ...q, statements: stmts });
                        }}
                      >
                        <option value="true">Đúng</option>
                        <option value="false">Sai</option>
                      </select>
                    </div>
                  ))}
                </div>
              )}

              {/* SHORT ANSWER EDITOR */}
              {q.type === 'short-answer' && (
                <div className="field-row" style={{ marginBottom: 10 }}>
                  <div className="field">
                    <label>Các đáp án chấp nhận (cách nhau bởi dấu phẩy, vd: <code>3/2, 1.5</code>)</label>
                    <input
                      type="text"
                      value={q.acceptedAnswers.join(', ')}
                      onChange={(e) => {
                        const list = e.target.value.split(',').map((s) => s.trim()).filter(Boolean);
                        updateQuestion(idx, {
                          ...q,
                          acceptedAnswers: list.length ? list : [''],
                          displayAnswer: list[0] ? `$${list[0]}$` : q.displayAnswer,
                        });
                      }}
                    />
                  </div>
                  <div className="field">
                    <label>Đơn vị (tùy chọn, vd: cm, m, độ)</label>
                    <input
                      type="text"
                      value={q.unit ?? ''}
                      onChange={(e) => updateQuestion(idx, { ...q, unit: e.target.value })}
                    />
                  </div>
                </div>
              )}

              {/* LỜI GIẢI CHI TIẾT */}
              <div className="field" style={{ marginTop: 10 }}>
                <label>Lời giải chi tiết (hiển thị cho học sinh sau khi nộp bài)</label>
                <textarea
                  className="editor-textarea"
                  rows={3}
                  value={q.explanation}
                  onChange={(e) => updateQuestion(idx, { ...q, explanation: e.target.value })}
                />
                {isPreview && (
                  <div className="preview-box">
                    <MathText text={q.explanation} />
                  </div>
                )}
              </div>
            </section>
          );
        })}
      </div>

      {/* THÊM CÂU HỎI & LƯU */}
      <div className="editor-bottom-bar">
        <div className="editor-add-group">
          <button type="button" className="btn-secondary btn-sm" onClick={() => appendQuestion(createEmptyMcq())}>
            <Plus size={15} /> Chọn 1 đáp án
          </button>
          <button type="button" className="btn-secondary btn-sm" onClick={() => appendQuestion(createEmptyMultiSelect())}>
            <Plus size={15} /> Chọn nhiều đáp án
          </button>
          <button type="button" className="btn-secondary btn-sm" onClick={() => appendQuestion(createEmptyTrueFalse())}>
            <Plus size={15} /> Đúng / Sai
          </button>
          <button type="button" className="btn-secondary btn-sm" onClick={() => appendQuestion(createEmptyShortAnswer())}>
            <Plus size={15} /> Trả lời ngắn
          </button>
        </div>

        <button type="button" className="btn-primary" disabled={saving} onClick={handleSave}>
          <Save size={16} /> {saving ? 'Đang lưu...' : `Lưu đề (${draft.questions.length} câu)`}
        </button>
      </div>
    </div>
  );
}
