import { useTranslation } from 'react-i18next';

export function NotFoundPage() {
  const { t } = useTranslation();

  return (
    <section className="py-10">
      <h1 className="text-xl font-semibold">{t('common.notFound')}</h1>
    </section>
  );
}
