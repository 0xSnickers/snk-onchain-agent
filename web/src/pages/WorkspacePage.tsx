import { WalletPanel } from '@/components/feature/WalletPanel';
import { MarketPanel } from '@/components/feature/MarketPanel';
import { KolPanel } from '@/components/feature/KolPanel';
import { ConnectionsPanel } from '@/components/feature/ConnectionsPanel';
export function WorkspacePage({ section }: { section: 'wallet' | 'market' | 'kols' | 'settings' }) {
  return (
    <div className={`workspace-page workspace-${section}`}>
      {section === 'wallet' ? (
        <WalletPanel detailed />
      ) : section === 'market' ? (
        <MarketPanel />
      ) : section === 'kols' ? (
        <KolPanel />
      ) : (
        <ConnectionsPanel />
      )}
    </div>
  );
}
