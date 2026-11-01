import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Search, RefreshCw, ArrowUpRight } from 'lucide-react';
import type { MarketChain, MemeToken } from '@snk/contracts';
import { useMarket } from '@/hooks/useOnchain';
import { onchainApi } from '@/services/api/onchainApi';
import { errorMessage, tokenPercent, tokenUsd } from '@/utils/format';
import { LoadingState } from '@/components/feedback/LoadingState';
import { RemoteImage } from './RemoteImage';
import { ChainIcon } from './ChainIcon';
import { MarketChart } from './market/MarketChart';
import { AgentLaunchMarket } from './market/AgentLaunchMarket';
export function MarketPanel({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation();
  const [view, setView] = useState<'agent' | 'trending'>('agent');
  if (compact) return <StandardMarketPanel compact />;
  return (
    <div>
      <div className="chart-periods market-views" aria-label={t('market.marketView')}>
        <button aria-pressed={view === 'agent'} onClick={() => setView('agent')}>
          {t('market.agentTab')}
        </button>
        <button aria-pressed={view === 'trending'} onClick={() => setView('trending')}>
          {t('market.trendingTab')}
        </button>
      </div>
      {view === 'agent' ? <AgentLaunchMarket /> : <StandardMarketPanel />}
    </div>
  );
}
function StandardMarketPanel({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation();
  const [input, setInput] = useState('');
  const [query, setQuery] = useState('');
  const [chain, setChain] = useState<MarketChain>('bsc');
  const [selected, setSelected] = useState('');
  const trending = useQuery({
    queryKey: ['market', 'tokens', chain],
    queryFn: () => onchainApi.tokens(chain),
    enabled: !query,
    retry: false,
    staleTime: 60000,
  });
  const search = useMarket(query, chain, Boolean(query));
  const market = query ? search : trending;
  const tokens: MemeToken[] = query
    ? (search.data?.pairs || []).map((p) => ({
        chain: p.chainId as MarketChain,
        address: p.tokenAddress,
        symbol: p.symbol,
        name: p.name,
        imageUrl: p.imageUrl,
        priceUsd: p.priceUsd,
        changePercent: p.change24h,
        volumeUsd: p.volume24h,
        liquidityUsd: p.liquidityUsd,
        marketCapUsd: null,
        holders: null,
        platform: p.dex,
        url: p.url,
      }))
    : trending.data?.tokens || [];
  const unique = tokens.filter(
    (p, i, list) => list.findIndex((t) => t.address === p.address) === i,
  );
  const active = unique.find((p) => p.address === selected) || unique[0];
  return (
    <div className={`meme-market-workspace ${compact ? 'is-compact' : 'is-terminal'}`}>
      {!compact && <MarketChart key={`${chain}:${active?.address || ''}`} token={active} />}
      <section className="panel market-panel">
        <div className="section-heading">
          <h2>{t('market.tokens')}</h2>
          <span className="source-label">
            {query ? 'DEX' : 'GMGN'} · {query ? '24h' : '1h'}
          </span>
          <button
            className="icon-button"
            aria-label={t('onchain.refresh')}
            disabled={market.isFetching}
            onClick={() => market.refetch()}
          >
            <RefreshCw size={15} />
          </button>
        </div>
        <form
          className="search-form"
          onSubmit={(e) => {
            e.preventDefault();
            setSelected('');
            if (input.trim() === query) void market.refetch();
            else setQuery(input.trim());
          }}
        >
          <label className="search-input">
            <Search size={15} />
            <input
              aria-label={t('onchain.search')}
              placeholder={t('market.searchShort')}
              value={input}
              maxLength={80}
              onChange={(e) => setInput(e.target.value)}
            />
          </label>
          <div className="chain-select">
            <ChainIcon chain={chain} />{' '}
            <select
              aria-label={t('onchain.chain')}
              value={chain}
              onChange={(e) => {
                setChain(e.target.value as MarketChain);
                setSelected('');
              }}
            >
              <option value="bsc">BNB Chain</option>
              <option value="solana">Solana</option>
            </select>
          </div>
          <button className="icon-button" type="submit" aria-label={t('onchain.searchAction')}>
            <Search size={15} />
          </button>
        </form>
        {query && (
          <button
            className="quiet-link small"
            onClick={() => {
              setInput('');
              setQuery('');
              setSelected('');
            }}
          >
            {t('market.backTrending')}
          </button>
        )}
        {market.isPending && <LoadingState />}
        {market.error && (
          <p className="error-message" role="alert">
            {errorMessage(market.error)}
          </p>
        )}
        {!!market.data && (
          <div className="market-token-list">
            {unique.slice(0, compact ? 5 : 20).map((p) => (
              <div
                className={`market-token-row ${active?.address === p.address ? 'is-selected' : ''}`}
                key={`${p.chain}:${p.address}`}
              >
                <button
                  className="token-select"
                  aria-label={`${t('market.viewChart')} ${p.symbol}`}
                  aria-pressed={active?.address === p.address}
                  onClick={() => setSelected(p.address)}
                >
                  <RemoteImage src={p.imageUrl} label={p.symbol} size={24} />
                  <span className="token-identity">
                    <strong>{p.symbol}</strong>
                  </span>
                  <span className="token-numbers">
                    <strong className="mono" title={p.priceUsd ?? undefined}>
                      {tokenUsd(p.priceUsd)}
                    </strong>
                    <small
                      className={
                        p.changePercent === null
                          ? 'muted'
                          : p.changePercent >= 0
                            ? 'positive-text'
                            : 'negative-text'
                      }
                    >
                      {tokenPercent(p.changePercent, true)}
                    </small>
                  </span>
                </button>
              </div>
            ))}
            {!unique.length && <p className="empty-small">{t('onchain.marketEmpty')}</p>}
          </div>
        )}
        <div className="market-footnote">
          <span>{query ? 'DEX Screener' : 'GMGN'}</span>
          {market.data && <time>{new Date(market.data.fetchedAt).toLocaleTimeString()}</time>}
          <details>
            <summary>{t('market.aboutData')}</summary>
            <p>{query ? t('onchain.marketHint') : t('market.rankingHint')}</p>
          </details>
        </div>
        {compact && (
          <Link className="quiet-link" to="/market">
            {t('market.openMarket')} <ArrowUpRight size={13} />
          </Link>
        )}
      </section>
    </div>
  );
}
