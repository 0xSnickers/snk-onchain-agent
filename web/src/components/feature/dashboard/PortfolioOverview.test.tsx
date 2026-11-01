import { render, screen, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import { i18n } from '@/i18n';
import { onchainApi } from '@/services/api/onchainApi';
import { PortfolioOverview } from './PortfolioOverview';
vi.mock('@/services/api/onchainApi', () => ({ onchainApi: { holdings: vi.fn() } }));
beforeEach(async () => {
  vi.resetAllMocks();
  await i18n.changeLanguage('zh-CN');
});
afterEach(cleanup);
it('renders the holdings overview on the workspace', async () => {
  vi.mocked(onchainApi.holdings).mockResolvedValue({
    address: '0x' + 'ab'.repeat(20),
    scope: 'EVM:' + 'ab'.repeat(20),
    chainId: '56',
    source: 'BSC_RPC',
    fetchedAt: '2026-10-28T08:00:00.000Z',
    bnbPriceUsd: null,
    holdersSnapshot: null,
    failures: [],
    assets: [],
  });
  render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <MemoryRouter>
          <PortfolioOverview />
        </MemoryRouter>
      </QueryClientProvider>
    </I18nextProvider>,
  );
  expect(await screen.findByText('当前没有可展示的持仓')).toBeInTheDocument();
});
