import { LoadingState } from '@/components/feedback/LoadingState';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { agentApi } from '@/services/api/agentApi';
import { agentKeys } from '../hooks/useAgent';
import { errorMessage } from '@/utils/format';
export function RunDetail({ scope, id }: { scope: string; id: string }) {
  const { t } = useTranslation();
  const detail = useQuery({
    queryKey: agentKeys.run(scope, id),
    queryFn: () => agentApi.run(id, scope),
    enabled: Boolean(id),
    retry: false,
    refetchInterval: (q) =>
      ['RUNNING', 'EXECUTING', 'SUBMITTED'].includes(q.state.data?.status || '') ? 5000 : false,
  });
  const run = detail.data;
  const pending = run?.status === 'AWAITING_CONFIRMATION';
  return (
    <section className="panel">
      <h2>{t('agent.details')}</h2>
      {!id && <p className="muted">{t('agent.selectRun')}</p>}
      {id && detail.isPending && <LoadingState />}
      {detail.error && (
        <p role="alert" className="error-message">
          {errorMessage(detail.error)}
        </p>
      )}
      {run && !detail.isError && (
        <>
          <div className="activity-meta">
            <strong>{t(`agent.${run.kind}`, run.kind)}</strong>
            <span className="badge">{t(`agent.${run.status}`, run.status)}</span>
          </div>
          <code className="full-address">{run.id}</code>
          <p>{run.summary}</p>
          {run.errorCode && (
            <p className="error-message">
              {run.errorCode}: {run.errorMessage}
            </p>
          )}
          {run.candidate && (
            <code className="full-address">
              {run.candidate.chainId} / {run.candidate.contractAddress}
            </code>
          )}
          <ol className="agent-timeline">
            {run.actions.map((a) => (
              <li key={a.id}>
                <div className="activity-meta">
                  <strong>
                    {a.seq}. {a.name}
                  </strong>
                  <span className={`badge ${a.decision === 'ALLOW' ? 'positive' : ''}`}>
                    {t(`agent.${a.decision}`, a.decision)}
                  </span>
                  <time>{new Date(a.createdAt).toLocaleString()}</time>
                  {a.durationMs !== null && <span className="muted small">{a.durationMs} ms</span>}
                </div>
                {a.riskSummary && <p className="error-message">{a.riskSummary}</p>}
                {a.txHash && (
                  <a
                    className="full-address"
                    href={`https://bscscan.com/tx/${encodeURIComponent(a.txHash)}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {a.txHash} ↗
                  </a>
                )}
                {a.requestId && <code className="full-address">requestId: {a.requestId}</code>}
                <details>
                  <summary>{t('agent.details')}</summary>
                  <pre className="agent-json">{JSON.stringify(a.detailJson, null, 2)}</pre>
                </details>
              </li>
            ))}
          </ol>
          {pending && <p className="muted">{t('agent.readOnly')}</p>}
        </>
      )}
    </section>
  );
}
