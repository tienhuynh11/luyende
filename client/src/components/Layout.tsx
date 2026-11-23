import { LogOut, Moon, Sun } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/authContext';
import type { ThemeMode } from '../lib/storage';

interface LayoutProps {
  theme: ThemeMode;
  onToggleTheme: () => void;
  children: ReactNode;
}

export function Layout({ theme, onToggleTheme, children }: LayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, config, logout } = useAuth();

  const isHome = location.pathname === '/';
  const isHistory = location.pathname === '/lich-su';
  const isTeacher = location.pathname === '/giao-vien';

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-inner">
          <Link to="/" className="brand">
            <span className="brand-mark">T</span>
            <span className="brand-text">
              <strong>LuyệnĐề THCS</strong>
              <small>Chương trình GDPT 2018</small>
            </span>
          </Link>

          <nav className="topnav">
            <Link to="/" className={`nav-link ${isHome ? 'active' : ''}`}>
              Kho đề
            </Link>
            {user?.role === 'teacher' && (
              <Link to="/giao-vien" className={`nav-link ${isTeacher ? 'active' : ''}`}>
                Giao bài & Điểm
              </Link>
            )}
            <Link to="/lich-su" className={`nav-link ${isHistory ? 'active' : ''}`}>
              Lịch sử
            </Link>

            {config.dbEnabled && (
              user ? (
                <div className="user-pill">
                  <span className="user-name" title={`${user.fullName} (${user.role === 'teacher' ? 'Giáo viên' : 'Học sinh'})`}>
                    {user.fullName}
                    <small className="hide-xs">{user.role === 'teacher' ? ' · GV' : ' · HS'}</small>
                  </span>
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={handleLogout}
                    title="Đăng xuất"
                    aria-label="Đăng xuất"
                  >
                    <LogOut size={16} />
                  </button>
                </div>
              ) : (
                <Link to="/dang-nhap" className="btn-primary btn-sm">
                  Đăng nhập
                </Link>
              )
            )}

            <button
              type="button"
              className="icon-btn"
              onClick={onToggleTheme}
              title={theme === 'dark' ? 'Giao diện sáng' : 'Giao diện tối'}
              aria-label="Đổi giao diện sáng/tối"
            >
              {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
            </button>
          </nav>
        </div>
      </header>

      <main className="main-content">{children}</main>

      <footer className="footer">
        <div className="footer-inner">
          <span>LuyệnĐề THCS · Toán 6, 7, 8, 9 (Kết nối tri thức · Chân trời sáng tạo · Cánh diều)</span>
          <span>Trắc nghiệm tự động chấm điểm kèm lời giải chi tiết</span>
        </div>
      </footer>
    </div>
  );
}
