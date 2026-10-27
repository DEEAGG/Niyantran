import React from 'react';
import { cn } from '../../utils/cn';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

export default function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  iconColor = 'text-accent bg-surface-elevated border-border',
  trend,
  trendDirection = 'neutral',
  className = '',
  onClick,
}) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'bg-surface rounded-xl border border-border p-5 shadow-surface transition-all duration-200 hover:border-border-strong hover:bg-surface-elevated/40',
        onClick && 'cursor-pointer',
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div>
          <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider font-mono">
            {title}
          </span>
          <div className="text-2xl sm:text-3xl font-bold text-text-primary mt-1 tracking-tight font-sans">
            {value}
          </div>
        </div>

        {Icon && (
          <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center border shrink-0', iconColor)}>
            <Icon className="w-5 h-5 stroke-[1.8]" />
          </div>
        )}
      </div>

      {(subtitle || trend) && (
        <div className="mt-3.5 pt-3 border-t border-border-subtle flex items-center justify-between text-xs text-text-secondary">
          <span className="truncate">{subtitle}</span>

          {trend && (
            <span
              className={cn(
                'inline-flex items-center gap-1 font-semibold shrink-0 ml-2 font-mono text-[11px]',
                trendDirection === 'up' && 'text-emerald-400',
                trendDirection === 'down' && 'text-rose-400',
                trendDirection === 'neutral' && 'text-text-muted'
              )}
            >
              {trendDirection === 'up' && <TrendingUp className="w-3.5 h-3.5" />}
              {trendDirection === 'down' && <TrendingDown className="w-3.5 h-3.5" />}
              {trendDirection === 'neutral' && <Minus className="w-3.5 h-3.5" />}
              {trend}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
