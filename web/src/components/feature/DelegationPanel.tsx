import { ExecutorManager } from './ExecutorManager';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { delegationApi } from '@/services/api/delegationApi';
import { Button } from '@/components/ui/button';
import { LoadingState } from '@/components/feedback/LoadingState';
import { errorMessage } from '@/utils/format';
export function DelegationPanel({
  scope,
  onScope,
}: {
  scope: string;
  onScope: (scope: string) => void;
}) {
  const { t } = useTranslation();
  const client = useQueryClient();
  const [executor, setExecutor] = useState('');
  const sessions = useQuery({
    queryKey: ['delegation', 'sessions'],
    queryFn: delegationApi.sessions,
    retry: false,
    refetchInterval: 15000,
  });
  const scans = useQuery({
    queryKey: ['delegation', 'scans'],
    queryFn: delegationApi.scans,
    retry: false,
    refetchInterval: 15000,
  });
  const outbox = useQuery({
    queryKey: ['delegation', scope, 'outbox'],
    queryFn: delegationApi.outbox,
    retry: false,
    refetchInterval: 10000,
  });
  const scan = useMutation({
    mutationFn: delegationApi.scan,
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['delegation'] });
      void client.invalidateQueries({ queryKey: ['agent'] });
    },
  });
  return (
    <section className="panel">
      <h2>{t('delegation.title')}</h2>
      <p className="muted small">{t('delegation.hint')}</p>
      {sessions.isPending && <LoadingState />}
      {sessions.data?.length === 0 && <p>{t('delegation.noSessions')}</p>}
      <div className="agent-toolbar">
        <label>
          {t('delegation.wallet')}{' '}
          <select value={scope} onChange={(e) => onScope(e.target.value)}>
            <option value="">{t('delegation.scopes')}</option>
            {sessions.data?.map((s) => (
              <option key={s.id} value={s.walletScope}>
                {s.label || s.id} · {s.id} · {s.walletScope}
              </option>
            ))}
          </select>
        </label>
        <Button disabled={scan.isPending} onClick={() => scan.mutate()}>
          {t('delegation.scan')}
        </Button>
      </div>
      {sessions.data && <ExecutorManager sessions={sessions.data} />}
      {[sessions.error, outbox.error, scan.error, scans.error].filter(Boolean).map((e, i) => (
        <p key={i} role="alert" className="error-message">
          {errorMessage(e)}
        </p>
      ))}
      {scan.data && <p role="status">{t('delegation.scanResult', scan.data)}</p>}
      <select
        aria-label={t('delegation.all')}
        value={executor}
        onChange={(e) => setExecutor(e.target.value)}
      >
        <option value="">{t('delegation.all')}</option>
        {sessions.data?.map((s) => (
          <option key={s.id} value={s.id}>
            {s.label || s.id}
          </option>
        ))}
      </select>
      {outbox.isPending && <LoadingState />}
      {outbox.data?.length === 0 && <p>{t('delegation.empty')}</p>}
      <div className="item-grid">
        {outbox.data
          ?.filter(
            (r) => (!executor || r.executorId === executor) && (!scope || r.walletScope === scope),
          )
          .map((row) => (
            <article key={row.id} className="candidate-row">
              <div className="activity-meta">
                <strong>{row.payload.name || row.payload.symbol || row.kind}</strong>
                <span className="badge">
                  {row.executorId} · {row.kind} · {row.status}
                </span>
              </div>
              <code className="full-address">{row.payload.contract}</code>
              <code className="full-address">{row.walletScope}</code>
              <p className="muted small">
                {row.provider} · {new Date(row.createdAt).toLocaleString()}
              </p>
              {row.txHash && (
                <a href={`https://bscscan.com/tx/${row.txHash}`} target="_blank" rel="noreferrer">
                  <code className="full-address">{row.txHash}</code>
                </a>
              )}
            </article>
          ))}
      </div>
      {scans.data?.map((run) => (
        <details key={run.id}>
          <summary>
            {new Date(run.startedAt).toLocaleString()} · {run.status} · {run.summary}
          </summary>
          {run.actions.map((a, i) => (
            <p key={i} className={a.decision === 'DENY' ? 'error-message' : 'muted small'}>
              {a.name} · {a.decision} · {JSON.stringify(a.detailJson)}
            </p>
          ))}
        </details>
      ))}
    </section>
  );
}
