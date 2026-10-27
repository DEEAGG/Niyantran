import React from 'react';
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import { cn } from '../../utils/cn';
import Skeleton from './Skeleton';
import EmptyState from './EmptyState';

export default function DataTable({
  columns = [],
  data = [],
  keyField = 'id',
  isLoading = false,
  emptyTitle = 'No records found',
  emptyMessage = 'There are no regulatory records matching your criteria.',
  sortColumn,
  sortDirection = 'asc',
  onSort,
  onRowClick,
  className = '',
}) {
  if (isLoading) {
    return (
      <div className="bg-surface rounded-xl border border-border overflow-hidden shadow-surface">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-8 w-24" />
        </div>
        <div className="p-4 space-y-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="bg-surface rounded-xl border border-border overflow-hidden shadow-surface p-6">
        <EmptyState title={emptyTitle} message={emptyMessage} />
      </div>
    );
  }

  return (
    <div className={cn('bg-surface rounded-xl border border-border shadow-surface overflow-hidden', className)}>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs sm:text-sm text-text-secondary">
          <thead className="bg-background border-b border-border text-[11px] font-semibold uppercase tracking-wider text-text-muted font-mono">
            <tr>
              {columns.map((col, idx) => {
                const isSortable = col.sortable && onSort;
                const isSorted = sortColumn === col.key;

                return (
                  <th
                    key={col.key || idx}
                    scope="col"
                    className={cn(
                      'px-4 py-3 select-none',
                      isSortable && 'cursor-pointer hover:text-text-primary transition-colors',
                      col.align === 'right' && 'text-right',
                      col.align === 'center' && 'text-center',
                      col.className
                    )}
                    onClick={() => isSortable && onSort(col.key)}
                  >
                    <div className={cn(
                      'inline-flex items-center gap-1.5',
                      col.align === 'right' && 'justify-end w-full',
                      col.align === 'center' && 'justify-center w-full'
                    )}>
                      <span>{col.label}</span>
                      {isSortable && (
                        <span className="text-text-muted">
                          {isSorted ? (
                            sortDirection === 'asc' ? (
                              <ChevronUp className="w-3.5 h-3.5 text-accent" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5 text-accent" />
                            )
                          ) : (
                            <ChevronsUpDown className="w-3.5 h-3.5" />
                          )}
                        </span>
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {data.map((row, rowIndex) => {
              const rowKey = row[keyField] || rowIndex;
              return (
                <tr
                  key={rowKey}
                  onClick={() => onRowClick && onRowClick(row)}
                  className={cn(
                    'transition-colors hover:bg-surface-elevated/60',
                    onRowClick && 'cursor-pointer'
                  )}
                >
                  {columns.map((col, colIndex) => {
                    return (
                      <td
                        key={`${rowKey}-${col.key || colIndex}`}
                        className={cn(
                          'px-4 py-3.5 text-text-primary align-middle',
                          col.align === 'right' && 'text-right',
                          col.align === 'center' && 'text-center',
                          col.className
                        )}
                      >
                        {col.render ? col.render(row[col.key], row, rowIndex) : row[col.key]}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
