import React, { useEffect } from 'react';

interface ToastProps {
  message: string;
  type?: 'success' | 'error' | 'info';
  duration?: number;
  onClose: () => void;
}

export const Toast: React.FC<ToastProps> = ({ message, type = 'success', duration = 3000, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const bgColors = {
    success: 'var(--primary)',
    error: 'var(--danger-hover)',
    info: 'var(--secondary)',
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: '1.5rem',
        right: '1.5rem',
        backgroundColor: bgColors[type],
        color: '#ffffff',
        padding: '0.75rem 1.25rem',
        borderRadius: 'var(--radius-md)',
        boxShadow: 'var(--shadow-lg)',
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        fontSize: '0.9375rem',
        fontWeight: 500,
        animation: 'slideIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      <span>{message}</span>
      <button
        onClick={onClose}
        style={{
          background: 'none',
          border: 'none',
          color: 'inherit',
          cursor: 'pointer',
          fontWeight: 'bold',
          opacity: 0.8,
          fontSize: '1.1rem',
          lineHeight: 1,
        }}
      >
        &times;
      </button>

      <style>{`
        @keyframes slideIn {
          from {
            transform: translateX(100%) translateY(-10px);
            opacity: 0;
          }
          to {
            transform: translateX(0) translateY(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
};

export default Toast;
