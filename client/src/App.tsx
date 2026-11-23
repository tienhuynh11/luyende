import { useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { AuthProvider } from './lib/authContext';
import { ExamProvider } from './lib/examStore';
import { applyTheme, getInitialTheme, type ThemeMode } from './lib/storage';
import { ExamEditorPage } from './pages/ExamEditorPage';
import { ExamPage } from './pages/ExamPage';
import { HistoryPage } from './pages/HistoryPage';
import { HomePage } from './pages/HomePage';
import { LiveClassPage } from './pages/LiveClassPage';
import { LoginPage } from './pages/LoginPage';
import { TeacherPage } from './pages/TeacherPage';
import { TheoryPage } from './pages/TheoryPage';

export function App() {
  const [theme, setTheme] = useState<ThemeMode>(() => getInitialTheme());

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const toggleTheme = () => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));

  return (
    <AuthProvider>
      <ExamProvider>
        <BrowserRouter>
          <Layout theme={theme} onToggleTheme={toggleTheme}>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/dang-nhap" element={<LoginPage />} />
              <Route path="/giao-vien" element={<TeacherPage />} />
              <Route path="/giao-vien/tao-de" element={<ExamEditorPage />} />
              <Route path="/giao-vien/sua-de/:examId" element={<ExamEditorPage />} />
              <Route path="/day-hoc" element={<LiveClassPage />} />
              <Route path="/ly-thuyet" element={<TheoryPage />} />
              <Route path="/de/:examId" element={<ExamPage />} />
              <Route path="/de/random/:grade/:seed" element={<ExamPage />} />
              <Route path="/lich-su" element={<HistoryPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Layout>
        </BrowserRouter>
      </ExamProvider>
    </AuthProvider>
  );
}
