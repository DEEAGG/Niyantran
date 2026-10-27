import React from 'react';
import { cn } from '../../utils/cn';

export default function Tabs({
  tabs = [],
  activeTab,
  onChange,
  className = '',
  variant = 'underline', // 'underline' | 'pills'
}) {
  return (
    <div className={cn('border-b border-border', className)}>
      <nav className="-mb-px flex space-x-6 overflow-x-auto" aria-label="Tabs">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;

          if (variant === 'pills') {
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onChange(tab.id)}
                className={cn(
                  'inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all mb-2',
                  isActive
                    ? 'bg-surface-elevated text-text-primary border border-border shadow-subtle'
                    : 'text-text-secondary hover:text-text-primary hover:bg-surface'
                )}
              >
                {Icon && <Icon className="w-3.5 h-3.5" />}
                <span>{tab.label}</span>
                {tab.count !== undefined && (
                  <span
                    className={cn(
                      'ml-1 text-[10px] px-1.5 py-0.2 rounded font-mono',
                      isActive ? 'bg-accent/20 text-accent font-bold' : 'bg-surface-elevated text-text-muted'
                    )}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          }

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              className={cn(
                'inline-flex items-center gap-2 py-3 px-1 border-b-2 text-xs sm:text-sm font-semibold tracking-tight transition-colors whitespace-nowrap',
                isActive
                  ? 'border-accent text-accent'
                  : 'border-transparent text-text-secondary hover:text-text-primary hover:border-border'
              )}
            >
              {Icon && <Icon className="w-4 h-4" />}
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span
                  className={cn(
                    'text-[11px] px-1.5 py-0.5 rounded font-mono font-medium',
                    isActive ? 'bg-accent/15 text-accent font-bold' : 'bg-surface-elevated text-text-muted'
                  )}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
