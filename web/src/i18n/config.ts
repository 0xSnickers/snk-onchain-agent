export const locales = ['zh-CN', 'en-US'] as const;

export type AppLocale = (typeof locales)[number];

export const defaultLocale: AppLocale = 'zh-CN';

const LOCALE_STORAGE_KEY = 'app.locale';

export function isAppLocale(locale: string): locale is AppLocale {
  return locales.includes(locale as AppLocale);
}

export function getCurrentLocale(): AppLocale {
  if (typeof window === 'undefined') {
    return defaultLocale;
  }

  const storedLocale = window.localStorage.getItem(LOCALE_STORAGE_KEY);

  if (storedLocale && isAppLocale(storedLocale)) {
    return storedLocale;
  }

  return isAppLocale(window.navigator.language) ? window.navigator.language : defaultLocale;
}

export function setCurrentLocale(locale: AppLocale) {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  }
}

export function applyLocale(locale: AppLocale) {
  if (typeof document !== 'undefined') {
    document.documentElement.lang = locale;
  }
}
