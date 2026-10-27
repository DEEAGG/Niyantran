import React from 'react';
import { Palette } from 'lucide-react';
import { useTheme, THEMES } from '../../context/ThemeContext';

export default function ThemeSwitcher() {
  const { theme, toggleTheme } = useTheme();
  const isExperimental = theme === THEMES.EXPERIMENTAL;

  return (
    <div className="fixed bottom-4 left-4 z-40">
      <button
        onClick={toggleTheme}
        type="button"
        title="Toggle between Earth Modern & Obsidian presets"
        className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-elevated border border-border text-xs text-text-secondary hover:text-text-primary hover:border-accent transition-all shadow-elevated group"
      >
        <Palette className="w-3.5 h-3.5 text-accent group-hover:rotate-45 transition-transform" />
        <span className="font-mono text-[11px]">
          {isExperimental ? 'Dark Neutral' : 'Obsidian'}
        </span>
        <div className="flex items-center gap-1 pl-1 border-l border-border">
          {isExperimental ? (
            <>
              <span className="w-2 h-2 rounded-full bg-[#0D1117] border border-border" />
              <span className="w-2 h-2 rounded-full bg-[#1C232B]" />
              <span className="w-2 h-2 rounded-full bg-[#83B8E0]" />
            </>
          ) : (
            <>
              <span className="w-2 h-2 rounded-full bg-[#090D14] border border-[#3E4F69]" />
              <span className="w-2 h-2 rounded-full bg-[#131A26]" />
              <span className="w-2 h-2 rounded-full bg-[#5B8CFF]" />
            </>
          )}
        </div>
      </button>
    </div>
  );
}
