import { createContext, useContext } from 'react';
import type { AppLocale } from '@/i18n/config';
import type { AppTheme } from '@/theme/config';

export interface AppPreferencesContextValue {
  locale: AppLocale;
  theme: AppTheme;
  changeLocale: (locale: AppLocale) => void;
  changeTheme: (theme: AppTheme) => void;
}

export const AppPreferencesContext = createContext<AppPreferencesContextValue | null>(null);

export function useAppPreferences() {
  const context = useContext(AppPreferencesContext);

  if (!context) {
    throw new Error('useAppPreferences must be used within AppPreferencesProvider');
  }

  return context;
}
