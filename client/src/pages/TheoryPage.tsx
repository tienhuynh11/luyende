import { BookOpen, Edit3, ImagePlus, Plus, Save, Trash2, X } from 'lucide-react';
import { useCallback, useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import type { GradeLevel, StudentSummary, SubjectId, TheoryNote } from '@shared/types';
import { MathText } from '../components/MathText';
import { SUBJECTS } from '../content';
import { apiDeleteTheoryNote, apiSaveTheoryNote, fetchTeacherDashboard, fetchTheoryNotes } from '../lib/api';
import { useAuth } from '../lib/authContext';

async function compressTheoryImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Không đọc được ảnh.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('File ảnh không hợp lệ.'));
      img.onload = () => {
        const maxDim = 1280;
        let w = img.width;
        let h = img.height;
        if (w > maxDim || h > maxDim) {
          const r = Math.min(maxDim / w, maxDim / h);
          w = Math.round(w * r);
          h = Math.round(h * r);
        }
        const off = document.createElement('canvas');
        off.width = w;
        off.height = h;
        const ctx = off.getContext('2d');
        if (!ctx) return reject(new Error('Lỗi xử lý ảnh.'));
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        resolve(off.toDataURL('image/jpeg', 0.82));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export function TheoryPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const isTeacher = user?.role === 'teacher';

  const [notes, setNotes] = useState<TheoryNote[]>([]);
  const [students, setStudents] = useState<StudentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [gradeFilter, setGradeFilter] = useState<'all' | GradeLevel>('all');
  const [selectedNote, setSelectedNote] = useState<TheoryNote | null>(null);

  // Editor modal state (teacher)
  const [editing, setEditing] = useState<boolean>(false);
  const [editId, setEditId] = useState<string | undefined>(undefined);
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [content, setContent] = useState('');
  const [subjectId, setSubjectId] = useState<SubjectId>('toan');
  const [grade, setGrade] = useState<GradeLevel>(6);
  const [studentId, setStudentId] = useState<string>('all');
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const { notes: list } = await fetchTheoryNotes();
      setNotes(list);
      if (isTeacher) {
        const dash = await fetchTeacherDashboard().catch(() => null);
        if (dash) setStudents(dash.students);
      }
    } catch {
      setNotes([]);
    } finally {
      setLoading(false);
    }
  }, [isTeacher]);

  useEffect(() => {
    if (!authLoading && user) {
      void loadAll();
    }
  }, [authLoading, user, loadAll]);

  const openCreate = () => {
    setEditId(undefined);
    setTitle('');
    setSummary('');
    setContent('');
    setSubjectId('toan');
    setGrade(6);
    setStudentId('all');
    setImageDataUrl(null);
    setPreview(false);
    setEditing(true);
  };

  const openEdit = (n: TheoryNote) => {
    setEditId(n.id);
    setTitle(n.title);
    setSummary(n.summary);
    setContent(n.content);
    setSubjectId(n.subjectId);
    setGrade(n.grade);
    setStudentId(n.studentId ?? 'all');
    setImageDataUrl(n.imageDataUrl);
    setPreview(false);
    setEditing(true);
  };

  const handleUploadImg = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    try {
      const url = await compressTheoryImage(f);
      setImageDataUrl(url);
    } catch (err) {
      alert((err as Error).message);
    }
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    try {
      await apiSaveTheoryNote({
        id: editId,
        studentId: studentId === 'all' ? null : studentId,
        subjectId,
        grade,
        title: title.trim(),
        summary: summary.trim(),
        content,
        imageDataUrl,
      });
      setEditing(false);
      await loadAll();
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (n: TheoryNote) => {
    if (!window.confirm(`Xóa bài lý thuyết "${n.title}"?`)) return;
    try {
      await apiDeleteTheoryNote(n.id);
      if (selectedNote?.id === n.id) setSelectedNote(null);
      setNotes((prev) => prev.filter((x) => x.id !== n.id));
    } catch (err) {
      alert((err as Error).message);
    }
  };

  if (authLoading) return <div className="container"><div className="panel">Đang tải...</div></div>;

  if (!user) {
    return (
      <div className="container narrow-container">
        <div className="panel">
          <h1>Bộ Lý thuyết & Công thức</h1>
          <p className="muted-text">Vui lòng đăng nhập để xem tài liệu lý thuyết do gia sư biên soạn.</p>
          <button type="button" className="btn-primary" onClick={() => navigate('/dang-nhap')}>
            Đăng nhập
          </button>
        </div>
      </div>
    );
  }

  const filtered = gradeFilter === 'all' ? notes : notes.filter((n) => n.grade === gradeFilter);

  return (
    <div className="container">
      <div className="page-head">
        <div>
          <h1>Bộ Lý thuyết & Công thức</h1>
          <p className="muted-text">
            {isTeacher
              ? 'Soạn tóm tắt lý thuyết, công thức Toán và ví dụ mẫu gửi cho học sinh ôn tập.'
              : 'Tổng hợp kiến thức trọng tâm và công thức do gia sư biên soạn.'}
          </p>
        </div>
        {isTeacher && (
          <button type="button" className="btn-primary btn-sm" onClick={openCreate}>
            <Plus size={15} /> Tạo bài lý thuyết
          </button>
        )}
      </div>

      <div className="cat-pills" style={{ marginBottom: 16 }}>
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
        <div className="panel">Đang tải tài liệu...</div>
      ) : filtered.length === 0 ? (
        <div className="panel empty-inline">
          <BookOpen size={24} style={{ marginBottom: 6 }} />
          <div>
            {isTeacher
              ? 'Chưa có bài lý thuyết nào. Bấm "Tạo bài lý thuyết" để thêm bài đầu tiên.'
              : 'Hiện gia sư chưa đăng bài lý thuyết nào cho khối này.'}
          </div>
        </div>
      ) : (
        <div className="exam-grid">
          {filtered.map((n) => (
            <article key={n.id} className="exam-card">
              <div className="exam-card-top">
                <span className="tag">Lớp {n.grade}</span>
                <span className="book-badge">
                  {SUBJECTS.find((s) => s.id === n.subjectId)?.shortName ?? 'Toán'}
                </span>
                {isTeacher && <span className="book-badge">{n.studentName}</span>}
              </div>
              <h3 className="exam-title">{n.title}</h3>
              {n.summary && <p className="exam-sub">{n.summary}</p>}
              <div className="cell-sub">Cập nhật: {new Date(n.updatedAt).toLocaleDateString('vi-VN')}</div>

              <div className={isTeacher ? 'exam-card-actions teacher-3' : 'exam-card-actions'}>
                <button type="button" className="btn-primary btn-sm" onClick={() => setSelectedNote(n)}>
                  Đọc bài
                </button>
                {isTeacher && (
                  <>
                    <button type="button" className="btn-secondary btn-sm" onClick={() => openEdit(n)}>
                      <Edit3 size={14} /> Sửa
                    </button>
                    <button type="button" className="btn-secondary btn-sm" onClick={() => handleDelete(n)}>
                      <Trash2 size={14} /> Xóa
                    </button>
                  </>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      {/* MODAL ĐỌC LÝ THUYẾT */}
      {selectedNote && (
        <div className="modal-backdrop" onClick={() => setSelectedNote(null)}>
          <div className="inspect-modal" onClick={(e) => e.stopPropagation()}>
            <div className="inspect-head">
              <div>
                <div className="exam-badges" style={{ marginBottom: 4 }}>
                  <span className="tag">Lớp {selectedNote.grade}</span>
                  <span className="book-badge">
                    {SUBJECTS.find((s) => s.id === selectedNote.subjectId)?.name ?? 'Toán học'}
                  </span>
                </div>
                <h3>{selectedNote.title}</h3>
              </div>
              <button type="button" className="icon-btn" onClick={() => setSelectedNote(null)}>
                <X size={18} />
              </button>
            </div>
            <div className="inspect-body">
              {selectedNote.summary && <div className="info-note">{selectedNote.summary}</div>}
              {selectedNote.imageDataUrl && (
                <div className="panel" style={{ textAlign: 'center' }}>
                  <img
                    src={selectedNote.imageDataUrl}
                    alt={selectedNote.title}
                    style={{ maxWidth: '100%', maxHeight: 460, borderRadius: 6 }}
                  />
                </div>
              )}
              <div className="panel theory-content">
                <MathText text={selectedNote.content} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL TẠO / SỬA LÝ THUYẾT */}
      {editing && (
        <div className="modal-backdrop" onClick={() => setEditing(false)}>
          <div className="inspect-modal" onClick={(e) => e.stopPropagation()}>
            <div className="inspect-head">
              <h3>{editId ? 'Chỉnh sửa bài lý thuyết' : 'Tạo bài lý thuyết mới'}</h3>
              <button type="button" className="icon-btn" onClick={() => setEditing(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSave} className="inspect-body">
              <div className="field">
                <label>Tiêu đề bài lý thuyết</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: 7 Hằng đẳng thức đáng nhớ & Ví dụ áp dụng"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>

              <div className="editor-meta-grid">
                <div className="field">
                  <label>Môn học</label>
                  <select value={subjectId} onChange={(e) => setSubjectId(e.target.value as SubjectId)}>
                    {SUBJECTS.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>Khối lớp</label>
                  <select value={grade} onChange={(e) => setGrade(Number(e.target.value) as GradeLevel)}>
                    <option value={6}>Lớp 6</option>
                    <option value={7}>Lớp 7</option>
                    <option value={8}>Lớp 8</option>
                    <option value={9}>Lớp 9</option>
                  </select>
                </div>
                <div className="field">
                  <label>Chia sẻ cho</label>
                  <select value={studentId} onChange={(e) => setStudentId(e.target.value)}>
                    <option value="all">Tất cả học sinh</option>
                    {students.map((st) => (
                      <option key={st.id} value={st.id}>{st.fullName}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="field">
                <label>Tóm tắt ngắn (tùy chọn)</label>
                <input
                  type="text"
                  placeholder="Tóm tắt 1 dòng về nội dung cần nhớ..."
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                />
              </div>

              <div className="field">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label>Nội dung lý thuyết (hỗ trợ **in đậm** và công thức Toán $...$ / $$...$$)</label>
                  <button type="button" className="link-btn" style={{ fontSize: 13 }} onClick={() => setPreview((v) => !v)}>
                    {preview ? 'Ẩn xem trước' : 'Xem trước công thức'}
                  </button>
                </div>
                <textarea
                  className="editor-textarea"
                  rows={8}
                  placeholder={'Ví dụ:\n**1. Bình phương của một tổng:**\n$$(A + B)^2 = A^2 + 2AB + B^2$$\n**Ví dụ:** $(x + 3)^2 = x^2 + 6x + 9$.'}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                />
                {preview && (
                  <div className="preview-box">
                    <MathText text={content} />
                  </div>
                )}
              </div>

              <div className="field">
                <label>Ảnh minh họa / Ảnh bảng công thức (tùy chọn)</label>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <label className="btn-secondary btn-sm" style={{ cursor: 'pointer' }}>
                    <ImagePlus size={15} /> Chọn ảnh
                    <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleUploadImg} />
                  </label>
                  {imageDataUrl && (
                    <button type="button" className="btn-secondary btn-sm" onClick={() => setImageDataUrl(null)}>
                      Bỏ ảnh
                    </button>
                  )}
                </div>
                {imageDataUrl && (
                  <img
                    src={imageDataUrl}
                    alt="Xem trước"
                    style={{ maxWidth: '100%', maxHeight: 220, marginTop: 8, borderRadius: 6, objectFit: 'contain' }}
                  />
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button type="button" className="btn-secondary" onClick={() => setEditing(false)}>
                  Hủy
                </button>
                <button type="submit" className="btn-primary" disabled={saving}>
                  <Save size={15} /> {saving ? 'Đang lưu...' : 'Lưu bài lý thuyết'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
