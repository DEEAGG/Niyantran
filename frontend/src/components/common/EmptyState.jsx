import React from 'react';
import Button from './Button';
import { DocumentStackDoodle, MagnifierDoodle } from './Doodles';

export default function EmptyState({
  title = 'No records found',
  message = 'There are no items matching your criteria or currently available in this view.',
  variant = 'documents', // 'documents' | 'search' | 'generic'
  icon: Icon,
  actionLabel,
  onAction,
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      {/* Decorative Vector Doodle Centerpiece */}
      <div className="mb-4">
        {variant === 'search' ? (
          <MagnifierDoodle className="w-14 h-14" />
        ) : (
          <DocumentStackDoodle className="w-16 h-16" />
        )}
      </div>

      <h3 className="text-sm sm:text-base font-bold text-text-primary tracking-tight">{title}</h3>
      <p className="text-xs text-text-secondary max-w-sm mt-1 leading-relaxed">
        {message}
      </p>
      {actionLabel && onAction && (
        <div className="mt-4">
          <Button variant="secondary" size="sm" onClick={onAction}>
            {actionLabel}
          </Button>
        </div>
      )}
    </div>
  );
}
