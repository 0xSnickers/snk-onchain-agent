import { delegationApi } from '@/services/api/delegationApi';
import { LoadingState } from '@/components/feedback/LoadingState';
import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { agentApi } from '@/services/api/agentApi';
import { agentKeys, useRefreshAgent } from '../hooks/useAgent';
import { Button } from '@/components/ui/button';
import { errorMessage } from '@/utils/format';
import { CandidateForm } from './CandidateForm';
import { ResearchBriefCard } from './ResearchBriefCard';
export function MintMonitorPanel({ scope, onRun }: { scope: string; onRun: (id: string) => void }) {
  const { t } = useTranslation(),
    refresh = useRefreshAgent();
  const [tab, setTab] = useState('candidates');
  const candidates = useQuery({
    queryKey: agentKeys.candidates(scope),
    queryFn: agentApi.candidates,
    retry: false,
    refetchInterval: 10000,
  });
  const briefs = useQuery({
    queryKey: agentKeys.briefs(scope),
    queryFn: agentApi.briefs,
    retry: false,
  });
  const research = useMutation({
    mutationFn: agentApi.research,
    onSuccess: () => {
      setTab('briefs');
      void refresh();
    },
  });
  const queue = useMutation({ mutationFn: (id: string) => delegationApi.queue(id), onSuccess: refresh });
  const filtered =
    candidates.data?.filter(
      (c) =>
        tab !== 'completed' || ['MINTED', 'BOUGHT', 'MINT_FAILED', 'BUY_FAILED'].includes(c.status),
    ) || [];
  return (
    <>
      <p className="muted">{t('agent.mintHint')}</p>
      <div className="agent-tabs" role="tablist">
        {['candidates', 'briefs', 'completed'].map((k) => (
          <button
            role="tab"
            aria-selected={tab === k}
            className={tab === k ? 'selected' : ''}
            key={k}
            onClick={() => setTab(k)}
          >
            {t(`agent.${k}`)}
          </button>
        ))}
      </div>
      {tab === 'candidates' && <CandidateForm />}
      {tab === 'briefs' ? (
        <>
          <p className="muted small">{t('agent.researchHint')}</p>
          {briefs.error && (
            <p role="alert" className="error-message">
              {errorMessage(briefs.error)}
            </p>
          )}
          {briefs.isPending && <LoadingState />}
          {briefs.data?.length === 0 && <p className="empty-small">{t('agent.noBriefs')}</p>}
          {briefs.data?.map((b) => (
            <ResearchBriefCard key={b.id} brief={b} onRun={onRun} />
          ))}
        </>
      ) : (
        <section className="panel">
          <h2>{t(`agent.${tab}`)}</h2>
          {candidates.error && (
            <p role="alert" className="error-message">
              {errorMessage(candidates.error)}
            </p>
          )}
          {candidates.isPending && <LoadingState />}
          {!candidates.isPending && !candidates.isError && filtered.length === 0 && (
            <p className="empty-small">{t('agent.noCandidates')}</p>
          )}
          <div className="item-grid">
            {filtered.map((c) => (
              <article className="candidate-row" key={c.id}>
                <div className="activity-meta">
                  <strong>{c.name || c.symbol || t(`agent.${c.class}`)}</strong>
                  <span className="badge">{t(`agent.${c.status}`, c.status)}</span>
                  <span className="muted small">
                    {c.source} · {c.chainId}
                  </span>
                </div>
                <code className="full-address">{c.contractAddress}</code>
                <div className="agent-toolbar">
                  {![
                    'MINTED',
                    'BOUGHT',
                    'BUY_PENDING',
                    'BROADCASTED',
                    'AWAITING_APP',
                    'EXECUTION_UNKNOWN',
                    'EXECUTING',
                    'CLASSIFYING',
                    'RESEARCHING',
                    'AWAITING_USER',
                    'PREVIEW_OK',
                  ].includes(c.status) && (
                    <>
                      <Button
                        variant="outline"
                        disabled={research.isPending}
                        onClick={() => research.mutate(c.id)}
                      >
                        {t('agent.research')}
                      </Button>
                      <Button
                        variant="outline"
                        disabled={queue.isPending}
                        onClick={() => queue.mutate(c.id)}
                      >
                        {t('delegation.queue')}
                      </Button>
                    </>
                  )}
                  {c.lastRunId && (
                    <Button variant="ghost" onClick={() => onRun(c.lastRunId!)}>
                      {t('agent.viewRun')}
                    </Button>
                  )}
                </div>
              </article>
            ))}
          </div>
          {queue.error && (
            <p role="alert" className="error-message">
              {errorMessage(queue.error)}
            </p>
          )}
          {research.error && (
            <p role="alert" className="error-message">
              {errorMessage(research.error)}
            </p>
          )}
        </section>
      )}
    </>
  );
}
