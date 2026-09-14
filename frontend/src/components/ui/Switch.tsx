// ============================================================================
// ADALAT360 - Switch Component
// ============================================================================

import React, { forwardRef, InputHTMLAttributes } from 'react';

interface SwitchProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  description?: string;
}

export const Switch = forwardRef<HTMLInputElement, SwitchProps>(
  ({ label, description, className = '', id, ...props }, ref) => {
    const switchId = id || `switch-${Math.random().toString(36).substr(2, 9)}`;

    return (
      <div className={`flex items-center gap-3 ${className}`}>
        <div className="relative inline-flex items-center">
          <input
            ref={ref}
            id={switchId}
            type="checkbox"
            className={`
              peer w-11 h-6 appearance-none rounded-full
              bg-gray-200 peer-focus:ring-2 peer-focus:ring-primary-500
              peer-checked:bg-primary-600 peer-checked:border-primary-600
              border border-transparent transition-colors cursor-pointer
              after:content-[''] after:absolute after:top-[2px] after:left-[2px]
              after:w-5 after:h-5 after:bg-white after:rounded-full
              after:transition-transform after:duration-200
              peer-checked:after:translate-x-full
            `}
            {...props}
          />
        </div>
        <div className="text-sm">
          {label && <label htmlFor={switchId} className="font-medium text-gray-700">{label}</label>}
          {description && <p className="text-gray-500">{description}</p>}
        </div>
      </div>
    );
  }
);

Switch.displayName = 'Switch';