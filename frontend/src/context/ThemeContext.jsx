import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext(null);

export const THEMES = {
  LIGHT: 'theme-light',
  DARK: 'theme-dark',
};

export const THEME_METADATA = [
  {
    id: THEMES.LIGHT,
    name: 'Light',
    description: 'Clean, high-contrast light regulatory canvas with warm ivory surfaces and deep slate typography (WCAG AAA).',
    swatches: ['#F8F7F4', '#FFFFFF', '#E2DFD7', '#E43D12', '#0F172A'],
  },
  {
    id: THEMES.DARK,
    name: 'Dark',
    description: 'Naturally darkened NIYANTRAN canvas with deep warm charcoal surfaces, refined borders, and signature vermilion regulatory accents.',
    swatches: ['#0D1117', '#161B22', '#283242', '#E43D12', '#F3F4F6'],
  },
];

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    try {
      const saved = localStorage.getItem('niyantran_theme');
      if (saved === THEMES.DARK || saved === 'dark' || saved === 'theme-obsidian') {
        return THEMES.DARK;
      }
      return THEMES.LIGHT;
    } catch {
      return THEMES.LIGHT;
    }
  });

  useEffect(() => {
    const root = document.documentElement;
    // Clean up all possible legacy and current theme classes
    root.classList.remove(
      THEMES.LIGHT,
      THEMES.DARK,
      'theme-experimental',
      'theme-obsidian',
      'theme-ivory',
      'light',
      'dark'
    );

    if (theme === THEMES.DARK) {
      root.classList.add(THEMES.DARK, 'dark');
      root.setAttribute('data-theme', 'dark');
    } else {
      root.classList.add(THEMES.LIGHT, 'light');
      root.setAttribute('data-theme', 'light');
    }

    try {
      localStorage.setItem('niyantran_theme', theme);
    } catch {
      // storage unavailable
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === THEMES.DARK ? THEMES.LIGHT : THEMES.DARK));
  };

  const currentTheme = THEME_METADATA.find((t) => t.id === theme) || THEME_METADATA[0];
  const resolvedTheme = theme === THEMES.DARK ? 'dark' : 'light';

  return (
    <ThemeContext.Provider
      value={{
        theme,
        resolvedTheme,
        setTheme,
        toggleTheme,
        THEMES,
        themes: THEME_METADATA,
        currentTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
