import React from 'react';
import { Check } from 'lucide-react';
import { cn } from '../../utils/cn';

export default function Stepper({
  steps = [],
  currentStep = 0,
  onStepClick,
  className = '',
}) {
  return (
    <div className={cn('w-full py-4', className)}>
      <nav aria-label="Progress">
        <ol className="flex items-center justify-between w-full">
          {steps.map((step, idx) => {
            const isCompleted = idx < currentStep;
            const isCurrent = idx === currentStep;
            const isUpcoming = idx > currentStep;

            return (
              <li
                key={step.title || idx}
                className={cn(
                  'relative flex-1 flex flex-col items-center group',
                  idx !== steps.length - 1 && 'after:content-[""] after:w-full after:h-0.5 after:top-4 after:left-1/2 after:absolute after:z-0',
                  idx !== steps.length - 1 && (isCompleted ? 'after:bg-accent' : 'after:bg-border')
                )}
              >
                <button
                  type="button"
                  disabled={!onStepClick || isUpcoming}
                  onClick={() => onStepClick && onStepClick(idx)}
                  className={cn(
                    'relative z-10 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all font-mono',
                    isCompleted && 'bg-accent text-accent-foreground shadow-glow-primary',
                    isCurrent && 'bg-surface border-2 border-accent text-accent ring-4 ring-accent/20',
                    isUpcoming && 'bg-surface border border-border text-text-muted',
                    onStepClick && !isUpcoming && 'cursor-pointer hover:scale-105'
                  )}
                >
                  {isCompleted ? <Check className="w-4 h-4 stroke-[2.5]" /> : idx + 1}
                </button>

                <div className="mt-2 text-center">
                  <span
                    className={cn(
                      'block text-xs font-semibold tracking-tight',
                      isCurrent && 'text-accent',
                      isCompleted && 'text-text-primary',
                      isUpcoming && 'text-text-muted'
                    )}
                  >
                    {step.title}
                  </span>
                  {step.subtitle && (
                    <span className="hidden sm:block text-[11px] text-text-muted">
                      {step.subtitle}
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </nav>
    </div>
  );
}
