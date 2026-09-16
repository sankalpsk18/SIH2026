// ============================================================================
// ADALAT360 - Divider Component
// ============================================================================

import React, { ReactNode } from 'react';

interface DividerProps {
  orientation?: 'horizontal' | 'vertical';
  label?: ReactNode;
  className?: string;
  dashed?: boolean;
}

export function Divider({ orientation = 'horizontal', label, className = '', dashed = false }: DividerProps) {
  const baseStyles = 'border-gray-200';

  if (orientation === 'vertical') {
    return (
      <div className={`${baseStyles} ${dashed ? 'border-dashed' : 'border-solid'} border-l ${className}`} role="separator" />
    );
  }

  if (label) {
    return (
      <div className="flex items-center gap-4" role="separator">
        <div className={`flex-1 ${baseStyles} ${dashed ? 'border-t-dashed' : 'border-t-solid'} border-t`} />
        <div className="px-2 text-sm text-gray-500 whitespace-nowrap flex-shrink-0">{label}</div>
        <div className={`flex-1 ${baseStyles} ${dashed ? 'border-t-dashed' : 'border-t-solid'} border-t`} />
      </div>
    );
  }

  return <hr className={`${baseStyles} ${dashed ? 'border-t-dashed' : 'border-t-solid'} border-t ${className}`} role="separator" />;
}