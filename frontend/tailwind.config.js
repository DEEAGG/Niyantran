/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: 'var(--background)',
        surface: {
          DEFAULT: 'var(--surface)',
          elevated: 'var(--surface-elevated)',
          hover: 'var(--surface-hover)',
          secondary: 'var(--surface-secondary)',
        },
        border: {
          DEFAULT: 'var(--border)',
          strong: 'var(--border-strong)',
          subtle: 'var(--border-subtle)',
          focus: 'var(--focus-ring)',
        },
        text: {
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          muted: 'var(--text-muted)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          hover: 'var(--accent-hover)',
          foreground: 'var(--accent-foreground)',
          primary: 'var(--accent)',
          'primary-hover': 'var(--accent-hover)',
          secondary: 'var(--accent-secondary)',
          glow: 'var(--accent-glow)',
        },
        input: {
          background: 'var(--input-background)',
          text: 'var(--input-text)',
        },
        popover: {
          background: 'var(--popover-background)',
          text: 'var(--popover-text)',
        },
        status: {
          success: 'var(--status-success)',
          warning: 'var(--status-warning)',
          error: 'var(--status-error)',
        },
        brand: {
          DEFAULT: '#E43D12',
          vermilion: '#E43D12',
          'vermilion-hover': '#CC340E',
          'vermilion-surface': '#FDF1EE',
          pink: '#D6536D',
          'pink-hover': '#C0435D',
          'pink-surface': '#FCF1F3',
          yellow: '#EFB112',
          'yellow-hover': '#D99F0C',
          'yellow-surface': '#FEF9EB',
        },
        // Backward-compatibility aliases
        app: {
          bg: 'var(--background)',
          surface: 'var(--surface)',
          elevated: 'var(--surface-elevated)',
          secondary: 'var(--surface-secondary)',
          border: 'var(--border)',
          'border-subtle': 'var(--border-subtle)',
          'border-focus': 'var(--focus-ring)',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
      },
      boxShadow: {
        'subtle': '0 1px 3px 0 rgba(0, 0, 0, 0.5), 0 1px 2px 0 rgba(0, 0, 0, 0.4)',
        'surface': '0 4px 6px -1px rgba(0, 0, 0, 0.5), 0 2px 4px -1px rgba(0, 0, 0, 0.35)',
        'elevated': '0 10px 15px -3px rgba(0, 0, 0, 0.7), 0 4px 6px -2px rgba(0, 0, 0, 0.5)',
        'glow-primary': '0 0 15px -3px rgba(121, 169, 209, 0.35)',
      }
    },
  },
  plugins: [],
}
