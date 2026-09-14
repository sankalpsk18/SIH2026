// ============================================================================
// ADALAT360 - Skeleton Component
// ============================================================================

import React from 'react';

interface SkeletonProps {
  variant?: 'text' | 'circular' | 'rectangular';
  width?: string | number;
  height?: string | number;
  className?: string;
  count?: number;
  animation?: 'pulse' | 'wave' | 'none';
}

const animationStyles = {
  pulse: 'animate-pulse',
  wave: 'animate-[shimmer_1.5s_infinite]',
  none: '',
};

export function Skeleton({
  variant = 'text',
  width = '100%',
  height,
  className = '',
  count = 1,
  animation = 'pulse',
}: SkeletonProps) {
  const baseStyles = 'bg-gray-200 rounded';
  const animClass = animationStyles[animation];

  const skeletons = Array.from({ length: count }, (_, i) => (
    <div
      key={i}
      className={`${baseStyles} ${animClass} ${className}`}
      style={{
        width: variant === 'circular' ? height : width,
        height: height || (variant === 'text' ? '1rem' : variant === 'circular' ? height : '1rem'),
        borderRadius: variant === 'circular' ? '50%' : variant === 'text' ? '0.25rem' : '0.375rem',
      }}
    />
  ));

  return <div className="space-y-2">{skeletons}</div>;
}

export function SkeletonCard({ className = '' }: { className?: string }) {
  return (
    <div className={`bg-white rounded-xl border border-gray-200 p-6 ${className}`}>
      <Skeleton variant="rectangular" width="40%" height="1.5rem" count={1} animation="wave" />
      <Skeleton variant="rectangular" width="100%" height="1rem" count={3} animation="wave" />
      <div className="mt-4 flex gap-2">
        <Skeleton variant="circular" width={40} height={40} animation="pulse" />
        <div className="flex-1 space-y-2 mt-2">
          <Skeleton variant="text" width="60%" height="1rem" animation="wave" />
          <Skeleton variant="text" width="40%" height="1rem" animation="wave" />
        </div>
      </div>
    </div>
  );
}

export function SkeletonTable({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="w-full">
        <thead>
          <tr>
            {Array.from({ length: columns }, (_, i) => (
              <th key={i} className="px-4 py-3 text-gray-500 font-medium uppercase tracking-wider bg-gray-50 border-b border-gray-200">
                <Skeleton variant="text" width="80%" height="0.75rem" animation="pulse" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }, (_, rowIndex) => (
            <tr key={rowIndex} className="hover:bg-gray-50">
              {Array.from({ length: columns }, (_, colIndex) => (
                <td key={colIndex} className="px-4 py-3 border-b border-gray-100">
                  <Skeleton variant="text" width="90%" height="1rem" animation="pulse" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SkeletonList({ items = 5, hasAvatar = true, lines = 3 }: { items?: number; hasAvatar?: boolean; lines?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: items }, (_, i) => (
        <div key={i} className="flex items-start gap-4 p-4 bg-white rounded-xl border border-gray-200">
          {hasAvatar && <Skeleton variant="circular" width={48} height={48} animation="pulse" />}
          <div className="flex-1 space-y-2 min-w-0">
            <Skeleton variant="text" width="40%" height="1.25rem" animation="wave" />
            {Array.from({ length: lines }, (_, j) => (
              <Skeleton key={j} variant="text" width={`${60 + Math.random() * 30}%`} height="0.875rem" animation="wave" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}