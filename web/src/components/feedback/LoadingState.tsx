import { useTranslation } from 'react-i18next';
import { LoaderCircle } from 'lucide-react';
export function LoadingState({ variant = 'section' }: { variant?: 'page' | 'section' | 'chart' }) {
  const { t } = useTranslation();
  return (
    <div className={`loading-state loading-${variant}`} role="status" aria-live="polite">
      <span className="loading-caption">
        <LoaderCircle size={14} className="spin" />
        {t('onchain.loading')}
      </span>
      <div className="loading-skeleton" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <div className="loading-row" key={i}>
            <i />
            <span />
            <b />
          </div>
        ))}
      </div>
    </div>
  );
}
