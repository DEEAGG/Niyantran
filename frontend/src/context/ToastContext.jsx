import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((options, maybeType) => {
    let title = '';
    let message = '';
    let type = 'info';
    let duration = 4000;

    if (typeof options === 'string') {
      message = options;
      if (typeof maybeType === 'string') type = maybeType;
    } else if (options && typeof options === 'object') {
      title = options.title || '';
      message = options.message || '';
      type = options.type || 'info';
      if (options.duration !== undefined) duration = options.duration;
    }

    const id = Date.now() + Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, title, message, type }]);

    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }
  }, [removeToast]);

  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      {children}
      {/* Toast Notification Container */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
        {toasts.map((toast) => {
          const typeConfig = {
            success: {
              icon: CheckCircle2,
              border: 'border-emerald-800/60',
              bg: 'bg-[#111722] text-[#F1F5F9]',
              iconColor: 'text-[#34D399]',
            },
            error: {
              icon: AlertCircle,
              border: 'border-rose-800/60',
              bg: 'bg-[#111722] text-[#F1F5F9]',
              iconColor: 'text-[#FB7185]',
            },
            warning: {
              icon: AlertTriangle,
              border: 'border-amber-800/60',
              bg: 'bg-[#111722] text-[#F1F5F9]',
              iconColor: 'text-[#FBBF24]',
            },
            info: {
              icon: Info,
              border: 'border-blue-800/60',
              bg: 'bg-[#111722] text-[#F1F5F9]',
              iconColor: 'text-[#5B8CFF]',
            },
          }[toast.type] || {
            icon: Info,
            border: 'border-[#273244]',
            bg: 'bg-[#111722] text-[#F1F5F9]',
            iconColor: 'text-[#5B8CFF]',
          };

          const Icon = typeConfig.icon;

          return (
            <div
              key={toast.id}
              className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-xl border shadow-elevated transition-all ${typeConfig.bg} ${typeConfig.border}`}
              role="alert"
            >
              <Icon className={`w-5 h-5 shrink-0 mt-0.5 ${typeConfig.iconColor}`} />
              <div className="flex-1">
                {toast.title && (
                  <h5 className="text-xs font-semibold text-[#F1F5F9] leading-tight">
                    {toast.title}
                  </h5>
                )}
                {toast.message && (
                  <p className="text-xs text-[#94A3B8] mt-0.5 leading-relaxed">
                    {toast.message}
                  </p>
                )}
              </div>
              <button
                onClick={() => removeToast(toast.id)}
                className="p-1 rounded text-[#64748B] hover:text-[#F1F5F9]"
                aria-label="Close notification"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
