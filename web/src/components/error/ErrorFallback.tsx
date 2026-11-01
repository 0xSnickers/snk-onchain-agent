import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';

export function ErrorFallback({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation();

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-start justify-center gap-4 px-4">
      <div>
        <h1 className="text-xl font-semibold">{t('error.title')}</h1>
        <p className="mt-2 text-sm text-slate-600">{t('error.description')}</p>
      </div>
      <Button onClick={onRetry}>{t('common.retry')}</Button>
    </main>
  );
}
