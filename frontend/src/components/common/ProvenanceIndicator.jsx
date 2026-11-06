import React from 'react';
import { Link2 } from 'lucide-react';
import { cn } from '../../utils/cn';

/**
 * ProvenanceIndicator — Niyantran's recurring signature detail.
 *
 * Renders a monospace hash / chain-link notation plus an optional status label.
 * It ONLY renders real data: it displays whatever `hash` (and `status`) is
 * passed to it. It never generates decorative or fake verification values.
 * If no hash is provided it renders nothing.
 */
export default function ProvenanceIndicator({
  hash,
  status,
  statusTone = 'neutral',
  size = 'md',
  className = '',
  showIcon = true,
}) {
  if (!hash) return null;

  const toneClasses = {
    neutral: 'text-text-muted',
    success: 'text-status-success',
    warning: 'text-status-warning',
    error: 'text-status-error',
    accent: 'text-accent',
  };

  const sizeClasses = {
    sm: 'text-[10px] gap-1',
    md: 'text-[11px] gap-1.5',
    lg: 'text-xs gap-2',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center font-mono tracking-tight select-none',
        sizeClasses[size],
        className
      )}
      title={hash}
    >
      {showIcon && <Link2 className="w-3.5 h-3.5 shrink-0 opacity-70" />}
      <span className="text-text-muted">{hash}</span>
      {status && (
        <span className={cn('font-medium', toneClasses[statusTone] || toneClasses.neutral)}>
          {status}
        </span>
      )}
    </span>
  );
}
