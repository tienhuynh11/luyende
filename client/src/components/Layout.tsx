import { Bell, LogOut, Moon, Sun } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { apiMarkAllReviewed } from '../lib/api';
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
  const { user, config, notifications, refreshNotifications, logout } = useAuth();
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  const isHome = location.pathname === '/';
  const isHistory = location.pathname === '/lich-su';
  const isTeacher = location.pathname === '/giao-vien';

  useEffect(() => {
    setNotifOpen(false);
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (!notifOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [notifOpen]);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const handleMarkAllRead = async () => {
    try {
      await apiMarkAllReviewed();
      await refreshNotifications();
    } catch {
      // ignore
    }
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
                {notifications.length > 0 && <span className="nav-count">{notifications.length}</span>}
              </Link>
            )}
            <Link to="/lich-su" className={`nav-link ${isHistory ? 'active' : ''}`}>
              Lịch sử
            </Link>

            {config.dbEnabled && user && (
              <div className="notif-wrap" ref={notifRef}>
                <button
                  type="button"
                  className="icon-btn notif-btn"
                  onClick={() => setNotifOpen((v) => !v)}
                  title="Thông báo cần xử lý"
                  aria-label="Thông báo cần xử lý"
                >
                  <Bell size={17} />
                  {notifications.length > 0 && <span className="notif-badge">{notifications.length}</span>}
                </button>

                {notifOpen && (
                  <div className="notif-dropdown">
                    <div className="notif-drop-head">
                      <strong>Cần xử lý ({notifications.length})</strong>
                      {user.role === 'teacher' && notifications.some((n) => n.kind === 'new-submission') && (
                        <button type="button" className="link-btn" style={{ fontSize: 12.5 }} onClick={handleMarkAllRead}>
                          Đánh dấu đã xem
                        </button>
                      )}
                    </div>

                    {notifications.length === 0 ? (
                      <div className="notif-empty">Không có việc nào cần xử lý lúc này.</div>
                    ) : (
                      <div className="notif-list">
                        {notifications.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            className={`notif-item ${item.urgent ? 'urgent' : ''}`}
                            onClick={() => {
                              setNotifOpen(false);
                              navigate(item.link);
                            }}
                          >
                            <div className="notif-title">{item.title}</div>
                            <div className="notif-detail">{item.detail}</div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

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
