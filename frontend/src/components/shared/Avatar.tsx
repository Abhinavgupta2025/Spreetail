import React from 'react';

interface AvatarProps {
  name: string;
  url?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
}

export const Avatar: React.FC<AvatarProps> = ({ name, url, size = 'md' }) => {
  const getInitials = (fullName: string) => {
    const parts = fullName.trim().split(' ');
    if (parts.length === 0 || !fullName) return '?';
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const getBackgroundColor = (fullName: string) => {
    let hash = 0;
    for (let i = 0; i < fullName.length; i++) {
      hash = fullName.charCodeAt(i) + ((hash << 5) - hash);
    }
    const colors = [
      '#10b981', // emerald
      '#3b82f6', // blue
      '#6366f1', // indigo
      '#8b5cf6', // violet
      '#ec4899', // pink
      '#f59e0b', // amber
      '#ef4444', // red
      '#06b6d4', // cyan
    ];
    const index = Math.abs(hash) % colors.length;
    return colors[index];
  };

  const sizeClasses = {
    xs: { width: '1.5rem', height: '1.5rem', fontSize: '0.75rem' },
    sm: { width: '2rem', height: '2rem', fontSize: '0.875rem' },
    md: { width: '2.5rem', height: '2.5rem', fontSize: '1rem' },
    lg: { width: '3.5rem', height: '3.5rem', fontSize: '1.5rem' },
    xl: { width: '5rem', height: '5rem', fontSize: '2.25rem' },
  };

  const selectedSize = sizeClasses[size];

  if (url && url.startsWith('http')) {
    return (
      <img
        src={url}
        alt={name}
        style={{
          width: selectedSize.width,
          height: selectedSize.height,
          borderRadius: '9999px',
          objectFit: 'cover',
          border: '2px solid var(--border)',
        }}
      />
    );
  }

  return (
    <div
      style={{
        width: selectedSize.width,
        height: selectedSize.height,
        borderRadius: '9999px',
        backgroundColor: getBackgroundColor(name),
        color: '#ffffff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 'bold',
        fontSize: selectedSize.fontSize,
        border: '1px solid rgba(255,255,255,0.1)',
        textShadow: '0 1px 1px rgba(0,0,0,0.15)',
        userSelect: 'none',
      }}
    >
      {getInitials(name)}
    </div>
  );
};

export default Avatar;
