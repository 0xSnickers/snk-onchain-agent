import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { locales, type AppLocale } from '@/i18n/config';
import { useAppPreferences } from '@/providers/appPreferencesContext';
import { themes, type AppTheme } from '@/theme/config';

const themeKeys = Object.keys(themes) as AppTheme[];

function getNextValue<T extends string>(items: readonly T[], current: T) {
  const currentIndex = items.indexOf(current);
  return items[(currentIndex + 1) % items.length];
}

export function AppControls() {
  const { t } = useTranslation();
  const { locale, theme, changeLocale, changeTheme } = useAppPreferences();

  const nextLocale = getNextValue(locales, locale);
  const nextTheme = getNextValue(themeKeys, theme);

  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => changeLocale(nextLocale as AppLocale)}
      >
        {t('settings.language')}: {t('settings.localeName')}
      </Button>
      <Button type="button" variant="outline" size="sm" onClick={() => changeTheme(nextTheme)}>
        <span className="size-3 rounded-full bg-primary" aria-hidden="true" />
        {t('settings.theme')}: {t(`settings.themeNames.${theme}`)}
      </Button>
    </div>
  );
}
