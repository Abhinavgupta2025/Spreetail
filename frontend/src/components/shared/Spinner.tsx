import React from 'react';

interface SpinnerProps {
  fullPage?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export const Spinner: React.FC<SpinnerProps> = ({ fullPage = false, size = 'md' }) => {
  const sizeStyles = {
    sm: { width: '1.5rem', height: '1.5rem', borderWidth: '2px' },
    md: { width: '2.5rem', height: '2.5rem', borderWidth: '3px' },
    lg: { width: '4rem', height: '4rem', borderWidth: '4px' },
  };

  const selectedSize = sizeStyles[size];

  const spinnerElement = (
    <div
      className="spinner"
      style={{
        width: selectedSize.width,
        height: selectedSize.height,
        borderWidth: selectedSize.borderWidth,
        borderStyle: 'solid',
        borderColor: 'var(--border)',
        borderTopColor: 'var(--primary)',
        borderRadius: '9999px',
      }}
    />
  );

  if (fullPage) {
    return (
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'var(--bg-main)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
        }}
      >
        {spinnerElement}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '1rem' }}>
      {spinnerElement}
    </div>
  );
};

export default Spinner;
