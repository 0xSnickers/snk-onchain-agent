import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowUpRight, Eye, EyeOff, Radio, ListChecks, Wallet } from 'lucide-react';
import { LoadingState } from '@/components/feedback/LoadingState';
import { HoldingsSummary } from '../wallet/HoldingsSummary';
import { useHoldings } from '../wallet/useHoldings';
import { errorMessage } from '@/utils/format';

const jumps = [
  { to: '/wallet', label: 'onchain.wallet', icon: Wallet },
  { to: '/activity', label: 'agent.activity', icon: ListChecks },
  { to: '/market', label: 'onchain.market', icon: Radio },
];

export function PortfolioOverview() {
  const { t } = useTranslation();
  const [hidden, setHidden] = useState(false);
  const holdings = useHoldings();
  const data = holdings.data;
  return (
    <section className="desk" aria-label={t('design.dashboard')}>
      <div className="desk-bar">
        <span className="badge">{t('onchain.delegated')}</span>
        <span className="badge">{t('onchain.assetsSource')}</span>
        <button
          className="text-action"
          type="button"
          aria-label={t(hidden ? 'design.show' : 'design.hide')}
          onClick={() => setHidden((value) => !value)}
        >
          {hidden ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      </div>
      {holdings.isPending && <LoadingState />}
      {holdings.error && (
        <p role="alert" className="error-message">
          {errorMessage(holdings.error)}
        </p>
      )}
      {data && (
        <>
          <HoldingsSummary data={data} hidden={hidden} showAddress />
          {data.failures.length > 0 && (
            <p role="status" className="error-message">
              {t('onchain.assetsPartial')}
            </p>
          )}
          {data.assets.length === 0 && <p className="empty-small">{t('design.emptyAssets')}</p>}
        </>
      )}
      <nav className="desk-jumps" aria-label={t('design.continue')}>
        {jumps.map(({ to, label, icon: Icon }) => (
          <Link key={to} to={to}>
            <Icon size={16} />
            <span>{t(label)}</span>
            <ArrowUpRight size={14} />
          </Link>
        ))}
      </nav>
    </section>
  );
}
