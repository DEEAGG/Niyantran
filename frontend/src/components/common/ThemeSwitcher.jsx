import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme, THEMES } from '../../context/ThemeContext';

export default function ThemeSwitcher() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === THEMES.DARK;

  return (
    <div className="fixed bottom-4 left-4 z-40">
      <button
        onClick={toggleTheme}
        type="button"
        title={`Switch to ${isDark ? 'Light' : 'Dark'} theme`}
        aria-label={`Switch to ${isDark ? 'Light' : 'Dark'} theme`}
        className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-elevated border border-border text-xs text-text-secondary hover:text-text-primary hover:border-accent transition-all shadow-elevated group cursor-pointer"
      >
        {isDark ? (
          <Moon className="w-3.5 h-3.5 text-accent transition-transform group-hover:rotate-12" />
        ) : (
          <Sun className="w-3.5 h-3.5 text-amber-500 transition-transform group-hover:rotate-45" />
        )}
        <span className="font-mono text-[11px] font-medium">
          {isDark ? 'Dark' : 'Light'}
        </span>
        <div className="flex items-center gap-1 pl-1 border-l border-border">
          {isDark ? (
            <>
              <span className="w-2 h-2 rounded-full bg-[#0B0F17] border border-border" />
              <span className="w-2 h-2 rounded-full bg-[#111827]" />
              <span className="w-2 h-2 rounded-full bg-[#E43D12]" />
            </>
          ) : (
            <>
              <span className="w-2 h-2 rounded-full bg-[#F8F7F4] border border-border" />
              <span className="w-2 h-2 rounded-full bg-[#FFFFFF]" />
              <span className="w-2 h-2 rounded-full bg-[#E43D12]" />
            </>
          )}
        </div>
      </button>
    </div>
  );
}
