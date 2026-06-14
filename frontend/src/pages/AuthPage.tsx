import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store';
import { DollarSign, Mail, Lock, User as UserIcon, ShieldAlert } from 'lucide-react';
import Toast from '../components/shared/Toast';

export const AuthPage: React.FC = () => {
  const { login, register, isAuthenticated, errorAuth, loadingAuth } = useStore();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [localError, setLocalError] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState('');

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    // Basic Validations
    if (!email.trim() || !password) {
      setLocalError('Please fill in all required fields');
      return;
    }

    if (activeTab === 'register') {
      if (!name.trim()) {
        setLocalError('Name is required');
        return;
      }
      if (password !== confirmPassword) {
        setLocalError('Passwords do not match');
        return;
      }
      if (password.length < 6) {
        setLocalError('Password must be at least 6 characters long');
        return;
      }
    }

    try {
      if (activeTab === 'login') {
        await login(email.trim(), password);
        setToastMsg('Welcome back!');
      } else {
        await register(name.trim(), email.trim(), password);
        setToastMsg('Account created successfully!');
      }
      navigate('/dashboard');
    } catch (err) {
      // Errors are handled by store and displayed via errorAuth
    }
  };

  const errorToDisplay = localError || errorAuth;

  return (
    <div className="auth-page">
      <div className="auth-card">
        {/* Auth Header Logo */}
        <div className="auth-header">
          <div className="auth-logo">
            <div
              style={{
                backgroundColor: 'var(--primary-container)',
                color: '#ffffff',
                borderRadius: 'var(--radius-md)',
                padding: '0.35rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <DollarSign size={24} strokeWidth={2.5} />
            </div>
            <span>Splitwise</span>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            Split bills, track expenses, and settle up easily.
          </p>
        </div>

        {/* Tab Toggle */}
        <div className="auth-tabs">
          <div
            className={`auth-tab ${activeTab === 'login' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('login');
              setLocalError(null);
            }}
          >
            Log In
          </div>
          <div
            className={`auth-tab ${activeTab === 'register' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('register');
              setLocalError(null);
            }}
          >
            Register
          </div>
        </div>

        {/* Error Alert */}
        {errorToDisplay && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              backgroundColor: 'var(--danger-bg)',
              color: 'var(--danger)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              borderRadius: 'var(--radius-md)',
              padding: '0.75rem',
              fontSize: '0.875rem',
              marginBottom: '1.25rem',
            }}
          >
            <ShieldAlert size={18} style={{ flexShrink: 0 }} />
            <span>{errorToDisplay}</span>
          </div>
        )}

        {/* Auth Form */}
        <form onSubmit={handleSubmit}>
          {activeTab === 'register' && (
            <div className="form-group">
              <label className="form-label">Name</label>
              <div style={{ position: 'relative' }}>
                <span
                  style={{
                    position: 'absolute',
                    left: '0.875rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--text-muted)',
                  }}
                >
                  <UserIcon size={18} />
                </span>
                <input
                  type="text"
                  className="form-input"
                  style={{ paddingLeft: '2.5rem' }}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. John Doe"
                  required
                />
              </div>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Email Address</label>
            <div style={{ position: 'relative' }}>
              <span
                style={{
                  position: 'absolute',
                  left: '0.875rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)',
                }}
              >
                <Mail size={18} />
              </span>
              <input
                type="email"
                className="form-input"
                style={{ paddingLeft: '2.5rem' }}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@example.com"
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <div style={{ position: 'relative' }}>
              <span
                style={{
                  position: 'absolute',
                  left: '0.875rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)',
                }}
              >
                <Lock size={18} />
              </span>
              <input
                type="password"
                className="form-input"
                style={{ paddingLeft: '2.5rem' }}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>
          </div>

          {activeTab === 'register' && (
            <div className="form-group">
              <label className="form-label">Confirm Password</label>
              <div style={{ position: 'relative' }}>
                <span
                  style={{
                    position: 'absolute',
                    left: '0.875rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--text-muted)',
                  }}
                >
                  <Lock size={18} />
                </span>
                <input
                  type="password"
                  className="form-input"
                  style={{ paddingLeft: '2.5rem' }}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', marginTop: '1rem', height: '2.75rem' }}
            disabled={loadingAuth}
          >
            {loadingAuth
              ? 'Please wait...'
              : activeTab === 'login'
              ? 'Log In'
              : 'Create Account'}
          </button>
        </form>
      </div>

      {toastMsg && (
        <Toast
          message={toastMsg}
          type="success"
          onClose={() => setToastMsg('')}
        />
      )}
    </div>
  );
};

export default AuthPage;
