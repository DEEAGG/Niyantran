import React from 'react';
import { cn } from '../../utils/cn';

/**
 * PageHeader — unified page top for the platform.
 * Quiet, sentence-case, with optional eyebrow, title, description and actions.
 */
export default function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className = '',
}) {
  return (
    <div className={cn('flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between', className)}>
      <div className="min-w-0">
        {eyebrow && (
          <p className="mb-1 text-xs font-medium text-text-muted">{eyebrow}</p>
        )}
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-text-primary">
          {title}
        </h1>
        {description && (
          <p className="mt-1.5 max-w-2xl text-sm text-text-secondary leading-relaxed">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2.5 shrink-0">{actions}</div>}
    </div>
  );
}
