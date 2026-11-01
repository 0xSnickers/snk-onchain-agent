import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { PortfolioOverview } from '@/components/feature/dashboard/PortfolioOverview';
import { MarketPanel } from '@/components/feature/MarketPanel';
import { KolPanel } from '@/components/feature/KolPanel';
import { Button } from '@/components/ui/button';
export function HomePage() {
  const { t } = useTranslation();
  const client = useQueryClient();
  return (
    <>
      <div className="page-heading page-toolbar">
        <Button variant="outline" onClick={() => client.invalidateQueries()}>
          <RefreshCw size={14} />
          {t('onchain.refresh')}
        </Button>
      </div>
      <PortfolioOverview />
      <div className="dashboard-lower">
        <MarketPanel compact />
        <div className="dashboard-aside">
          <KolPanel compact />
        </div>
      </div>
    </>
  );
}
