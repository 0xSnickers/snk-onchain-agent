import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Crosshair, RefreshCw } from 'lucide-react';
import { sniperApi } from '@/services/api/sniperApi';
import { errorMessage, tokenPercent } from '@/utils/format';
import { shortAddress, tokenLabel } from '@/utils/tokenLabel';
import { LoadingState } from '@/components/feedback/LoadingState';
import { SniperControls } from './SniperControls';
import { SniperDetail } from './SniperDetail';

export function SniperPanel() {
  const { t } = useTranslation();
  const [selected, setSelected] = useState('');
  const board = useQuery({
    queryKey: ['sniper', 'board'],
    queryFn: sniperApi.board,
    retry: false,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
  const targets = board.data?.targets ?? [];
  const active = targets.find((target) => target.id === selected) ?? targets[0];
  return (
    <div className="sniper-page">
      <section className="panel">
        <div className="section-heading">
          <h2>
            <Crosshair size={16} /> {t('onchain.sniper')}
          </h2>
          <button
            className="icon-button"
            type="button"
            aria-label={t('onchain.refresh')}
            disabled={board.isFetching}
            onClick={() => board.refetch()}
          >
            <RefreshCw size={15} />
          </button>
        </div>
        {board.isPending && <LoadingState />}
        {board.error && !board.data && (
          <p className="error-message" role="alert">
            {errorMessage(board.error)}{' '}
            <button className="quiet-link" type="button" onClick={() => board.refetch()}>
              {t('common.retry')}
            </button>
          </p>
        )}
        {board.data?.refreshError && (
          <p className="error-message" role="alert">
            {t('sniper.refreshError')} ({board.data.refreshError.code})
          </p>
        )}
        {board.data && (
          <details>
            <summary>{t('sniper.rules')}</summary>
            <p className="muted">{t('sniper.lead')}</p>
            <p className="muted small">{t('sniper.coverage')}</p>
            <div className="launch-sources">
              {board.data.sources.map((source) => (
                <span
                  key={source.stage}
                  className={source.status === 'ERROR' ? 'error-message' : 'muted'}
                >
                  {source.stage} ·{' '}
                  {source.status === 'ERROR'
                    ? `${t('sniper.sourceFailed')} (${source.error?.code})`
                    : source.count}
                </span>
              ))}
              <span className="muted mono full-address">
                {t('sniper.registry')} {board.data.registry}
              </span>
            </div>
          </details>
        )}
      </section>
      {board.data && (
        <>
          <SniperControls
            key={JSON.stringify(board.data.controls)}
            controls={board.data.controls}
          />
          <div className="sniper-workspace">
            <section className="panel" aria-label={t('onchain.sniper')}>
              {targets.length === 0 && <p className="muted">{t('sniper.empty')}</p>}
              <div className="sniper-list launch-token-list">
                {targets.map((target) => {
                  const title =
                    tokenLabel(target.symbol) ||
                    tokenLabel(target.name) ||
                    shortAddress(target.contractAddress);
                  return (
                    <button
                      key={target.id}
                      type="button"
                      className={`launch-token ${active?.id === target.id ? 'is-selected' : ''}`}
                      aria-pressed={active?.id === target.id}
                      onClick={() => setSelected(target.id)}
                    >
                      <span className="token-identity">
                        <strong>{title}</strong>
                        <small>{t(`sniper.status.${target.status}`)}</small>
                      </span>
                      <span className="token-numbers">
                        <strong>{tokenPercent(target.progress)}</strong>
                        <small>{target.agentWallets ?? '—'}</small>
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
            <SniperDetail
              key={active?.id ?? 'none'}
              target={active}
              armed={board.data.controls.armed}
            />
          </div>
        </>
      )}
    </div>
  );
}
