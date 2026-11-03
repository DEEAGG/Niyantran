/**
 * NIYANTRAN — Centralized Design System Tokens
 * Supporting clean switching between Light & Dark modes
 */

export const themes = {
  light: {
    name: 'Light',
    id: 'theme-light',
    bg: '#F8F7F4',
    surface: '#FFFFFF',
    elevated: '#FFFFFF',
    secondary: '#EFEBE4',
    border: '#E2DFD7',
    textPrimary: '#0F172A',
    textSecondary: '#334155',
    textMuted: '#64748B',
    accentPrimary: '#E43D12',
    accentSecondary: '#C5300B',
  },
  dark: {
    name: 'Dark',
    id: 'theme-dark',
    bg: '#0B0F17',
    surface: '#111827',
    elevated: '#1F2937',
    secondary: '#162032',
    border: '#1E293B',
    textPrimary: '#F8FAFC',
    textSecondary: '#CBD5E1',
    textMuted: '#94A3B8',
    accentPrimary: '#E43D12',
    accentSecondary: '#FF5E36',
  }
};

export const typography = {
  fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  fontMono: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
};

export default {
  themes,
  typography,
};
