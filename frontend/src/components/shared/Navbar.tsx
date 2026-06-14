import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { Avatar } from './Avatar';
import { LogOut, DollarSign } from 'lucide-react';

export const Navbar: React.FC = () => {
  const { user, logout, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  if (!isAuthenticated) return null;

  return (
    <nav
      style={{
        height: '4.5rem',
        backgroundColor: 'var(--bg-card)',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 1.5rem',
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}
    >
      {/* Brand logo */}
      <Link
        to="/dashboard"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          fontSize: '1.25rem',
          fontWeight: 800,
          fontFamily: 'var(--font-heading)',
          color: 'var(--primary-container)',
        }}
      >
        <div
          style={{
            backgroundColor: 'var(--primary-container)',
            color: '#ffffff',
            borderRadius: 'var(--radius-md)',
            padding: '0.25rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <DollarSign size={20} strokeWidth={2.5} />
        </div>
        <span>Splitwise Clone</span>
      </Link>

      {/* User profile actions */}
      {user && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', textAlign: 'right' }}>
            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-heading)' }}>
              {user.name}
            </span>
            <Avatar name={user.name} url={user.avatarUrl} size="sm" />
          </div>

          <button
            className="btn btn-secondary"
            onClick={handleLogout}
            title="Log out"
            style={{
              padding: '0.5rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 'var(--radius-md)',
            }}
          >
            <LogOut size={16} />
          </button>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
