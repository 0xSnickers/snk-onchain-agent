export const themes = {
  blue: {
    primary: '#45a6ff',
    secondary: '#192c49',
  },
  violet: {
    primary: '#b6a0ff',
    secondary: '#30264a',
  },
  emerald: {
    primary: '#65d8b1',
    secondary: '#18352d',
  },
} as const;

export type AppTheme = keyof typeof themes;

export const defaultTheme: AppTheme = 'blue';

const THEME_STORAGE_KEY = 'app.appearance.v2';

export function isAppTheme(theme: string): theme is AppTheme {
  return Object.keys(themes).includes(theme);
}

export function getCurrentTheme(): AppTheme {
  if (typeof window === 'undefined') {
    return defaultTheme;
  }

  const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
  return storedTheme && isAppTheme(storedTheme) ? storedTheme : defaultTheme;
}

export function setCurrentTheme(theme: AppTheme) {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }
}

export function applyTheme(theme: AppTheme) {
  if (typeof document === 'undefined') {
    return;
  }

  const colors = themes[theme];
  const root = document.documentElement;

  root.style.setProperty('--color-primary', colors.primary);
  root.style.setProperty('--color-ring', colors.primary);
  root.style.setProperty('--color-secondary', colors.secondary);
  root.dataset.theme = theme;
}
