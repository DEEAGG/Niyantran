import React, { forwardRef } from 'react';
import { cn } from '../../utils/cn';

const Textarea = forwardRef(({
  label,
  error,
  helperText,
  rows = 3,
  className = '',
  id,
  required,
  ...props
}, ref) => {
  const textareaId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div className="w-full space-y-1.5 text-left">
      {label && (
        <label
          htmlFor={textareaId}
          className="block text-xs font-semibold text-text-secondary tracking-wide select-none"
        >
          {label} {required && <span className="text-rose-400">*</span>}
        </label>
      )}

      <textarea
        ref={ref}
        id={textareaId}
        rows={rows}
        required={required}
        style={{
          backgroundColor: 'var(--input-background)',
          color: 'var(--input-text)',
        }}
        className={cn(
          'block w-full rounded-lg border text-xs sm:text-sm p-3 placeholder:text-text-muted transition-colors',
          'focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          error
            ? 'border-rose-400 focus:border-rose-400 focus:ring-rose-400'
            : 'border-border hover:border-border-strong',
          className
        )}
        {...props}
      />

      {error ? (
        <p className="text-xs text-rose-400 mt-1">{error}</p>
      ) : helperText ? (
        <p className="text-xs text-text-muted mt-1">{helperText}</p>
      ) : null}
    </div>
  );
});

Textarea.displayName = 'Textarea';
export default Textarea;
