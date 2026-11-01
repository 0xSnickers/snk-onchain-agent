import { RunDetail } from './RunDetail';
import { DelegationPanel } from '@/components/feature/DelegationPanel';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAgentConfig, useIdentity } from '../hooks/useAgent';
import { WalletHistoryPanel } from './WalletHistoryPanel';
import { AgentRunPanel } from './AgentRunPanel';
import { MintMonitorPanel } from './MintMonitorPanel';
import { errorMessage } from '@/utils/format';

const recordTabs = ['history', 'mint', 'runs'] as const;
type RecordTab = (typeof recordTabs)[number];
const recordLabel = {
  history: 'agent.walletHistory',
  mint: 'agent.mint',
  runs: 'agent.projectRuns',
} as const;
function readRecordTab(): RecordTab {
  const id = window.location.hash.replace('#', '');
  return id === 'mint' || id === 'runs' ? id : 'history';
}

export function AgentWorkspace() {
  const { t } = useTranslation();
  const [selected, setSelected] = useState('');
  const [tab, setTab] = useState<RecordTab>(readRecordTab);
  const [scope, setScope] = useState('');
  const identity = useIdentity(scope);
  const config = useAgentConfig();
  const wallet = identity.data;
  const ready = Boolean(wallet) && !identity.isError;
  const selectTab = (next: RecordTab) => {
    setTab(next);
    const hash = `#${next}`;
    if (window.location.hash !== hash) {
      window.history.replaceState(null, '', `${window.location.pathname}${hash}`);
    }
  };
  const onRun = (id: string) => {
    setSelected(id);
    selectTab('runs');
  };
  useEffect(() => {
    const sync = () => setTab(readRecordTab());
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);
  return (
    <>
      <DelegationPanel
        scope={scope}
        onScope={(next) => {
          setScope(next);
          setSelected('');
        }}
      />
      <section className="panel agent-config">
        <div>
          <span className="muted small">{t('agent.connectedWallet')}</span>
          {!identity.isError && wallet ? (
            <code className="full-address">{wallet.address}</code>
          ) : (
            <p className="muted">
              {identity.isPending ? t('agent.loading') : t('onchain.disconnected')}
            </p>
          )}
        </div>
        <div className="agent-toolbar">
          {config.data && (
            <>
              <span className="badge">
                {t(config.data.enabled ? 'agent.monitorOn' : 'agent.monitorOff')}
              </span>
              <span className="badge">
                {t(config.data.executionEnabled ? 'agent.executionOn' : 'agent.executionOff')}
              </span>
              {!config.data.rpcConfigured && <span className="badge">{t('agent.rpcMissing')}</span>}
            </>
          )}
        </div>
      </section>
      {identity.error && (
        <p className="wallet-notice" role="status">
          {errorMessage(identity.error)}
        </p>
      )}
      <details className="source-explanation">
        <summary>{t('market.aboutData')}</summary>
        <p className="muted small">{t('agent.sourceHint')}</p>
      </details>
      {!ready && (
        <>
          <MintMonitorPanel scope="project" onRun={onRun} />
          <RunDetail scope="" id={selected} />
        </>
      )}
      {ready && wallet && (
        <div key={wallet.scope} className="record-page">
          <div className="agent-tabs" role="tablist" aria-label={t('agent.activity')}>
            {recordTabs.map((item) => (
              <button
                key={item}
                type="button"
                role="tab"
                aria-selected={tab === item}
                className={tab === item ? 'selected' : ''}
                onClick={() => selectTab(item)}
              >
                {t(recordLabel[item])}
              </button>
            ))}
          </div>
          <section id="history" className="record-section" hidden={tab !== 'history'}>
            <WalletHistoryPanel wallet={wallet} onRun={onRun} />
          </section>
          <section id="mint" className="record-section" hidden={tab !== 'mint'}>
            <MintMonitorPanel scope={wallet.scope} onRun={onRun} />
          </section>
          <section id="runs" className="record-section" hidden={tab !== 'runs'}>
            <AgentRunPanel wallet={wallet} selected={selected} onSelect={setSelected} />
          </section>
        </div>
      )}
    </>
  );
}
