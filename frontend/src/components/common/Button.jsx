import React from 'react';
import { cn } from '../../utils/cn';
import { Loader2 } from 'lucide-react';

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  loading = false,
  disabled = false,
  icon: Icon,
  iconPosition = 'left',
  className = '',
  type = 'button',
  onClick,
  ...props
}) {
  const isBusy = isLoading || loading;
  const baseStyles =
    'inline-flex items-center justify-center font-medium rounded-lg transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-background disabled:opacity-50 disabled:cursor-not-allowed select-none';

  const variants = {
    primary:
      'bg-accent text-accent-foreground font-semibold hover:bg-accent-hover shadow-md shadow-accent/15 hover:shadow-lg hover:shadow-accent/25 hover:-translate-y-0.5 active:translate-y-0 focus:ring-accent border border-accent/40',
    secondary:
      'bg-surface-elevated text-text-primary border border-border hover:bg-surface-hover hover:border-border-strong hover:text-text-primary focus:ring-accent',
    accent:
      'bg-surface-secondary text-text-primary hover:bg-surface-hover focus:ring-accent border border-border',
    dark:
      'bg-surface text-text-primary border border-border hover:bg-surface-elevated focus:ring-accent',
    outline:
      'bg-transparent text-accent border border-accent/40 hover:bg-accent/10 focus:ring-accent',
    ghost:
      'bg-transparent text-text-muted hover:text-text-primary hover:bg-surface-elevated focus:ring-border',
    danger:
      'bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 focus:ring-red-500 font-semibold',
    success:
      'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 focus:ring-emerald-500 font-semibold',
  };

  const sizes = {
    sm: 'text-xs px-3 py-1.5 gap-1.5',
    md: 'text-xs sm:text-sm px-4 py-2 gap-2',
    lg: 'text-sm sm:text-base px-5 py-2.5 gap-2.5',
  };

  return (
    <button
      type={type}
      disabled={disabled || isBusy}
      onClick={onClick}
      className={cn(baseStyles, variants[variant], sizes[size], className)}
      {...props}
    >
      {isBusy ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin shrink-0" />
          <span>{children}</span>
        </>
      ) : (
        <>
          {Icon && iconPosition === 'left' && <Icon className="w-4 h-4 shrink-0" />}
          <span>{children}</span>
          {Icon && iconPosition === 'right' && <Icon className="w-4 h-4 shrink-0" />}
        </>
      )}
    </button>
  );
}
