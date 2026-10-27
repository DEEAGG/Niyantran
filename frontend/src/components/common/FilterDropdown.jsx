import React from 'react';
import { Filter, ChevronDown } from 'lucide-react';
import { cn } from '../../utils/cn';

export default function FilterDropdown({
  label = 'Filter',
  value,
  onChange,
  options = [],
  className = '',
}) {
  return (
    <div className={cn('relative inline-block text-left', className)}>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{
            backgroundColor: 'var(--surface-elevated)',
            color: 'var(--text-primary)',
            borderColor: 'var(--border)',
          }}
          className="appearance-none inline-flex items-center gap-2 pl-8 pr-8 py-2 rounded-lg border text-xs font-medium hover:bg-[var(--surface-hover)] focus:outline-none focus:ring-1 focus:ring-accent transition-colors cursor-pointer"
        >
          {options.map((opt) => {
            const val = typeof opt === 'object' ? opt.value : opt;
            const text = typeof opt === 'object' ? opt.label : opt;
            return (
              <option 
                key={val} 
                value={val} 
                style={{ backgroundColor: 'var(--surface-elevated)', color: 'var(--text-primary)' }}
              >
                {text}
              </option>
            );
          })}
        </select>
        <div className="pointer-events-none absolute inset-y-0 left-0 pl-2.5 flex items-center text-text-muted">
          <Filter className="w-3.5 h-3.5" />
        </div>
        <div className="pointer-events-none absolute inset-y-0 right-0 pr-2.5 flex items-center text-text-muted">
          <ChevronDown className="w-3.5 h-3.5" />
        </div>
      </div>
    </div>
  );
}
