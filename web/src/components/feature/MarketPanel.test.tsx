import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import { i18n } from '@/i18n';
import { onchainApi } from '@/services/api/onchainApi';
import { MarketPanel } from './MarketPanel';
vi.mock('@/services/api/onchainApi', () => ({
  onchainApi: { tokens: vi.fn(), market: vi.fn(), agentLaunches: vi.fn() },
}));
vi.mock('./market/MarketChart', () => ({
  MarketChart: ({ token }: { token?: { symbol: string } }) => (
    <div data-testid="chart">{token?.symbol || 'unselected'}</div>
  ),
}));
afterEach(cleanup);
it('formats token prices by magnitude, only SOL/BNB choices, and clears old-chain data during loading', async () => {
  await i18n.changeLanguage('zh-CN');
  vi.mocked(onchainApi.agentLaunches).mockResolvedValue({
    chain: 'bsc',
    fetchedAt: new Date().toISOString(),
    scope: 'AGENT_LAUNCHPADS',
    coverage: 'BOUNDED_SAMPLE',
    sources: [],
    tokens: [],
  });
  vi.mocked(onchainApi.tokens)
    .mockResolvedValueOnce({
      source: 'GMGN',
      chain: 'bsc',
      interval: '1h',
      fetchedAt: '2026-10-28T00:00:00Z',
      tokens: [
        {
          chain: 'bsc',
          address: '0x' + '1'.repeat(40),
          symbol: 'TEST',
          name: 'Test',
          priceUsd: '0.12',
          changePercent: 2.5,
          volumeUsd: 1,
          liquidityUsd: 2,
          marketCapUsd: null,
          holders: null,
          platform: null,
          url: 'https://gmgn.ai/bsc/token/test',
        },
      ],
    })
    .mockImplementation(() => new Promise(() => {}));
  render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <MarketPanel />
        </MemoryRouter>
      </QueryClientProvider>
    </I18nextProvider>,
  );
  await userEvent.click(screen.getByRole('button', { name: 'SOL / BNB · 热门与搜索' }));
  expect(await screen.findByText('$0.12')).toBeInTheDocument();
  expect(screen.getByText('+2.5%')).toBeInTheDocument();
  expect(screen.getAllByRole('option')).toHaveLength(2);
  await userEvent.selectOptions(screen.getByLabelText('网络'), 'solana');
  await waitFor(() => expect(screen.queryByText('$0.12')).not.toBeInTheDocument());
  expect(screen.getByTestId('chart')).toHaveTextContent('unselected');
});
