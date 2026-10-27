import React from 'react';
import { cn } from '../../utils/cn';

export default function Badge({
  children,
  variant = 'neutral',
  size = 'md',
  dot = false,
  className = '',
}) {
  const variants = {
    neutral: 'bg-white text-text-secondary border-border',
    success: 'bg-[#EBF6EE] text-[#18794E] border-[#18794E]/30 font-medium',
    pending: 'bg-[#FEF9EB] text-[#B45309] border-[#EFB112]/40 font-medium',
    warning: 'bg-[#FEF3C7] text-[#B45309] border-[#B45309]/30 font-medium',
    error: 'bg-[#FDF2F2] text-[#CE2C31] border-[#CE2C31]/30 font-medium',
    danger: 'bg-[#FDF2F2] text-[#CE2C31] border-[#CE2C31]/30 font-medium',
    info: 'bg-[#FDF1EE] text-[#E43D12] border-[#E43D12]/30 font-medium',
    outline: 'bg-transparent text-text-muted border-border',
  };

  const dotColors = {
    neutral: 'bg-text-muted',
    success: 'bg-[#18794E]',
    pending: 'bg-[#EFB112]',
    warning: 'bg-[#B45309]',
    error: 'bg-[#CE2C31]',
    danger: 'bg-[#CE2C31]',
    info: 'bg-[#E43D12]',
    outline: 'bg-text-muted',
  };

  const sizes = {
    sm: 'text-[11px] px-2 py-0.5 font-medium tracking-normal',
    md: 'text-xs px-2.5 py-0.5 font-medium tracking-normal',
    lg: 'text-xs px-3 py-1 font-semibold',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border font-sans',
        variants[variant] || variants.neutral,
        sizes[size],
        className
      )}
    >
      {dot && (
        <span
          className={cn('w-1.5 h-1.5 rounded-full shrink-0', dotColors[variant] || dotColors.neutral)}
        />
      )}
      <span>{children}</span>
    </span>
  );
}
