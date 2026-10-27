import React from 'react';
import { cn } from '../../utils/cn';

export default function Skeleton({ className = '', variant = 'rect' }) {
  return (
    <div
      className={cn(
        'animate-pulse bg-surface-elevated',
        variant === 'circle' ? 'rounded-full' : 'rounded-lg',
        className
      )}
    />
  );
}
