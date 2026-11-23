import { Clock, Search } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  CATEGORY_LABELS,
  TEXTBOOK_LABELS,
  type AssignmentInfo,
  type ClassroomInfo,
  type ExamCategory,
  type GradeLevel,
  type SubjectId,
  type TextbookSeries,
} from '@shared/types';
import { SUBJECTS } from '../content';
import { apiJoinClass, fetchStudentDashboard } from '../lib/api';
import { useAuth } from '../lib/authContext';
import { useExams } from '../lib/examStore';
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
  const { user, config } = useAuth();
  const { allExams, getExamsBySubjectGrade, isCustom, isOverridden } = useExams();

  const [subjectId, setSubjectId] = useState<SubjectId>('toan');
  const [grade, setGrade] = useState<GradeLevel>(() => {
    if (user?.grade) return user.grade;
    const saved = Number(localStorage.getItem('luyende_grade'));
    return saved === 6 || saved === 7 || saved === 8 || saved === 9 ? saved : 6;
  });
  const [category, setCategory] = useState<'all' | ExamCategory>('all');
  const [textbook, setTextbook] = useState<'all' | TextbookSeries>('all');
  const [query, setQuery] = useState('');

  // Student classroom & assignments
  const [myClasses, setMyClasses] = useState<ClassroomInfo[]>([]);
  const [myAssignments, setMyAssignments] = useState<AssignmentInfo[]>([]);
  const [joinCode, setJoinCode] = useState('');
  const [joinMsg, setJoinMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const loadStudentData = useCallback(async () => {
    if (!user || user.role !== 'student') return;
    try {
      const data = await fetchStudentDashboard();
      setMyClasses(data.classes);
      setMyAssignments(data.assignments);
    } catch {
      // ignore
    }
  }, [user]);

  useEffect(() => {
    if (user?.grade) setGrade(user.grade);
    void loadStudentData();
  }, [user, loadStudentData]);

  const handleJoinClass = async (e: FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim()) return;
    setJoinMsg(null);
    try {
      const { classroom } = await apiJoinClass(joinCode.trim());
      setJoinCode('');
      setJoinMsg({ type: 'ok', text: `Đã tham gia lớp ${classroom.name} (${classroom.teacherName ?? 'Giáo viên'}).` });
      void loadStudentData();
    } catch (err) {
      setJoinMsg({ type: 'err', text: (err as Error).message });
    }
  };

  const progress = useMemo(() => loadProgress(), []);

  const bestScoreByExam = useMemo(() => {
    const map = new Map<string, number>();
    for (const att of progress.attempts) {
      const prev = map.get(att.examId);
      if (prev === undefined || att.score > prev) map.set(att.examId, att.score);
    }
    return map;
  }, [progress]);

  const exams = useMemo(() => getExamsBySubjectGrade(subjectId, grade), [getExamsBySubjectGrade, subjectId, grade]);

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

  return (
    <div className="container">
      {/* Khu vực tài khoản / Bài giáo viên giao */}
      {user?.role === 'teacher' && (
        <section className="notice-bar">
          <div>
            <strong>Chế độ giáo viên ({user.fullName})</strong>
            <span className="muted-inline"> — Tạo lớp, lấy mã lớp gửi học sinh, giao đề và xem bảng điểm.</span>
          </div>
          <Link to="/giao-vien" className="btn-primary btn-sm">
            Vào trang Quản lý lớp
          </Link>
        </section>
      )}

      {user?.role === 'student' && (
        <section className="panel student-board">
          <div className="board-head">
            <div>
              <h2>Bài giáo viên giao</h2>
              <div className="muted-text">
                {myClasses.length > 0
                  ? `Đang tham gia: ${myClasses.map((c) => `Lớp ${c.name}`).join(', ')}`
                  : 'Chưa tham gia lớp nào — nhập mã lớp do giáo viên gửi để nhận đề.'}
              </div>
            </div>
            <form onSubmit={handleJoinClass} className="join-inline">
              <input
                type="text"
                placeholder="Nhập mã lớp (vd: T8-AB12)"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
              />
              <button type="submit" className="btn-secondary btn-sm">
                Tham gia lớp
              </button>
            </form>
          </div>

          {joinMsg && (
            <div className={joinMsg.type === 'ok' ? 'info-note' : 'form-error'} style={{ marginTop: 10 }}>
              {joinMsg.text}
            </div>
          )}

          {myAssignments.length > 0 && (
            <div className="assignment-list">
              {myAssignments.map((a) => (
                <div key={a.id} className="assignment-row">
                  <div className="assignment-info">
                    <div className="assignment-meta">
                      <span className="tag">Lớp {a.className}</span>
                      {a.dueAt && (
                        <span className="muted-inline">
                          Hạn nộp: {new Date(a.dueAt).toLocaleString('vi-VN')}
                        </span>
                      )}
                    </div>
                    <strong>{a.examTitle}</strong>
                    {a.note && <div className="cell-sub">{a.note}</div>}
                  </div>
                  <div className="assignment-right">
                    {a.myBestScore !== null && a.myBestScore !== undefined ? (
                      <span className={`score-badge ${a.myBestScore >= 8 ? 'good' : a.myBestScore >= 5 ? 'warn' : 'bad'}`}>
                        Đã nộp: {a.myBestScore.toFixed(2)}đ
                      </span>
                    ) : (
                      <span className="tag-pending">Chưa làm</span>
                    )}
                    <button
                      type="button"
                      className="btn-primary btn-sm"
                      onClick={() => navigate(`/de/${a.examId}?mode=exam&assignment=${a.id}`)}
                    >
                      {a.myBestScore !== null && a.myBestScore !== undefined ? 'Làm lại' : 'Làm bài'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {!user && config.dbEnabled && (
        <section className="notice-bar">
          <div>
            <strong>Học sinh hoặc Giáo viên?</strong>
            <span className="muted-inline"> Đăng nhập để nhận đề giáo viên giao và lưu điểm lên hệ thống.</span>
          </div>
          <Link to="/dang-nhap" className="btn-secondary btn-sm">
            Đăng nhập / Đăng ký
          </Link>
        </section>
      )}

      {/* Tiêu đề kho đề đơn giản, rõ ràng */}
      <div className="catalog-head">
        <div>
          <h1>Kho đề kiểm tra trắc nghiệm THCS</h1>
          <p className="muted-text">
            Học kì 1 · Năm học 2026–2027 · Bám sát Kết nối tri thức, Chân trời sáng tạo, Cánh diều.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {user?.role === 'teacher' && (
            <button type="button" className="btn-primary btn-sm" onClick={() => navigate('/giao-vien/tao-de')}>
              + Tạo đề mới
            </button>
          )}
          <button type="button" className="btn-secondary btn-sm" onClick={handleRandomExam}>
            Tạo đề ngẫu nhiên Toán {grade}
          </button>
        </div>
      </div>

      {/* Chọn môn */}
      <div className="subject-bar">
        {SUBJECTS.map((subj) => {
          const hasExams = subj.available || allExams.some((e) => e.subjectId === subj.id);
          return (
            <button
              key={subj.id}
              type="button"
              disabled={!hasExams}
              className={`subject-tab ${subjectId === subj.id ? 'active' : ''}`}
              onClick={() => hasExams && setSubjectId(subj.id)}
            >
              {subj.name}
              {!hasExams && <small> (chưa có đề)</small>}
            </button>
          );
        })}
      </div>

      {/* Chọn khối lớp + bộ lọc */}
      <section className="section-block">
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
                Lớp {g}
              </button>
            ))}
          </div>

          <div className="filter-right">
            <select
              className="select-input"
              value={textbook}
              onChange={(e) => setTextbook(e.target.value as 'all' | TextbookSeries)}
              aria-label="Lọc theo bộ sách"
            >
              <option value="all">Tất cả bộ sách</option>
              <option value="kntt">Kết nối tri thức</option>
              <option value="ctst">Chân trời sáng tạo</option>
              <option value="cd">Cánh diều</option>
            </select>

            <div className="search-wrap">
              <Search size={15} className="search-icon" />
              <input
                type="search"
                className="search-input"
                placeholder="Tìm chuyên đề..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="cat-pills" style={{ marginBottom: 16 }}>
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

        {filteredExams.length === 0 ? (
          <div className="panel empty-inline">Không có đề phù hợp với bộ lọc hiện tại.</div>
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
                    {(isCustom(exam.id) || isOverridden(exam.id)) && (
                      <span className="tag">{isCustom(exam.id) ? 'GV tạo' : 'Đã sửa'}</span>
                    )}
                  </div>

                  <h3 className="exam-title">{exam.title}</h3>
                  <p className="exam-sub">{exam.subtitle}</p>

                  <div className="exam-meta-row">
                    <span>
                      <Clock size={13} /> {exam.durationMinutes} phút
                    </span>
                    <span>{exam.questions.length} câu</span>
                    {best !== undefined && <span className="best-score">Cao nhất: {best.toFixed(2)}đ</span>}
                  </div>

                  {draft && (
                    <div className="draft-note">
                      Đang làm dở ({Object.keys(draft.answers).length}/{exam.questions.length} câu)
                    </div>
                  )}

                  <div className={user?.role === 'teacher' ? 'exam-card-actions teacher-3' : 'exam-card-actions'}>
                    <button
                      type="button"
                      className="btn-primary btn-sm"
                      onClick={() => navigate(`/de/${exam.id}?mode=exam`)}
                    >
                      {draft ? 'Làm tiếp' : 'Làm bài'}
                    </button>
                    {user?.role === 'teacher' ? (
                      <>
                        <button
                          type="button"
                          className="btn-secondary btn-sm"
                          onClick={() => navigate(`/giao-vien/sua-de/${exam.id}`)}
                        >
                          Sửa đề
                        </button>
                        <button
                          type="button"
                          className="btn-secondary btn-sm"
                          onClick={() => navigate(`/giao-vien?assign=${exam.id}`)}
                        >
                          Giao lớp
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        className="btn-secondary btn-sm"
                        onClick={() => navigate(`/de/${exam.id}?mode=practice`)}
                      >
                        Luyện từng câu
                      </button>
                    )}
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
