// ============================================================================
// ADALAT360 - Spinner Component
// ============================================================================

import React from 'react';

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  color?: 'primary' | 'white' | 'gray';
  className?: string;
  label?: string;
}

const sizeStyles = {
  sm: 'w-4 h-4 border-2',
  md: 'w-6 h-6 border-2',
  lg: 'w-8 h-8 border-3',
  xl: 'w-12 h-12 border-4',
};

const colorStyles = {
  primary: 'border-primary-600 border-t-transparent',
  white: 'border-white border-t-transparent',
  gray: 'border-gray-400 border-t-transparent',
};

export function Spinner({ size = 'md', color = 'primary', className = '', label }: SpinnerProps) {
  return (
    <div className={`inline-flex items-center justify-center ${className}`} role="status" aria-label={label || 'Loading'}>
      <svg
        className={`animate-spin ${sizeStyles[size]} rounded-full ${colorStyles[color]}`}
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
      </svg>
      {label && <span className="sr-only">{label}</span>}
    </div>
  );
}

export function SpinnerOverlay({ label = 'Loading...', className = '' }: { label?: string; className?: string }) {
  return (
    <div className={`fixed inset-0 bg-white/80 backdrop-blur-sm z-50 flex items-center justify-center ${className}`} role="status" aria-label={label}>
      <div className="bg-white rounded-xl shadow-lg p-8 text-center">
        <Spinner size="lg" color="primary" label={label} />
        <p className="mt-4 text-sm text-gray-600">{label}</p>
      </div>
    </div>
  );
}

export function ButtonSpinner({ size = 'md', className = '' }: { size?: 'sm' | 'md' | 'lg'; className?: string }) {
  return (
    <Spinner size={size} color="white" className={className} />
  );
}