import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { RefreshCw, ExternalLink } from 'lucide-react';
import type { LaunchStage } from '@snk/contracts';
import { onchainApi } from '@/services/api/onchainApi';
import { errorMessage, tokenPercent, tokenUsd } from '@/utils/format';
import { shortAddress, tokenLabel } from '@/utils/tokenLabel';
import { LoadingState } from '@/components/feedback/LoadingState';
import { RemoteImage } from '../RemoteImage';
import { ChainIcon } from '../ChainIcon';
import { MarketChart } from './MarketChart';
const stages: LaunchStage[] = ['NEW', 'FINALIZING', 'MIGRATED'];
function displayTitle(token: { symbol: string; name: string; address: string }) {
  return tokenLabel(token.symbol) || tokenLabel(token.name) || shortAddress(token.address);
}
export function AgentLaunchMarket() {
  const { t } = useTranslation();
  const [selected, setSelected] = useState('');
  const market = useQuery({
    queryKey: ['market', 'agent-launches', 'bsc'],
    queryFn: onchainApi.agentLaunches,
    staleTime: 30000,
    refetchInterval: 60000,
    retry: false,
  });
  const tokens = market.data?.tokens || [];
  const active = tokens.find((token) => token.address === selected) || tokens[0];
  return (
    <div className="agent-launch-market">
      <section className="panel">
        <div className="section-heading">
          <h2>
            <ChainIcon chain="bsc" /> {t('market.agentTitle')}
          </h2>
          <button
            className="icon-button"
            aria-label={t('onchain.refresh')}
            disabled={market.isFetching}
            onClick={() => market.refetch()}
          >
            <RefreshCw size={15} />
          </button>
        </div>
        {market.isPending && <LoadingState />}
        {market.error && (
          <p className="error-message" role="alert">
            {errorMessage(market.error)}
            {market.data && ` · ${t('market.staleChart')}`}
            <button className="quiet-link" onClick={() => market.refetch()}>
              {t('market.retry')}
            </button>
          </p>
        )}
        {market.data && (
          <>
            <div className="launch-sources">
              {market.data.sources.map((source) => (
                <span
                  key={source.source}
                  className={source.status === 'ERROR' ? 'error-message' : 'muted'}
                  role={source.status === 'ERROR' ? 'status' : undefined}
                >
                  {t(`market.source_${source.source}`)} ·{' '}
                  {source.status === 'ERROR'
                    ? `${t('market.sourceFailed')} (${source.error?.code})`
                    : `${source.count}`}
                </span>
              ))}
            </div>
            <div className="launch-columns">
              {stages.map((stage) => {
                const items = tokens.filter((token) => token.stage === stage);
                return (
                  <section
                    className="launch-column"
                    key={stage}
                    aria-label={t(`market.stage_${stage}`)}
                  >
                    <h3>
                      {t(`market.stage_${stage}`)} <span className="muted">{items.length}</span>
                    </h3>
                    <div className="launch-token-list">
                      {items.map((token) => {
                        const title = displayTitle(token);
                        return (
                          <button
                            key={token.address}
                            className={`launch-token ${active?.address === token.address ? 'is-selected' : ''}`}
                            aria-pressed={active?.address === token.address}
                            onClick={() => setSelected(token.address)}
                          >
                            <RemoteImage src={token.imageUrl} label={title} size={28} />
                            <span className="token-identity">
                              <strong>{title}</strong>
                              <small>{token.platform}</small>
                            </span>
                            <span className="token-numbers">
                              <strong>{tokenUsd(token.priceUsd)}</strong>
                              <small>{tokenPercent(token.progress)}</small>
                            </span>
                          </button>
                        );
                      })}
                      {!items.length && <p className="empty-small">{t('market.launchEmpty')}</p>}
                    </div>
                  </section>
                );
              })}
            </div>
            {active && (
              <div className="launch-focus">
                <div className="launch-focus-meta">
                  <strong>{displayTitle(active)}</strong>
                  <span>{active.platform}</span>
                  <span>{tokenUsd(active.priceUsd)}</span>
                  {!active.tokenDeployed && (
                    <span className="badge">{t('market.notDeployed')}</span>
                  )}
                  <code className="full-address">{active.address}</code>
                  <a className="quiet-link" href={active.url} target="_blank" rel="noreferrer">
                    <ExternalLink size={12} /> BscScan
                  </a>
                </div>
                {active.stage === 'MIGRATED' && active.tokenDeployed && (
                  <MarketChart key={active.address} embedded token={active} />
                )}
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
