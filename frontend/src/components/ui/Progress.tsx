// ============================================================================
// ADALAT360 - Progress Component
// ============================================================================

import React from 'react';

interface ProgressProps {
  value: number;
  max?: number;
  showLabel?: boolean;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'primary' | 'success' | 'warning' | 'danger';
  className?: string;
  animated?: boolean;
  striped?: boolean;
}

const sizeStyles = {
  sm: 'h-1.5',
  md: 'h-2',
  lg: 'h-3',
};

const variantStyles = {
  primary: 'bg-primary-600',
  success: 'bg-green-600',
  warning: 'bg-yellow-500',
  danger: 'bg-red-600',
};

export function Progress({
  value,
  max = 100,
  showLabel = false,
  label,
  size = 'md',
  variant = 'primary',
  className = '',
  animated = false,
  striped = false,
}: ProgressProps) {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));

  return (
    <div className={className}>
      {(label || showLabel) && (
        <div className="flex items-center justify-between text-sm mb-1">
          <span className="font-medium text-gray-700">{label}</span>
          {showLabel && <span className="text-gray-500">{Math.round(percentage)}%</span>}
        </div>
      )}
      <div className={`w-full bg-gray-200 rounded-full overflow-hidden ${sizeStyles[size]}`}>
        <div
          className={`h-full rounded-full transition-all duration-300 ease-out ${variantStyles[variant]} ${
            animated ? 'animate-pulse' : ''
          } ${striped ? 'bg-gradient-to-r from-transparent via-white/20 to-transparent bg-[length:20px_20px] animate-stripes' : ''}`}
          style={{ width: `${percentage}%` }}
          role="progressbar"
          aria-valuenow={value}
          aria-valuemin={0}
          aria-valuemax={max}
          aria-label={label}
        />
      </div>
    </div>
  );
}

export function CircularProgress({
  value,
  max = 100,
  size = 48,
  strokeWidth = 4,
  variant = 'primary',
  showLabel = false,
  className = '',
}: {
  value: number;
  max?: number;
  size?: number;
  strokeWidth?: number;
  variant?: 'primary' | 'success' | 'warning' | 'danger';
  showLabel?: boolean;
  className?: string;
}) {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  const variantStrokeColors = {
    primary: 'text-primary-600',
    success: 'text-green-600',
    warning: 'text-yellow-500',
    danger: 'text-red-600',
  };

  return (
    <div className={`relative inline-flex items-center justify-center ${className}`}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-gray-200"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className={`${variantStrokeColors[variant]} transition-all duration-500 ease-out`}
          style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.1))' }}
        />
      </svg>
      {showLabel && (
        <span className="absolute text-center">
          <span className="text-sm font-bold text-gray-900">{Math.round(percentage)}%</span>
        </span>
      )}
    </div>
  );
}