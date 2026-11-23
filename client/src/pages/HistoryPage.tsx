import { Award, Cloud, Play, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CATEGORY_LABELS, type GradeLevel } from '@shared/types';
import {
  checkServerSyncEnabled,
  clearProgress,
  getSyncCode,
  loadProgress,
  registerCloudSync,
  restoreFromCloudCode,
} from '../lib/storage';

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}p ${s}s` : `${s}s`;
}

export function HistoryPage() {
  const navigate = useNavigate();
  const [progress, setProgress] = useState(() => loadProgress());
  const [gradeFilter, setGradeFilter] = useState<'all' | GradeLevel>('all');
  const [syncEnabled, setSyncEnabled] = useState(false);
  const [syncCode, setSyncCodeState] = useState<string | null>(() => getSyncCode());
  const [restoreInput, setRestoreInput] = useState('');
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  useEffect(() => {
    void checkServerSyncEnabled().then(setSyncEnabled);
  }, []);

  const filtered = useMemo(() => {
    if (gradeFilter === 'all') return progress.attempts;
    return progress.attempts.filter((a) => a.grade === gradeFilter);
  }, [progress, gradeFilter]);

  const stats = useMemo(() => {
    const arr = progress.attempts;
    if (arr.length === 0) return { count: 0, avg: 0, best: 0 };
    const sum = arr.reduce((acc, a) => acc + a.score, 0);
    const best = Math.max(...arr.map((a) => a.score));
    return { count: arr.length, avg: sum / arr.length, best };
  }, [progress]);

  const handleCreateCode = async () => {
    setSyncMsg('Đang tạo mã đồng bộ...');
    const res = await registerCloudSync();
    if (res.code) {
      setSyncCodeState(res.code);
      setSyncMsg(`Đã bật đồng bộ! Lưu mã ${res.code} để dùng trên máy khác.`);
    } else {
      setSyncMsg(res.error ?? 'Lỗi đồng bộ.');
    }
  };

  const handleRestore = async () => {
    if (!restoreInput.trim()) return;
    setSyncMsg('Đang đồng bộ dữ liệu...');
    const res = await restoreFromCloudCode(restoreInput);
    if (res.progress) {
      setProgress(res.progress);
      setSyncCodeState(restoreInput.trim().toUpperCase());
      setRestoreInput('');
      setSyncMsg('Đồng bộ thành công!');
    } else {
      setSyncMsg(res.error ?? 'Không tìm thấy mã.');
    }
  };

  return (
    <div className="container">
      <div className="page-head">
        <div>
          <h1>Lịch sử làm bài & Thống kê</h1>
          <p className="muted-text">Theo dõi tiến bộ qua từng đề kiểm tra Toán THCS.</p>
        </div>
        {progress.attempts.length > 0 && (
          <button
            type="button"
            className="btn-secondary btn-sm"
            onClick={() => {
              if (window.confirm('Xóa toàn bộ lịch sử làm bài trên máy này?')) {
                clearProgress();
                setProgress(loadProgress());
              }
            }}
          >
            <Trash2 size={15} /> Xóa lịch sử
          </button>
        )}
      </div>

      <div className="stats-row">
        <div className="stat-card">
          <small>Tổng số lượt làm bài</small>
          <strong>{stats.count}</strong>
        </div>
        <div className="stat-card">
          <small>Điểm trung bình</small>
          <strong>{stats.count ? stats.avg.toFixed(2) : '—'}</strong>
        </div>
        <div className="stat-card">
          <small>Điểm cao nhất</small>
          <strong>{stats.count ? `${stats.best.toFixed(2)}đ` : '—'}</strong>
        </div>
      </div>

      {syncEnabled && (
        <section className="sync-card">
          <div className="sync-head">
            <Cloud size={18} />
            <strong>Đồng bộ giữa PC và Điện thoại</strong>
          </div>
          {syncCode ? (
            <p>
              Mã khôi phục của bạn: <code className="sync-code">{syncCode}</code> — nhập mã này trên thiết bị khác để
              đồng bộ lịch sử làm bài.
            </p>
          ) : (
            <div className="sync-controls">
              <button type="button" className="btn-primary btn-sm" onClick={handleCreateCode}>
                Tạo mã đồng bộ mới
              </button>
              <div className="sync-restore">
                <input
                  type="text"
                  className="sa-input"
                  placeholder="Nhập mã LD-XXXX-XXXX"
                  value={restoreInput}
                  onChange={(e) => setRestoreInput(e.target.value)}
                />
                <button type="button" className="btn-secondary btn-sm" onClick={handleRestore}>
                  Khôi phục
                </button>
              </div>
            </div>
          )}
          {syncMsg && <div className="sync-msg">{syncMsg}</div>}
        </section>
      )}

      <div className="filter-bar" style={{ marginTop: 20 }}>
        <div className="cat-pills">
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
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <p>Bạn chưa hoàn thành đề kiểm tra nào. Hãy chọn một đề để bắt đầu luyện tập!</p>
          <button type="button" className="btn-primary" onClick={() => navigate('/')}>
            Vào kho đề ngay
          </button>
        </div>
      ) : (
        <div className="history-list">
          {filtered.map((att) => (
            <div key={att.id} className="history-item">
              <div className="history-main">
                <div className="exam-badges">
                  <span className="book-badge">Toán Lớp {att.grade}</span>
                  <span className={`cat-badge cat-${att.category}`}>{CATEGORY_LABELS[att.category]}</span>
                </div>
                <h3>{att.examTitle}</h3>
                <div className="history-meta">
                  <span>{new Date(att.submittedAt).toLocaleString('vi-VN')}</span>
                  <span>· Thời gian: {formatDuration(att.durationSeconds)}</span>
                  <span>
                    · Đúng {att.correctCount}/{att.totalQuestions} câu
                  </span>
                </div>
              </div>

              <div className="history-right">
                <div className={`score-chip ${att.score >= 8 ? 'good' : att.score >= 5 ? 'warn' : 'bad'}`}>
                  <Award size={15} /> {att.score.toFixed(2)}đ
                </div>
                {!att.examId.includes('-random-') && (
                  <button
                    type="button"
                    className="btn-secondary btn-sm"
                    onClick={() => navigate(`/de/${att.examId}?mode=exam`)}
                  >
                    <Play size={14} /> Làm lại
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
