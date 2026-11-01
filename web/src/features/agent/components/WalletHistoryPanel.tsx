import { LoadingState } from '@/components/feedback/LoadingState';
import { useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { agentApi } from '@/services/api/agentApi';
import { agentKeys, assertScope } from '../hooks/useAgent';
import { PreciseAmount } from '@/components/feature/PreciseAmount';
import { tokenUnits } from '@/utils/tokenUnits';
import { errorMessage } from '@/utils/format';
import type { WalletIdentity } from '@snk/contracts';
const explorers: Record<string, string> = {
  '56': 'https://bscscan.com/tx/',
  '1': 'https://etherscan.io/tx/',
  '8453': 'https://basescan.org/tx/',
  '42161': 'https://arbiscan.io/tx/',
  '137': 'https://polygonscan.com/tx/',
  CT_501: 'https://solscan.io/tx/',
};
export function WalletHistoryPanel({
  wallet,
  onRun,
}: {
  wallet: WalletIdentity;
  onRun: (id: string) => void;
}) {
  const { t } = useTranslation();
  const [type, setType] = useState('ALL');
  const history = useInfiniteQuery({
    queryKey: agentKeys.activity(wallet.scope, type),
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) =>
      assertScope(await agentApi.activity(type, pageParam, wallet.scope), wallet.scope),
    getNextPageParam: (p) => p.nextCursor || undefined,
    retry: false,
    staleTime: 30000,
  });
  const rows = history.data?.pages.flatMap((p) => p.items) || [];
  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <span className="eyebrow">GROK BOT / IMPORTED LEDGER</span>
          <h2>{t('agent.walletHistory')}</h2>
        </div>
      </div>
      <div className="agent-tabs" role="group" aria-label={t('agent.kind')}>
        {['ALL', 'TRADE', 'MINT', 'TRANSFER', 'CONTRACT'].map((v) => (
          <button key={v} className={type === v ? 'selected' : ''} onClick={() => setType(v)}>
            {v === 'ALL' ? t('agent.all') : t(`agent.${v}`)}
          </button>
        ))}
      </div>
      {history.error && (
        <p className="error-message" role="alert">
          {errorMessage(history.error)}
        </p>
      )}
      {history.isPending && <LoadingState />}
      {!history.isPending && !history.isError && rows.length === 0 && (
        <p className="empty-small">{t('agent.noTransactions')}</p>
      )}
      {!history.isError && rows.length > 0 && (
        <div className="item-grid">
          {rows.map((row) => (
            <article className="activity-card" key={row.id}>
              <div className="activity-meta">
                <strong>{t(`agent.${row.type}`)}</strong>
                <span className="badge">{row.chainId}</span>
                <span className="badge">{row.status}</span>
                <time>
                  {row.txTime ? new Date(row.txTime).toLocaleString() : t('agent.unknown')}
                </time>
              </div>
              <div className="activity-hash">
                <span className="muted small">{t('agent.txHash')}</span>
                {explorers[row.chainId] ? (
                  <a
                    href={explorers[row.chainId] + encodeURIComponent(row.txHash)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <code>{row.txHash}</code> ↗
                  </a>
                ) : (
                  <code>{row.txHash}</code>
                )}
              </div>
              <details>
                <summary>
                  {t('agent.details')} · {row.providerType}
                </summary>
                {row.movements.length === 0 ? (
                  <p className="muted">{t('agent.noMovements')}</p>
                ) : (
                  row.movements.map((m, i) => (
                    <div key={i} className="movement-row">
                      <span>
                        {t(`agent.${m.direction}`)}{' '}
                        {m.amount != null ? (
                          <PreciseAmount value={m.amount} />
                        ) : (
                          `${m.rawAmount ?? '—'} (raw)`
                        )}{' '}
                        <strong>{m.symbol || t('agent.unknown')}</strong>
                      </span>
                      <code className="full-address">{m.tokenAddress || t('agent.unknown')}</code>
                      {m.counterparty && <code className="full-address">{m.counterparty}</code>}
                    </div>
                  ))
                )}
                <p className="muted small">
                  {t('agent.networkFee')}:{' '}
                  {tokenUnits(row.networkFee.rawAmount, row.networkFee.decimals) != null ? (
                    <PreciseAmount
                      value={tokenUnits(row.networkFee.rawAmount, row.networkFee.decimals)}
                    />
                  ) : (
                    `${row.networkFee.rawAmount ?? '—'} (raw)`
                  )}{' '}
                  {row.networkFee.symbol}
                </p>
                {row.networkFee.tokenAddress && (
                  <code className="full-address">{row.networkFee.tokenAddress}</code>
                )}
              </details>
              <p className="data-caption">
                {row.source} · {t('agent.synced')} {new Date(row.fetchedAt).toLocaleString()}
              </p>
              {row.runIds.map((id) => (
                <button className="more-link" key={id} onClick={() => onRun(id)}>
                  {t('agent.relatedRun')} →
                </button>
              ))}
            </article>
          ))}
        </div>
      )}
      <div className="agent-toolbar">
        {history.hasNextPage && (
          <Button
            variant="outline"
            disabled={history.isFetchingNextPage}
            onClick={() => history.fetchNextPage()}
          >
            {t('agent.loadMore')}
          </Button>
        )}
      </div>
    </section>
  );
}
