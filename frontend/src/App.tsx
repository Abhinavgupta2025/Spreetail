import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { useStore } from './store';
import Navbar from './components/shared/Navbar';
import Sidebar from './components/shared/Sidebar';
import AuthPage from './pages/AuthPage';
import DashboardPage from './pages/DashboardPage';
import GroupPage from './pages/GroupPage';
import ExpenseDetailPage from './pages/ExpenseDetailPage';
import BalancePage from './pages/BalancePage';
import ImportPage from './pages/ImportPage';
import Spinner from './components/shared/Spinner';

// Main layout wrapper that adapts based on authentication status
const MainLayout: React.FC = () => {
  const { isAuthenticated, checkAuth, loadingAuth } = useStore();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  if (loadingAuth) {
    return <Spinner fullPage />;
  }

  // If authenticated, render full application with sidebar and header
  if (isAuthenticated) {
    return (
      <div className="app-container">
        <Sidebar />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <Navbar />
          <main className="main-content">
            <Outlet />
          </main>
        </div>
      </div>
    );
  }

  // If not authenticated, render as full-width page (e.g. for landing homepage)
  return (
    <div className="landing-container" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Outlet />
      </main>
    </div>
  );
};

// Route barrier requiring authentication
const RequireAuth: React.FC = () => {
  const { isAuthenticated } = useStore();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return <Outlet />;
};

export const App: React.FC = () => {
  return (
    <Router>
      <Routes>
        {/* Public auth pages */}
        <Route path="/login" element={<AuthPage />} />
        <Route path="/register" element={<AuthPage />} />

        {/* Dynamic layout wrapper */}
        <Route element={<MainLayout />}>
          {/* Public homepage / landing page */}
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />

          {/* Protected routes */}
          <Route element={<RequireAuth />}>
            <Route path="/groups/:id" element={<GroupPage />} />
            <Route path="/groups/:groupId/import" element={<ImportPage />} />
            <Route path="/expenses/:id" element={<ExpenseDetailPage />} />
            <Route path="/balances" element={<BalancePage />} />
          </Route>
        </Route>

        {/* Fallback route */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Router>
  );
};

export default App;

