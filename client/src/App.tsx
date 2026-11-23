import { useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { applyTheme, getInitialTheme, type ThemeMode } from './lib/storage';
import { ExamPage } from './pages/ExamPage';
import { HistoryPage } from './pages/HistoryPage';
import { HomePage } from './pages/HomePage';

export function App() {
  const [theme, setTheme] = useState<ThemeMode>(() => getInitialTheme());

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const toggleTheme = () => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));

  return (
    <BrowserRouter>
      <Layout theme={theme} onToggleTheme={toggleTheme}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/de/:examId" element={<ExamPage />} />
          <Route path="/de/random/:grade/:seed" element={<ExamPage />} />
          <Route path="/lich-su" element={<HistoryPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
