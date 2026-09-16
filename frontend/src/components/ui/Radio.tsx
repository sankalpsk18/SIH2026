// ============================================================================
// ADALAT360 - Radio Component
// ============================================================================

import React, { forwardRef, InputHTMLAttributes } from 'react';

interface RadioProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  options: Array<{ value: string; label: string; disabled?: boolean }>;
}

export const Radio = forwardRef<HTMLInputElement, RadioProps>(
  ({ label, error, options, className = '', id, ...props }, ref) => {
    const radioGroupId = id || `radio-group-${Math.random().toString(36).substr(2, 9)}`;

    return (
      <div className={className} role="radiogroup" aria-label={label}>
        {label && (
          <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>
        )}
        <div className="space-y-2">
          {options.map((option) => (
            <label key={option.value} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name={radioGroupId}
                value={option.value}
                disabled={option.disabled}
                className={`
                  w-4 h-4 text-primary-600 border-gray-300
                  focus:ring-2 focus:ring-primary-500 focus:ring-offset-2
                  ${error ? 'border-red-500' : ''}
                `}
                aria-invalid={error ? 'true' : 'false'}
                {...props}
              />
              <span className="text-sm text-gray-700">{option.label}</span>
            </label>
          ))}
        </div>
        {error && (
          <p className="mt-1 text-sm text-red-600 flex items-center gap-1" role="alert">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            {error}
          </p>
        )}
      </div>
    );
  }
);

Radio.displayName = 'Radio';