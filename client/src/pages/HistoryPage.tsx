import { Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CATEGORY_LABELS, type GradeLevel, type SubmissionRecord } from '@shared/types';
import { fetchStudentDashboard } from '../lib/api';
import { useAuth } from '../lib/authContext';
import { clearProgress, loadProgress } from '../lib/storage';

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}p ${s}s` : `${s}s`;
}

export function HistoryPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [localProgress, setLocalProgress] = useState(() => loadProgress());
  const [serverSubs, setServerSubs] = useState<SubmissionRecord[] | null>(null);
  const [gradeFilter, setGradeFilter] = useState<'all' | GradeLevel>('all');

  useEffect(() => {
    if (!user) {
      setServerSubs(null);
      return;
    }
    fetchStudentDashboard()
      .then((d) => setServerSubs(d.submissions))
      .catch(() => setServerSubs(null));
  }, [user]);

  const rows = useMemo(() => {
    const list = serverSubs
      ? serverSubs.map((s) => ({
          id: s.id,
          examId: s.examId,
          examTitle: s.examTitle,
          grade: s.grade,
          category: s.category,
          score: s.score,
          correctCount: s.correctCount,
          totalQuestions: s.totalQuestions,
          durationSeconds: s.durationSeconds,
          submittedAt: new Date(s.submittedAt).getTime(),
        }))
      : localProgress.attempts;

    return gradeFilter === 'all' ? list : list.filter((a) => a.grade === gradeFilter);
  }, [serverSubs, localProgress, gradeFilter]);

  const stats = useMemo(() => {
    if (rows.length === 0) return { count: 0, avg: 0, best: 0 };
    const sum = rows.reduce((acc, a) => acc + a.score, 0);
    const best = Math.max(...rows.map((a) => a.score));
    return { count: rows.length, avg: sum / rows.length, best };
  }, [rows]);

  return (
    <div className="container">
      <div className="page-head">
        <div>
          <h1>Lịch sử làm bài</h1>
          <p className="muted-text">
            {user
              ? `Đang hiển thị lịch sử của tài khoản ${user.fullName} (đồng bộ từ cơ sở dữ liệu).`
              : 'Lịch sử lưu trên trình duyệt này. Đăng nhập để lưu đồng bộ nhiều thiết bị.'}
          </p>
        </div>
        {!user && localProgress.attempts.length > 0 && (
          <button
            type="button"
            className="btn-secondary btn-sm"
            onClick={() => {
              if (window.confirm('Xóa lịch sử làm bài trên trình duyệt này?')) {
                clearProgress();
                setLocalProgress(loadProgress());
              }
            }}
          >
            <Trash2 size={15} /> Xóa lịch sử
          </button>
        )}
      </div>

      <div className="stats-row">
        <div className="stat-card">
          <small>Số bài đã nộp</small>
          <strong>{stats.count}</strong>
        </div>
        <div className="stat-card">
          <small>Điểm trung bình</small>
          <strong>{stats.count ? stats.avg.toFixed(2) : '—'}</strong>
        </div>
        <div className="stat-card">
          <small>Điểm cao nhất</small>
          <strong>{stats.count ? `${stats.best.toFixed(2)}` : '—'}</strong>
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

      {rows.length === 0 ? (
        <div className="panel empty-inline">
          <p>Chưa có bài làm nào.</p>
          <button type="button" className="btn-primary btn-sm" onClick={() => navigate('/')}>
            Về kho đề
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
                    <strong>{att.examTitle}</strong>
                    <div className="cell-sub">{CATEGORY_LABELS[att.category]}</div>
                  </td>
                  <td>Lớp {att.grade}</td>
                  <td>
                    <span className={`score-badge ${att.score >= 8 ? 'good' : att.score >= 5 ? 'warn' : 'bad'}`}>
                      {att.score.toFixed(2)}
                    </span>
                  </td>
                  <td>{att.correctCount}/{att.totalQuestions}</td>
                  <td>{formatDuration(att.durationSeconds)}</td>
                  <td className="cell-nowrap">{new Date(att.submittedAt).toLocaleString('vi-VN')}</td>
                  <td>
                    {!att.examId.includes('-random-') && (
                      <button
                        type="button"
                        className="btn-secondary btn-sm"
                        onClick={() => navigate(`/de/${att.examId}?mode=exam`)}
                      >
                        Làm lại
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
