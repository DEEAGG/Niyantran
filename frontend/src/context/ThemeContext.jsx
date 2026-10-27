import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext(null);

export const THEMES = {
  EXPERIMENTAL: 'theme-experimental', // Premium Dark Neutral: #0D1117, #1C232B, #28323D, #34404C, #83B8E0
  OBSIDIAN: 'theme-obsidian',         // Obsidian Command: #090D14, #131A26, #1B2434, #3E4F69, #5B8CFF
};

export const THEME_METADATA = [
  {
    id: THEMES.EXPERIMENTAL,
    name: 'Premium Dark Neutral (Default)',
    description: 'Sophisticated dark palette: #0D1117 canvas, #1C232B primary surface, #28323D elevated surface, #34404C structural borders, #83B8E0 sky accent, and vibrant regulatory status colors (#22C55E, #FACC15, #F97316, #EF4444).',
    swatches: ['#0D1117', '#1C232B', '#28323D', '#34404C', '#83B8E0'],
  },
  {
    id: THEMES.OBSIDIAN,
    name: 'Obsidian Command',
    description: 'High-contrast dark preset: #090D14 canvas, #131A26 surfaces, #3E4F69 structural borders, and #5B8CFF neon blue accent.',
    swatches: ['#090D14', '#131A26', '#1B2434', '#3E4F69', '#5B8CFF'],
  },
];

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('niyantran_theme');
    if (saved === THEMES.OBSIDIAN) return THEMES.OBSIDIAN;
    return THEMES.EXPERIMENTAL;
  });

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove(THEMES.EXPERIMENTAL, THEMES.OBSIDIAN);
    root.classList.add(theme);
    root.setAttribute('data-theme', theme);
    localStorage.setItem('niyantran_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) =>
      prev === THEMES.EXPERIMENTAL ? THEMES.OBSIDIAN : THEMES.EXPERIMENTAL
    );
  };

  const currentTheme = THEME_METADATA.find((t) => t.id === theme) || THEME_METADATA[0];
  const resolvedTheme = theme === THEMES.OBSIDIAN ? 'dark' : 'light';

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme, toggleTheme, THEMES, themes: THEME_METADATA, currentTheme }}>
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
