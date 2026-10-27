/**
 * NIYANTRAN — Centralized Design System Tokens
 * Supporting dynamic switching between Earth Modern (Experimental) & Obsidian Command (Original)
 */

export const themes = {
  experimental: {
    name: 'Earth Graphite & Sky (Experimental)',
    id: 'theme-experimental',
    bg: '#020300',
    surface: '#151411',
    elevated: '#2E2C26',
    secondary: '#3D3930',
    border: '#38342C',
    textPrimary: '#F4F6F8',
    textSecondary: '#A9B7C6',
    textMuted: '#7D8CA3',
    accentPrimary: '#79A9D1',
    accentSecondary: '#7D8CA3',
  },
  obsidian: {
    name: 'Obsidian Command (Original)',
    id: 'theme-obsidian',
    bg: '#090D14',
    surface: '#111722',
    elevated: '#182130',
    secondary: '#1F2B3E',
    border: '#273244',
    textPrimary: '#F1F5F9',
    textSecondary: '#94A3B8',
    textMuted: '#64748B',
    accentPrimary: '#5B8CFF',
    accentSecondary: '#42C6B7',
  }
};

export const typography = {
  fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
  fontMono: 'JetBrains Mono, monospace',
};

export default {
  themes,
  typography,
};
