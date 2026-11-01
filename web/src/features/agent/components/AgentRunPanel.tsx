import { LoadingState } from '@/components/feedback/LoadingState';
import { useInfiniteQuery, useMutation, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { agentApi } from '@/services/api/agentApi';
import { agentKeys, assertScope, useRefreshAgent } from '../hooks/useAgent';
import { errorMessage } from '@/utils/format';
import { RunDetail } from './RunDetail';
import type { WalletIdentity } from '@snk/contracts';
export function AgentRunPanel({
  wallet,
  selected,
  onSelect,
}: {
  wallet: WalletIdentity;
  selected: string;
  onSelect: (id: string) => void;
}) {
  const { t } = useTranslation();
  const refresh = useRefreshAgent();
  const runs = useInfiniteQuery({
    queryKey: agentKeys.runs(wallet.scope),
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) =>
      assertScope(await agentApi.runs(pageParam, wallet.scope), wallet.scope),
    getNextPageParam: (p) => p.nextCursor || undefined,
    refetchInterval: 10000,
    retry: false,
  });
  const notifications = useQuery({
    queryKey: agentKeys.notifications(wallet.scope),
    queryFn: () => agentApi.notifications(wallet.scope),
    retry: false,
    refetchInterval: 15000,
  });
  const read = useMutation({
    mutationFn: (id: string) => agentApi.read(id, wallet.scope),
    onSuccess: refresh,
  });
  return (
    <>
      <section className="panel">
        <div className="section-heading">
          <div>
            <span className="eyebrow">LOCAL AGENT / AUDIT TRAIL</span>
            <h2>{t('agent.projectRuns')}</h2>
          </div>
        </div>
        {runs.error && (
          <p role="alert" className="error-message">
            {errorMessage(runs.error)}
          </p>
        )}
        {runs.isPending && <LoadingState />}
        {!runs.isError && runs.data?.pages[0].items.length === 0 && (
          <p className="empty-small">{t('agent.noRuns')}</p>
        )}
        {!runs.isError && (
          <div className="run-list item-grid">
            {runs.data?.pages
              .flatMap((p) => p.items)
              .map((run) => (
                <button
                  key={run.id}
                  className={`run-item ${selected === run.id ? 'selected' : ''}`}
                  onClick={() => onSelect(run.id)}
                >
                  <div>
                    <strong>{t(`agent.${run.kind}`, run.kind)}</strong>
                    <span className="badge">{t(`agent.${run.status}`, run.status)}</span>
                    <span className="muted small">
                      {new Date(run.startedAt).toLocaleString()} ·{' '}
                      {t(`agent.${run.trigger}`, run.trigger)}
                    </span>
                  </div>
                  <p>{run.summary || t('agent.RUNNING')}</p>
                  <code className="full-address">{run.id}</code>
                </button>
              ))}
          </div>
        )}
        {runs.hasNextPage && (
          <Button
            variant="outline"
            disabled={runs.isFetchingNextPage}
            onClick={() => runs.fetchNextPage()}
          >
            {t('agent.loadMore')}
          </Button>
        )}
      </section>
      <RunDetail scope={wallet.scope} id={selected} />
      {notifications.data && notifications.data.length > 0 && (
        <section className="panel">
          <h2>{t('agent.notifications')}</h2>
          {notifications.data.slice(0, 10).map((n) => (
            <div className="notification-row" key={n.id}>
              <div>
                <p>{n.message}</p>
                <span className="muted small">{new Date(n.createdAt).toLocaleString()}</span>
              </div>
              {!n.readAt && (
                <Button variant="ghost" size="sm" onClick={() => read.mutate(n.id)}>
                  {t('agent.markRead')}
                </Button>
              )}
            </div>
          ))}
        </section>
      )}
    </>
  );
}
