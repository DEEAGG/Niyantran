import React, { forwardRef } from 'react';
import { cn } from '../../utils/cn';
import { ChevronDown } from 'lucide-react';

const Select = forwardRef(({
  label,
  options = [],
  error,
  helperText,
  className = '',
  id,
  required,
  placeholder,
  value,
  onChange,
  ...props
}, ref) => {
  const selectId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div className="w-full space-y-1.5 text-left">
      {label && (
        <label
          htmlFor={selectId}
          className="block text-xs font-semibold text-text-secondary tracking-wide select-none"
        >
          {label} {required && <span className="text-rose-400">*</span>}
        </label>
      )}

      <div className="relative rounded-lg">
        <select
          ref={ref}
          id={selectId}
          required={required}
          value={value}
          onChange={onChange}
          style={{
            backgroundColor: 'var(--input-background)',
            color: 'var(--text-primary)',
          }}
          className={cn(
            'block w-full appearance-none rounded-lg border text-xs sm:text-sm px-3 py-2 pr-9 transition-colors',
            'focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            error
              ? 'border-rose-400 focus:border-rose-400 focus:ring-rose-400'
              : 'border-border hover:border-border-strong',
            className
          )}
          {...props}
        >
          {placeholder && (
            <option
              value=""
              style={{
                backgroundColor: 'var(--surface-elevated)',
                color: 'var(--text-muted)',
              }}
            >
              {placeholder}
            </option>
          )}
          {options.map((opt) => {
            const val = typeof opt === 'object' ? opt.value : opt;
            const text = typeof opt === 'object' ? opt.label : opt;
            return (
              <option
                key={val}
                value={val}
                style={{
                  backgroundColor: 'var(--surface-elevated)',
                  color: 'var(--text-primary)',
                }}
              >
                {text}
              </option>
            );
          })}
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-text-muted">
          <ChevronDown className="w-4 h-4" />
        </div>
      </div>

      {error ? (
        <p className="text-xs text-rose-400 mt-1">{error}</p>
      ) : helperText ? (
        <p className="text-xs text-text-muted mt-1">{helperText}</p>
      ) : null}
    </div>
  );
});

Select.displayName = 'Select';
export default Select;
