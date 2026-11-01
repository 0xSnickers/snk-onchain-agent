import { DelegatedBuyForm } from '@/components/feature/DelegatedBuyForm';
import { useTranslation } from 'react-i18next';
import type { ResearchBrief } from '@snk/contracts';
export function ResearchBriefCard({
  brief,
  onRun,
}: {
  brief: ResearchBrief;
  onRun: (id: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <article className="panel">
      <div className="section-heading">
        <h2>
          {brief.symbol || t('agent.unknown')} · {brief.chainId}
        </h2>
        <span className="badge">{brief.riskLevel || 'UNAVAILABLE'}</span>
      </div>
      <code className="full-address">{brief.contractAddress}</code>
      <pre className="research-body">{brief.bodyMd}</pre>
      <p className="data-caption">Binance Web3 · {new Date(brief.createdAt).toLocaleString()}</p>
      <p className="muted small">{t('agent.paidHint')}</p>
      <DelegatedBuyForm briefId={brief.id} />
      <button className="more-link" onClick={() => onRun(brief.runId)}>
        {t('agent.viewRun')} →
      </button>
    </article>
  );
}
