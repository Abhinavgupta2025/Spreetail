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

// Protected layout wrapper
const ProtectedLayout: React.FC = () => {
  const { isAuthenticated, checkAuth, loadingAuth } = useStore();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  if (loadingAuth) {
    return <Spinner fullPage />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

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
};

export const App: React.FC = () => {
  return (
    <Router>
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={<AuthPage />} />
        <Route path="/register" element={<AuthPage />} />

        {/* Protected Routes */}
        <Route element={<ProtectedLayout />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/groups/:id" element={<GroupPage />} />
          <Route path="/groups/:groupId/import" element={<ImportPage />} />
          <Route path="/expenses/:id" element={<ExpenseDetailPage />} />
          <Route path="/balances" element={<BalancePage />} />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
        </Route>

        {/* Fallback route */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Router>
  );
};

export default App;
