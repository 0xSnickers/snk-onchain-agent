import { useQuery } from '@tanstack/react-query';
import { LoadingState } from '@/components/feedback/LoadingState';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowUpRight, Database, Globe, Server, Users } from 'lucide-react';
import { onchainApi } from '@/services/api/onchainApi';
import { onchainKeys } from '@/hooks/useOnchain';
import { errorMessage } from '@/utils/format';
export function ConnectionsPanel() {
  const { t } = useTranslation();
  const health = useQuery({
    queryKey: onchainKeys.health,
    queryFn: onchainApi.health,
    retry: false,
  });
  const kols = useQuery({ queryKey: onchainKeys.kols, queryFn: onchainApi.kols, retry: false });
  if (health.isPending || kols.isPending) return <LoadingState variant="page" />;
  const items = [
    {
      key: 'api',
      icon: Server,
      desc: 'apiDescription',
      status: health.data ? 'connected' : health.isPending ? 'checking' : 'unavailable',
    },
    {
      key: 'db',
      icon: Database,
      desc: 'dbDescription',
      status: health.data ? 'connected' : health.isPending ? 'checking' : 'unavailable',
    },
    { key: 'dex', icon: Globe, desc: 'dexDescription', status: 'planned' },
    {
      key: 'x',
      icon: Users,
      desc: 'xDescription',
      status: kols.isPending
        ? 'checking'
        : kols.isError
          ? 'unavailable'
          : kols.data?.x.configured
            ? 'xConfigured'
            : 'xMissing',
    },
  ];
  return (
    <>
      <section className="connections-grid">
        {items.map(({ key, icon: Icon, desc, status }) => (
          <article key={key} className="panel">
            <Icon size={22} />
            <h2>{t(`onchain.${key}`)}</h2>
            <p className="muted">{t(`onchain.${desc}`)}</p>
            <span className={`badge ${status === 'connected' ? 'positive' : ''}`}>
              {key === 'dex' ? 'PUBLIC API' : t(`onchain.${status}`)}
            </span>
            <ArrowUpRight className="connection-arrow" size={17} />
            {key === 'x' && (
              <Link className="quiet-link" to="/kols">
                {t('social.openMonitor')} ↗
              </Link>
            )}
          </article>
        ))}
      </section>
      {health.error && (
        <p role="alert" className="error-message">
          {errorMessage(health.error)}
        </p>
      )}
      {kols.error && (
        <p role="alert" className="error-message">
          {errorMessage(kols.error)}
        </p>
      )}
    </>
  );
}
