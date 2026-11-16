import type { Config } from 'tailwindcss';

const variableColor = (name: string) => `rgb(var(${name}) / <alpha-value>)`;
const fixedVariableColor = (name: string, alpha: number) =>
  `rgb(var(${name}) / ${alpha})`;

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Inter"', '"Segoe UI"', 'Tahoma', 'sans-serif'],
        display: ['"Manrope"', '"Inter"', '"Segoe UI"', 'sans-serif'],
        mono: ['"Consolas"', '"Courier New"', 'monospace'],
      },
      colors: {
        primary: {
          DEFAULT: variableColor('--color-primary'),
          foreground: variableColor('--color-primary-foreground'),
          accent: variableColor('--color-primary-accent'),
          soft: variableColor('--color-primary-soft'),
          strong: variableColor('--color-primary-strong'),
        },
        background: {
          DEFAULT: variableColor('--color-background-default'),
          subtle: variableColor('--color-background-subtle'),
          elevated: variableColor('--color-background-elevated'),
          inverse: variableColor('--color-background-inverse'),
          overlay: fixedVariableColor('--color-background-overlay', 0.72),
          ghost: fixedVariableColor('--color-background-ghost', 0.08),
        },
        surface: {
          DEFAULT: variableColor('--color-surface-default'),
          subtle: variableColor('--color-surface-subtle'),
          card: variableColor('--color-surface-card'),
          muted: variableColor('--color-surface-muted'),
        },
        text: {
          primary: variableColor('--color-text-primary'),
          secondary: variableColor('--color-text-secondary'),
          muted: variableColor('--color-text-muted'),
          accent: variableColor('--color-text-accent'),
          inverse: variableColor('--color-text-inverse'),
          'inverse-muted': fixedVariableColor('--color-text-inverse', 0.64),
          'inverse-soft': fixedVariableColor('--color-text-inverse', 0.84),
        },
        border: {
          soft: variableColor('--color-border-soft'),
          subtle: variableColor('--color-border-subtle'),
          accent: variableColor('--color-border-accent'),
          inverse: variableColor('--color-border-inverse'),
        },
        sun: {
          DEFAULT: variableColor('--color-sun'),
          soft: variableColor('--color-sun-soft'),
          strong: variableColor('--color-sun-strong'),
        },
        success: {
          DEFAULT: variableColor('--color-success'),
          bg: variableColor('--color-success-bg'),
        },
        warning: {
          DEFAULT: variableColor('--color-warning'),
          bg: variableColor('--color-warning-bg'),
        },
        danger: {
          DEFAULT: variableColor('--color-danger'),
          bg: variableColor('--color-danger-bg'),
        },
        info: {
          DEFAULT: variableColor('--color-info'),
          bg: variableColor('--color-info-bg'),
        },
        neutral: {
          DEFAULT: variableColor('--color-neutral'),
          bg: variableColor('--color-neutral-bg'),
        },
      },
      spacing: {
        1: '4px',
        2: '8px',
        3: '12px',
        4: '16px',
        5: '20px',
        6: '20px',
        7: '24px',
        8: '32px',
        10: '32px',
        12: '40px',
      },
      // One radius scale for the whole app (values live in tailwind.css :root):
      //   sm  – tiny chips, checkboxes, kbd tags (h-4 … h-6)
      //   md  – compact controls: icon buttons, calendar days, small buttons (h-7 … h-8)
      //   lg  – controls & inner tiles: buttons, inputs, selects, menu items, blocks inside cards
      //   xl  – containers: cards, panels, popovers, dropdowns, table wrappers
      //   2xl – overlays & heroes: dialogs, modals, login card, dashboard hero
      //   pill/full – badges, chips, avatars, switches, progress bars
      borderRadius: {
        DEFAULT: 'var(--radius-sm)',
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
        '2xl': 'var(--radius-2xl)',
        pill: '999px',
      },
      boxShadow: {
        sm: '0 0 0 1px rgba(25, 28, 30, 0.06)',
        md: '0 12px 32px -12px rgba(15, 40, 25, 0.16)',
        lg: '0 24px 48px -24px rgba(15, 40, 25, 0.28)',
        glow: '0 18px 40px -18px rgb(var(--color-primary) / 0.55)',
      },
      maxWidth: {
        page: '1600px',
        reading: '720px',
        sidebar: '280px',
      },
      width: {
        sidebar: '280px',
      },
      minHeight: {
        topbar: '82px',
      },
      backdropBlur: {
        shell: '20px',
      },
      transitionDuration: {
        fast: '140ms',
        base: '180ms',
      },
      backgroundImage: {
        'app-shell': 'none',
        'surface-card': 'none',
        'surface-muted': 'none',
      },
    },
  },
  plugins: [],
};

export default config;
