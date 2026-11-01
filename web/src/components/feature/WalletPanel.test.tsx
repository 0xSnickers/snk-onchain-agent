import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import { i18n } from '@/i18n';
import { onchainApi } from '@/services/api/onchainApi';
import { WalletPanel } from './WalletPanel';
vi.mock('@/services/api/onchainApi', () => ({ onchainApi: { holdings: vi.fn() } }));
const address = '0x' + 'ab'.repeat(20);
const holdings = {
  address,
  scope: 'EVM:' + address,
  chainId: '56',
  source: 'BSC_RPC',
  fetchedAt: '2026-10-28T08:00:00.000Z',
  bnbPriceUsd: '600',
  holdersSnapshot: { fetchedAt: '2026-10-28T09:42:41.406Z' },
  failures: [],
  assets: [
    {
      kind: 'NATIVE' as const,
      symbol: 'BNB',
      name: 'BNB',
      contractAddress: null,
      balance: '0.001',
      decimals: 18,
      valueUsd: '0.6',
      holders: null,
      holdersConfidence: null,
    },
    {
      kind: 'NFT' as const,
      symbol: 'BOO',
      name: 'BOO',
      contractAddress: '0x' + '11'.repeat(20),
      balance: '1',
      decimals: 0,
      valueUsd: null,
      holders: 1743,
      holdersConfidence: 'ok' as const,
    },
  ],
};
afterEach(cleanup);
function show() {
  render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <MemoryRouter>
          <WalletPanel detailed />
        </MemoryRouter>
      </QueryClientProvider>
    </I18nextProvider>,
  );
}
it('shows the ledger address, BNB value and an NFT still held', async () => {
  await i18n.changeLanguage('zh-CN');
  vi.mocked(onchainApi.holdings).mockResolvedValue(holdings);
  show();
  expect(await screen.findByText(address)).toBeInTheDocument();
  expect(screen.getAllByText('$0.600000')).toHaveLength(2);
  await userEvent.click(screen.getByRole('tab', { name: 'NFT 1' }));
  expect(screen.getByText('BOO')).toBeInTheDocument();
  expect(screen.getByText('1743 持有者')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Sign in/ })).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: '隐藏资产金额' }));
  expect(screen.queryAllByText('$0.600000')).toHaveLength(0);
});
it('shows a read failure instead of an empty portfolio', async () => {
  await i18n.changeLanguage('zh-CN');
  vi.mocked(onchainApi.holdings).mockRejectedValue(new Error('Balance RPC failed'));
  show();
  expect(await screen.findByRole('alert')).toHaveTextContent('Balance RPC failed');
  expect(screen.queryByText(address)).not.toBeInTheDocument();
});
