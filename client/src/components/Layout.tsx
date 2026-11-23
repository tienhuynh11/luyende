import { BookOpen, History, Moon, Sun } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import type { ThemeMode } from '../lib/storage';

interface LayoutProps {
  theme: ThemeMode;
  onToggleTheme: () => void;
  children: ReactNode;
}

export function Layout({ theme, onToggleTheme, children }: LayoutProps) {
  const location = useLocation();
  const isHome = location.pathname === '/';
  const isHistory = location.pathname === '/lich-su';

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-inner">
          <Link to="/" className="brand">
            <span className="brand-mark">∑</span>
            <span className="brand-text">
              <strong>LuyệnĐề THCS</strong>
              <small>GDPT 2018 · Lớp 6–9</small>
            </span>
          </Link>

          <nav className="topnav">
            <Link to="/" className={`nav-link ${isHome ? 'active' : ''}`}>
              <BookOpen size={17} />
              <span>Kho đề</span>
            </Link>
            <Link to="/lich-su" className={`nav-link ${isHistory ? 'active' : ''}`}>
              <History size={17} />
              <span>Lịch sử</span>
            </Link>
            <button
              type="button"
              className="icon-btn"
              onClick={onToggleTheme}
              title={theme === 'dark' ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'}
              aria-label="Đổi giao diện sáng/tối"
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </nav>
        </div>
      </header>

      <main className="main-content">{children}</main>

      <footer className="footer">
        <div className="footer-inner">
          <span>LuyệnĐề THCS — Chương trình GDPT 2018 (Kết nối tri thức · Chân trời sáng tạo · Cánh diều)</span>
          <span>Tương thích PC & Điện thoại · Tự động chấm điểm kèm lời giải chi tiết</span>
        </div>
      </footer>
    </div>
  );
}
