import { render, screen, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import { i18n } from '@/i18n';
import { agentApi } from '@/services/api/agentApi';
import { delegationApi } from '@/services/api/delegationApi';
import { AgentWorkspace } from '../components/AgentWorkspace';
vi.mock('@/services/api/agentApi', () => ({ agentApi: { identity: vi.fn(), config: vi.fn() } }));
vi.mock('@/services/api/delegationApi', () => ({
  delegationApi: { sessions: vi.fn(), outbox: vi.fn(), scans: vi.fn() },
}));
vi.mock('../components/MintMonitorPanel', () => ({ MintMonitorPanel: () => null }));
vi.mock('../components/RunDetail', () => ({ RunDetail: () => null }));
vi.mock('../components/WalletHistoryPanel', () => ({ WalletHistoryPanel: () => null }));
vi.mock('../components/AgentRunPanel', () => ({ AgentRunPanel: () => null }));
function show() {
  return render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })}
      >
        <AgentWorkspace />
      </QueryClientProvider>
    </I18nextProvider>,
  );
}
beforeEach(async () => {
  vi.resetAllMocks();
  await i18n.changeLanguage('zh-CN');
  vi.mocked(agentApi.config).mockImplementation(() => new Promise(() => {}));
  vi.mocked(delegationApi.sessions).mockResolvedValue([
    {
      id: 'w3',
      label: '备用钱包',
      role: 'MONITOR',
      walletScope: 'EVM:0x' + '1'.repeat(40),
      state: 'UNCONNECTED',
      paused: false,
      online: false,
      heartbeatAt: null,
    },
  ]);
  vi.mocked(delegationApi.outbox).mockResolvedValue([]);
  vi.mocked(delegationApi.scans).mockResolvedValue([]);
});
afterEach(cleanup);
it('loads registry independently while the legacy identity/config are pending', async () => {
  vi.mocked(agentApi.identity).mockImplementation(() => new Promise(() => {}));
  show();
  expect(await screen.findByText('备用钱包 · w3')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '编辑钱包 w3' })).toBeEnabled();
});
it('keeps registered wallets visible when the legacy ledger is invalid', async () => {
  vi.mocked(agentApi.identity).mockRejectedValue(
    new Error('Mint ledger wallet scope does not match the address'),
  );
  show();
  expect(await screen.findByText('备用钱包 · w3')).toBeInTheDocument();
  expect(
    await screen.findByText('Mint ledger wallet scope does not match the address'),
  ).toBeInTheDocument();
});
