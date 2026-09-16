// ============================================================================
// ADALAT360 - Alert Component
// ============================================================================

import React, { ReactNode } from 'react';
import { X, AlertCircle, CheckCircle, Info, AlertTriangle } from 'lucide-react';

type AlertVariant = 'info' | 'success' | 'warning' | 'danger';

const variantStyles: Record<AlertVariant, { bg: string; border: string; text: string; icon: ReactNode }> = {
  info: {
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    text: 'text-blue-800',
    icon: <Info className="w-5 h-5 text-blue-500" />,
  },
  success: {
    bg: 'bg-green-50',
    border: 'border-green-200',
    text: 'text-green-800',
    icon: <CheckCircle className="w-5 h-5 text-green-500" />,
  },
  warning: {
    bg: 'bg-yellow-50',
    border: 'border-yellow-200',
    text: 'text-yellow-800',
    icon: <AlertTriangle className="w-5 h-5 text-yellow-500" />,
  },
  danger: {
    bg: 'bg-red-50',
    border: 'border-red-200',
    text: 'text-red-800',
    icon: <AlertCircle className="w-5 h-5 text-red-500" />,
  },
};

interface AlertProps {
  variant?: AlertVariant;
  title?: string;
  children: ReactNode;
  dismissible?: boolean;
  onDismiss?: () => void;
  className?: string;
}

export function Alert({ variant = 'info', title, children, dismissible = false, onDismiss, className = '' }: AlertProps) {
  const styles = variantStyles[variant];

  return (
    <div
      className={`flex items-start gap-3 p-4 rounded-lg border ${styles.bg} ${styles.border} ${styles.text} ${className}`}
      role="alert"
    >
      <div className="flex-shrink-0 mt-0.5">{styles.icon}</div>
      <div className="flex-1">
        {title && <h4 className="font-medium mb-1">{title}</h4>}
        <div className="text-sm">{children}</div>
      </div>
      {dismissible && (
        <button
          onClick={onDismiss}
          className="flex-shrink-0 p-1 hover:bg-black/10 rounded transition-colors"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}