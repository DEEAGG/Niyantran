import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import Button from './Button';

export default function ErrorState({
  title = 'Failed to load regulatory data',
  message = 'An unexpected error occurred while communicating with the service gateway.',
  onRetry,
}) {
  return (
    <div className="bg-rose-950/20 border border-rose-800/40 rounded-xl p-8 text-center flex flex-col items-center justify-center">
      <div className="w-12 h-12 rounded-xl bg-rose-950/60 border border-rose-800/60 flex items-center justify-center text-rose-400 mb-3">
        <AlertTriangle className="w-6 h-6 stroke-[1.8]" />
      </div>
      <h3 className="text-base font-semibold text-rose-400">{title}</h3>
      <p className="text-xs sm:text-sm text-text-secondary max-w-sm mt-1 mb-4">
        {message}
      </p>
      {onRetry && (
        <Button variant="danger" size="sm" icon={RefreshCw} onClick={onRetry}>
          Try Again
        </Button>
      )}
    </div>
  );
}
