import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { I18nextProvider } from 'react-i18next';
import {
  defaultLocale,
  applyLocale,
  getCurrentLocale,
  setCurrentLocale,
  type AppLocale,
} from '@/i18n/config';
import { i18n } from '@/i18n';
import {
  applyTheme,
  defaultTheme,
  getCurrentTheme,
  setCurrentTheme,
  type AppTheme,
} from '@/theme/config';
import { AppPreferencesContext, type AppPreferencesContextValue } from './appPreferencesContext';

export function AppPreferencesProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<AppLocale>(defaultLocale);
  const [theme, setTheme] = useState<AppTheme>(defaultTheme);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const currentLocale = getCurrentLocale();
      setLocale(currentLocale);
      i18n.changeLanguage(currentLocale);
      setTheme(getCurrentTheme());
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    applyLocale(locale);
  }, [locale]);

  const value = useMemo<AppPreferencesContextValue>(
    () => ({
      locale,
      theme,
      changeLocale: (nextLocale) => {
        setCurrentLocale(nextLocale);
        setLocale(nextLocale);
        i18n.changeLanguage(nextLocale);
      },
      changeTheme: (nextTheme) => {
        setCurrentTheme(nextTheme);
        setTheme(nextTheme);
      },
    }),
    [locale, theme],
  );

  return (
    <AppPreferencesContext.Provider value={value}>
      <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
    </AppPreferencesContext.Provider>
  );
}
