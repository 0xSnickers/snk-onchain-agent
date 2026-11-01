import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { RefreshCw, ExternalLink } from 'lucide-react';
import type { CandleResolution, MemeToken } from '@snk/contracts';
import { onchainApi } from '@/services/api/onchainApi';
import { errorMessage, tokenUsd } from '@/utils/format';
import { LoadingState } from '@/components/feedback/LoadingState';
import { ChainIcon } from '../ChainIcon';
import { CandlestickChart } from './CandlestickChart';
type ChartToken = Pick<MemeToken, 'chain' | 'address' | 'symbol' | 'volumeUsd' | 'liquidityUsd' | 'url'>;
export function MarketChart<T extends ChartToken>({
  token,
  embedded = false,
}: {
  token?: T;
  embedded?: boolean;
}) {
  const { t } = useTranslation();
  const [resolution, setResolution] = useState<CandleResolution>('15m');
  const kline = useQuery({
    queryKey: ['market', 'kline', token?.chain, token?.address, resolution],
    queryFn: () => onchainApi.kline(token!.chain, token!.address, resolution),
    enabled: !!token,
    retry: false,
    staleTime: 30000,
  });
  // Never show stale candles for a different chain, address or interval.
  const result = kline.data;
  const matches =
    result &&
    token &&
    result.chain === token.chain &&
    result.address === token.address &&
    result.resolution === resolution;
  return (
    <section
      className={embedded ? 'launch-chart' : 'panel market-chart'}
      aria-label={t('market.kline')}
    >
      {!embedded && (
        <div className="section-heading">
          <div>
            <h2>
              {token && <ChainIcon chain={token.chain} />} {token?.symbol || t('market.kline')}{' '}
              <span className="muted small">
                {token?.chain === 'solana' ? 'SOL' : token ? 'BNB Chain' : ''}
              </span>
            </h2>
          </div>
          <button
            className="icon-button"
            aria-label={t('onchain.refresh')}
            disabled={!token || kline.isFetching}
            onClick={() => kline.refetch()}
          >
            <RefreshCw size={15} />
          </button>
        </div>
      )}
      {!embedded && token && (
        <details className="chart-contract">
          <summary>{t('market.tokenInfo')}</summary>
          <code className="full-address">{token.address}</code>
          <p>
            {t('market.volume')} {tokenUsd(token.volumeUsd)} · {t('onchain.liquidity')}{' '}
            {tokenUsd(token.liquidityUsd)}
          </p>
          <a href={token.url} target="_blank" rel="noreferrer" className="quiet-link">
            <ExternalLink size={12} /> {token.symbol}
          </a>
        </details>
      )}
      <div className="chart-periods" aria-label={t('market.resolution')}>
        {(['1m', '5m', '15m', '1h', '4h', '1d'] as const).map((r) => (
          <button key={r} aria-pressed={r === resolution} onClick={() => setResolution(r)}>
            {r}
          </button>
        ))}
      </div>
      {!token && <div className="chart-placeholder">{t('market.selectToken')}</div>}
      {token && kline.isPending && <LoadingState variant="chart" />}
      {kline.error &&
        (matches && result.candles.length ? (
          <p className="chart-warning" role="status" title={errorMessage(kline.error)}>
            {t('market.staleChart')}{' '}
            <button className="quiet-link" onClick={() => kline.refetch()}>
              {t('market.retry')}
            </button>
          </p>
        ) : (
          <div className="chart-placeholder">
            <p role="alert" title={errorMessage(kline.error)}>
              {t('market.unavailable')}
            </p>
            <button className="quiet-link" onClick={() => kline.refetch()}>
              {t('market.retry')}
            </button>
          </div>
        ))}
      {matches &&
        (result.candles.length ? (
          <CandlestickChart candles={result.candles} />
        ) : (
          <div className="chart-placeholder">{t('market.noCandles')}</div>
        ))}
      {!embedded && (
        <p className="data-caption">
          GMGN · USD · UTC {matches && `· ${new Date(result.fetchedAt).toLocaleTimeString()}`}
        </p>
      )}
    </section>
  );
}
