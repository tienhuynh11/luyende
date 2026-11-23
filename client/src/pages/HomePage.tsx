import {
  Award,
  BookMarked,
  Clock,
  FileText,
  Play,
  Search,
  Shuffle,
  Sparkles,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CATEGORY_LABELS,
  TEXTBOOK_LABELS,
  type ExamCategory,
  type GradeLevel,
  type SubjectId,
  type TextbookSeries,
} from '@shared/types';
import { SUBJECTS, getExams } from '../content';
import { loadDraft, loadProgress } from '../lib/storage';

const GRADES: GradeLevel[] = [6, 7, 8, 9];
const CATEGORIES: Array<{ id: 'all' | ExamCategory; label: string }> = [
  { id: 'all', label: 'Tất cả' },
  { id: 'cuoi-hk1', label: 'Cuối HK1' },
  { id: 'giua-hk1', label: 'Giữa HK1' },
  { id: 'kiem-tra-15p', label: '15 phút' },
  { id: 'on-tap-chuong', label: 'Ôn tập chương' },
];

export function HomePage() {
  const navigate = useNavigate();
  const [subjectId, setSubjectId] = useState<SubjectId>('toan');
  const [grade, setGrade] = useState<GradeLevel>(() => {
    const saved = Number(localStorage.getItem('luyende_grade'));
    return saved === 6 || saved === 7 || saved === 8 || saved === 9 ? saved : 6;
  });
  const [category, setCategory] = useState<'all' | ExamCategory>('all');
  const [textbook, setTextbook] = useState<'all' | TextbookSeries>('all');
  const [query, setQuery] = useState('');

  const progress = useMemo(() => loadProgress(), []);

  const bestScoreByExam = useMemo(() => {
    const map = new Map<string, number>();
    for (const att of progress.attempts) {
      const prev = map.get(att.examId);
      if (prev === undefined || att.score > prev) map.set(att.examId, att.score);
    }
    return map;
  }, [progress]);

  const exams = useMemo(() => getExams(subjectId, grade), [subjectId, grade]);

  const filteredExams = useMemo(() => {
    const q = query.trim().toLowerCase();
    return exams.filter((exam) => {
      if (category !== 'all' && exam.category !== category) return false;
      if (textbook !== 'all' && exam.textbook !== textbook && exam.textbook !== 'chung') return false;
      if (q) {
        const hay = `${exam.title} ${exam.subtitle} ${exam.topics.join(' ')}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [exams, category, textbook, query]);

  const handleSelectGrade = (g: GradeLevel) => {
    setGrade(g);
    localStorage.setItem('luyende_grade', String(g));
  };

  const handleRandomExam = () => {
    const seed = Math.floor(Date.now() % 1000000);
    navigate(`/de/random/${grade}/${seed}?mode=exam`);
  };

  const completedInGrade = exams.filter((e) => bestScoreByExam.has(e.id)).length;

  return (
    <div className="container">
      {/* Hero Banner */}
      <section className="hero">
        <div className="hero-content">
          <div className="hero-badge">
            <Sparkles size={14} /> Học kì 1 · Năm học 2026–2027 · Chuẩn GDPT 2018
          </div>
          <h1>Luyện đề kiểm tra trắc nghiệm THCS</h1>
          <p className="hero-desc">
            Tổng hợp <strong>96 bộ đề Toán lớp 6, 7, 8, 9</strong> bám sát 3 bộ sách{' '}
            <em>Kết nối tri thức, Chân trời sáng tạo, Cánh diều</em>. Tự động chấm điểm theo thang 10 và hiển thị{' '}
            <strong>lời giải chi tiết</strong> từng câu ngay sau khi nộp bài.
          </p>
          <div className="hero-actions">
            <button type="button" className="btn-primary" onClick={handleRandomExam}>
              <Shuffle size={17} /> Tạo đề ngẫu nhiên Toán {grade}
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                setCategory('cuoi-hk1');
                document.getElementById('exam-list')?.scrollIntoView({ behavior: 'smooth' });
              }}
            >
              <FileText size={17} /> Xem đề Cuối HK1
            </button>
          </div>
        </div>
        <div className="hero-stats">
          <div className="stat-box">
            <span className="stat-val">24</span>
            <span className="stat-lbl">Đề / mỗi khối</span>
          </div>
          <div className="stat-box">
            <span className="stat-val">100%</span>
            <span className="stat-lbl">Trắc nghiệm</span>
          </div>
          <div className="stat-box">
            <span className="stat-val">Chi tiết</span>
            <span className="stat-lbl">Lời giải từng câu</span>
          </div>
        </div>
      </section>

      {/* Chọn môn học (mở rộng đa môn) */}
      <section className="section-block">
        <div className="section-label">Môn học</div>
        <div className="subject-strip">
          {SUBJECTS.map((subj) => (
            <button
              key={subj.id}
              type="button"
              disabled={!subj.available}
              className={`subject-chip ${subjectId === subj.id ? 'active' : ''} ${!subj.available ? 'disabled' : ''}`}
              onClick={() => subj.available && setSubjectId(subj.id)}
              title={subj.description}
            >
              <span className="subject-icon" style={{ background: subj.color }}>
                {subj.icon}
              </span>
              <span className="subject-info">
                <strong>{subj.name}</strong>
                <small>{subj.available ? '96 đề · Lớp 6–9' : 'Sắp bổ sung'}</small>
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* Chọn khối lớp */}
      <section className="section-block" id="exam-list">
        <div className="grade-bar">
          <div className="grade-tabs" role="tablist">
            {GRADES.map((g) => (
              <button
                key={g}
                type="button"
                role="tab"
                aria-selected={grade === g}
                className={`grade-tab ${grade === g ? 'active' : ''}`}
                onClick={() => handleSelectGrade(g)}
              >
                Toán Lớp {g}
              </button>
            ))}
          </div>
          <div className="grade-progress">
            Đã hoàn thành <strong>{completedInGrade}</strong>/{exams.length} đề lớp {grade}
          </div>
        </div>

        {/* Bộ lọc kỳ thi, bộ sách, tìm kiếm */}
        <div className="filter-bar">
          <div className="cat-pills">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                className={`pill-btn ${category === cat.id ? 'active' : ''}`}
                onClick={() => setCategory(cat.id)}
              >
                {cat.label}
              </button>
            ))}
          </div>

          <div className="filter-right">
            <select
              className="select-input"
              value={textbook}
              onChange={(e) => setTextbook(e.target.value as 'all' | TextbookSeries)}
              aria-label="Lọc theo bộ sách giáo khoa"
            >
              <option value="all">Tất cả bộ sách</option>
              <option value="kntt">Kết nối tri thức</option>
              <option value="ctst">Chân trời sáng tạo</option>
              <option value="cd">Cánh diều</option>
            </select>

            <div className="search-wrap">
              <Search size={16} className="search-icon" />
              <input
                type="search"
                className="search-input"
                placeholder="Tìm chuyên đề, tên đề..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Danh sách đề kiểm tra */}
        {filteredExams.length === 0 ? (
          <div className="empty-state">
            Không tìm thấy đề kiểm tra phù hợp với bộ lọc hiện tại. Hãy thử chọn "Tất cả" hoặc xóa từ khóa tìm kiếm.
          </div>
        ) : (
          <div className="exam-grid">
            {filteredExams.map((exam) => {
              const best = bestScoreByExam.get(exam.id);
              const draft = loadDraft(exam.id);
              return (
                <article key={exam.id} className="exam-card">
                  <div className="exam-card-top">
                    <span className={`cat-badge cat-${exam.category}`}>{CATEGORY_LABELS[exam.category]}</span>
                    <span className="book-badge">{TEXTBOOK_LABELS[exam.textbook]}</span>
                  </div>

                  <h3 className="exam-title">{exam.title}</h3>
                  <p className="exam-sub">{exam.subtitle}</p>

                  <div className="exam-meta-row">
                    <span>
                      <Clock size={14} /> {exam.durationMinutes} phút
                    </span>
                    <span>
                      <FileText size={14} /> {exam.questions.length} câu
                    </span>
                    {best !== undefined && (
                      <span className="best-score">
                        <Award size={14} /> Cao nhất: {best.toFixed(2)}đ
                      </span>
                    )}
                  </div>

                  {draft && (
                    <div className="draft-note">
                      Đang làm dở ({Object.keys(draft.answers).length}/{exam.questions.length} câu)
                    </div>
                  )}

                  <div className="exam-card-actions">
                    <button
                      type="button"
                      className="btn-primary btn-sm"
                      onClick={() => navigate(`/de/${exam.id}?mode=exam`)}
                    >
                      <Play size={15} /> {draft ? 'Làm tiếp' : 'Thi thử'}
                    </button>
                    <button
                      type="button"
                      className="btn-secondary btn-sm"
                      onClick={() => navigate(`/de/${exam.id}?mode=practice`)}
                    >
                      <BookMarked size={15} /> Luyện tập
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
