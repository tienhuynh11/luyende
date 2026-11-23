import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import type { GradeLevel, UserRole } from '@shared/types';
import { apiLogin, apiRegister } from '../lib/api';
import { useAuth } from '../lib/authContext';

export function LoginPage() {
  const navigate = useNavigate();
  const { config, setUser, refresh } = useAuth();

  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [role, setRole] = useState<UserRole>('student');
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [grade, setGrade] = useState<GradeLevel>(6);
  const [classCode, setClassCode] = useState('');
  const [teacherInviteCode, setTeacherInviteCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (tab === 'login') {
        const { user } = await apiLogin(username, password);
        setUser(user);
        navigate(user.role === 'teacher' ? '/giao-vien' : '/');
      } else {
        const { user } = await apiRegister({
          username,
          fullName,
          password,
          role,
          grade: role === 'student' ? grade : undefined,
          classCode: role === 'student' ? classCode : undefined,
          teacherInviteCode: role === 'teacher' ? teacherInviteCode : undefined,
        });
        setUser(user);
        void refresh();
        navigate(user.role === 'teacher' ? '/giao-vien' : '/');
      }
    } catch (err) {
      setError((err as Error).message || 'Có lỗi xảy ra, vui lòng thử lại.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!config.dbEnabled) {
    return (
      <div className="container narrow-container">
        <div className="panel">
          <h1>Chưa kết nối cơ sở dữ liệu</h1>
          <p className="muted-text">
            Hệ thống cần biến môi trường <code>DATABASE_URL</code> trên Render để bật tính năng tài khoản giáo viên và
            học sinh. Bạn vẫn có thể làm đề trực tiếp ở trang Kho đề.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container narrow-container">
      <div className="panel auth-panel">
        <div className="auth-tabs">
          <button
            type="button"
            className={`auth-tab ${tab === 'login' ? 'active' : ''}`}
            onClick={() => {
              setTab('login');
              setError(null);
            }}
          >
            Đăng nhập
          </button>
          <button
            type="button"
            className={`auth-tab ${tab === 'register' ? 'active' : ''}`}
            onClick={() => {
              setTab('register');
              setError(null);
            }}
          >
            Đăng ký tài khoản
          </button>
        </div>

        <form onSubmit={handleSubmit} className="form-stack">
          {tab === 'register' && (
            <>
              <div className="field">
                <label>Vai trò</label>
                <div className="role-toggle">
                  <button
                    type="button"
                    className={`role-btn ${role === 'student' ? 'active' : ''}`}
                    onClick={() => setRole('student')}
                  >
                    Học sinh
                  </button>
                  <button
                    type="button"
                    className={`role-btn ${role === 'teacher' ? 'active' : ''}`}
                    onClick={() => setRole('teacher')}
                  >
                    Giáo viên
                  </button>
                </div>
              </div>

              <div className="field">
                <label htmlFor="fullName">Họ và tên</label>
                <input
                  id="fullName"
                  type="text"
                  required
                  placeholder={role === 'teacher' ? 'Ví dụ: Thầy Nguyễn Văn A' : 'Ví dụ: Trần Minh Quân'}
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>
            </>
          )}

          <div className="field">
            <label htmlFor="username">Tên đăng nhập</label>
            <input
              id="username"
              type="text"
              required
              autoComplete="username"
              placeholder="Chữ thường không dấu, ví dụ: minhquan8a"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>

          <div className="field">
            <label htmlFor="password">Mật khẩu</label>
            <input
              id="password"
              type="password"
              required
              minLength={6}
              autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
              placeholder="Tối thiểu 6 ký tự"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {tab === 'register' && role === 'student' && (
            <div className="field-row">
              <div className="field">
                <label htmlFor="grade">Khối lớp</label>
                <select
                  id="grade"
                  value={grade}
                  onChange={(e) => setGrade(Number(e.target.value) as GradeLevel)}
                >
                  <option value={6}>Lớp 6</option>
                  <option value={7}>Lớp 7</option>
                  <option value={8}>Lớp 8</option>
                  <option value={9}>Lớp 9</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="classCode">Mã lớp (nếu có)</label>
                <input
                  id="classCode"
                  type="text"
                  placeholder="Ví dụ: T8-AB12"
                  value={classCode}
                  onChange={(e) => setClassCode(e.target.value)}
                />
              </div>
            </div>
          )}

          {tab === 'register' && role === 'teacher' && (
            <div className="field">
              {config.needsFirstTeacher && !config.teacherInviteRequired ? (
                <div className="info-note">
                  Chưa có tài khoản giáo viên nào trong hệ thống. Tài khoản đầu tiên này sẽ được tạo làm tài khoản giáo
                  viên quản trị.
                </div>
              ) : (
                <>
                  <label htmlFor="inviteCode">Mã mời giáo viên</label>
                  <input
                    id="inviteCode"
                    type="password"
                    required
                    placeholder="Nhập TEACHER_INVITE_CODE đã cấu hình"
                    value={teacherInviteCode}
                    onChange={(e) => setTeacherInviteCode(e.target.value)}
                  />
                </>
              )}
            </div>
          )}

          {error && <div className="form-error">{error}</div>}

          <button type="submit" className="btn-primary full-width" disabled={submitting}>
            {submitting ? 'Đang xử lý...' : tab === 'login' ? 'Đăng nhập' : 'Tạo tài khoản'}
          </button>
        </form>
      </div>
    </div>
  );
}
