import { render, screen, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import { i18n } from '@/i18n';
import { onchainApi } from '@/services/api/onchainApi';
import { MarketChart } from './MarketChart';
vi.mock('@/services/api/onchainApi', () => ({ onchainApi: { kline: vi.fn() } }));
vi.mock('./CandlestickChart', () => ({ CandlestickChart: () => <div data-testid="last-chart" /> }));
afterEach(cleanup);
it('retains matching last-successful candles when a background refresh fails', async () => {
  await i18n.changeLanguage('zh-CN');
  const client = new QueryClient();
  const address = '0x' + '1'.repeat(40);
  client.setQueryData(
    ['market', 'kline', 'bsc', address, '15m'],
    {
      source: 'GMGN',
      chain: 'bsc',
      address,
      resolution: '15m',
      fetchedAt: '2026-10-28T00:00:00Z',
      candles: [{ time: 1700000000, open: 1, high: 2, low: 0.5, close: 1.5, volumeUsd: 1 }],
    },
    { updatedAt: 1 },
  );
  vi.mocked(onchainApi.kline).mockRejectedValue(new Error('Upstream failed'));
  render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <MarketChart
          token={{
            chain: 'bsc',
            address,
            symbol: 'TEST',
            name: 'TEST',
            priceUsd: '1',
            changePercent: 0,
            volumeUsd: 1,
            liquidityUsd: 1,
            marketCapUsd: null,
            holders: null,
            platform: null,
            url: 'https://gmgn.ai',
          }}
        />
      </QueryClientProvider>
    </I18nextProvider>,
  );
  expect(await screen.findByText('更新失败 · 显示上次数据')).toBeInTheDocument();
  expect(screen.getByTestId('last-chart')).toBeInTheDocument();
});
