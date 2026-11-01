import { StrictMode } from 'react';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import { i18n } from '@/i18n';
import { agentApi } from '@/services/api/agentApi';
import { WalletHistoryPanel } from '../components/WalletHistoryPanel';
vi.mock('@/services/api/agentApi', () => ({ agentApi: { activity: vi.fn(), sync: vi.fn() } }));
const address = '0x' + '1'.repeat(40),
  scope = 'EVM:' + address,
  hash = '0x' + 'a'.repeat(64);
const wallet = { scope, address, addresses: [{ binanceChainId: '56', chainName: 'BSC', address }] };
function show() {
  return render(
    <StrictMode>
      <I18nextProvider i18n={i18n}>
        <QueryClientProvider
          client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })}
        >
          <WalletHistoryPanel wallet={wallet} onRun={vi.fn()} />
        </QueryClientProvider>
      </I18nextProvider>
    </StrictMode>,
  );
}
beforeEach(async () => {
  vi.resetAllMocks();
  await i18n.changeLanguage('zh-CN');
});
afterEach(cleanup);
it('shows imported history without calling the live wallet', async () => {
  vi.mocked(agentApi.activity).mockResolvedValue({
    walletAddress: address,
    walletScope: scope,
    source: 'BINANCE_AGENTIC_WALLET',
    items: [],
    nextCursor: null,
  });
  show();
  expect(await screen.findByText(/npm run import:baw-mints/)).toBeInTheDocument();
  expect(agentApi.sync).not.toHaveBeenCalled();
});
it('renders provider Mint, full transaction hash and supports filters', async () => {
  vi.mocked(agentApi.activity).mockResolvedValue({
    walletAddress: address,
    walletScope: scope,
    source: 'BINANCE_AGENTIC_WALLET',
    items: [
      {
        id: 'id',
        walletAddress: address,
        chainId: '56',
        txHash: hash,
        type: 'MINT',
        providerType: 'mint',
        status: 'confirmed',
        txTime: '2026-10-27T10:00:00Z',
        movements: [],
        networkFee: { symbol: 'BNB', tokenAddress: address, rawAmount: '1', decimals: 18 },
        source: 'BINANCE_AGENTIC_WALLET',
        fetchedAt: '2026-10-27T10:00:00Z',
        runIds: [],
      },
    ],
    nextCursor: null,
  });
  show();
  const link = await screen.findByRole('link', { name: hash + ' ↗' });
  expect(link).toHaveAttribute('href', 'https://bscscan.com/tx/' + hash);
  await userEvent.click(screen.getByRole('button', { name: 'Mint' }));
  await waitFor(() => expect(agentApi.activity).toHaveBeenCalledWith('MINT', undefined, scope));
});
it('shows upstream failure instead of inventing records', async () => {
  vi.mocked(agentApi.activity).mockRejectedValue(new Error('History unavailable'));
  show();
  expect(await screen.findByRole('alert')).toHaveTextContent('History unavailable');
  expect(screen.queryByRole('link')).not.toBeInTheDocument();
});
