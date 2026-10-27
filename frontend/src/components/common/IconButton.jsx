import React from 'react';
import { cn } from '../../utils/cn';

export default function IconButton({
  icon: Icon,
  variant = 'ghost',
  size = 'md',
  title,
  ariaLabel,
  disabled = false,
  className = '',
  onClick,
  ...props
}) {
  const baseStyles = 'inline-flex items-center justify-center rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';

  const variants = {
    ghost: 'text-slate-500 hover:text-slate-800 hover:bg-slate-100 focus:ring-slate-300',
    secondary: 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 focus:ring-brand-blue shadow-sm',
    primary: 'bg-brand-blue text-white hover:bg-brand-blue-hover focus:ring-brand-blue shadow-sm',
    danger: 'text-rose-600 hover:bg-rose-50 hover:text-rose-700 focus:ring-rose-400',
  };

  const sizes = {
    sm: 'p-1.5',
    md: 'p-2',
    lg: 'p-2.5',
  };

  const iconSizes = {
    sm: 'w-3.5 h-3.5',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  };

  return (
    <button
      type="button"
      title={title}
      aria-label={ariaLabel || title}
      disabled={disabled}
      onClick={onClick}
      className={cn(baseStyles, variants[variant], sizes[size], className)}
      {...props}
    >
      <Icon className={iconSizes[size]} />
    </button>
  );
}
