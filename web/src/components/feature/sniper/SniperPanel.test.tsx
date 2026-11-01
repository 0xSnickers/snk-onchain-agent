import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import type { SniperBoard, SniperTarget } from '@snk/contracts';
import { i18n } from '@/i18n';
import { sniperApi } from '@/services/api/sniperApi';
import { SniperPanel } from './SniperPanel';

vi.mock('@/services/api/sniperApi', () => ({
  sniperApi: {
    board: vi.fn(),
    saveControls: vi.fn(),
    add: vi.fn(),
    arm: vi.fn(),
    disarm: vi.fn(),
    preview: vi.fn(),
    confirm: vi.fn(),
  },
}));

const address = '0x' + 'a'.repeat(40);
const target = (patch: Partial<SniperTarget> = {}): SniperTarget => ({
  id: 'target-1',
  chainId: '56',
  contractAddress: address,
  symbol: 'AID',
  name: 'Agent',
  source: 'FOUR_EXCLUSIVE',
  stage: 'FINALIZING',
  kind: 'PAID',
  status: 'WATCHING',
  progress: 40,
  holders: 12,
  agentWallets: null,
  reasons: ['CAP_UNKNOWN', 'AGENT_WALLETS_UNKNOWN', 'DRAINED_UNKNOWN', 'BELOW_PROGRESS'],
  signals: {
    exclusiveTemplate: true,
    bytecodeHasRegistry: null,
    feeWei: null,
    hasWalletCap: null,
    hasTxCap: null,
    drained: null,
    pooled: null,
    ageMs: null,
  },
  imageUrl: null,
  platform: 'Four.meme Agent ID',
  url: `https://bscscan.com/token/${address}`,
  armedAt: null,
  preview: null,
  discoveredAt: '2026-11-01T00:00:00.000Z',
  updatedAt: '2026-11-01T00:00:00.000Z',
  ...patch,
});
const board = (patch: Partial<SniperBoard> = {}): SniperBoard => ({
  chain: 'bsc',
  coverage: 'BOUNDED_SAMPLE',
  broadcast: false,
  registry: '0x60b9262456de011f7d15a54cdd8c48baaa8b022f',
  fetchedAt: '2026-11-01T00:00:00.000Z',
  controls: { armed: false, minProgress: 65, minAgentWallets: 115, maxUsd: 20, dailyUsdCap: 60 },
  targets: [target()],
  sources: [{ stage: 'NEW', status: 'OK', count: 1, error: null }],
  refreshError: null,
  ...patch,
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function renderPanel() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <SniperPanel />
      </QueryClientProvider>
    </I18nextProvider>,
  );
}

it('shows the watch list, blockers, and an empty sample', async () => {
  await i18n.changeLanguage('zh-CN');
  vi.mocked(sniperApi.board).mockResolvedValue(board());
  renderPanel();
  expect(await screen.findByRole('button', { name: /AID/ })).toBeInTheDocument();
  expect(screen.getByText(/公开持有者不是 Agent ID 付费钱包数/)).toBeInTheDocument();
  expect(screen.getByText('总开关未武装')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '武装此目标' })).not.toBeInTheDocument();
  cleanup();
  vi.mocked(sniperApi.board).mockResolvedValue(
    board({ targets: [target({ status: 'THRESHOLD', reasons: ['READY'] })] }),
  );
  renderPanel();
  expect(await screen.findByRole('button', { name: '武装此目标' })).toBeDisabled();
  cleanup();
  vi.mocked(sniperApi.board).mockResolvedValue(board({ targets: [] }));
  renderPanel();
  expect(await screen.findByText('这次采样没有 Agent ID 专属新盘。')).toBeInTheDocument();
});

it('shows a refresh failure without hiding the last list, and a hard failure alone', async () => {
  await i18n.changeLanguage('zh-CN');
  vi.mocked(sniperApi.board).mockResolvedValue(
    board({ refreshError: { code: 'SNIPER_UPSTREAM_ERROR', message: 'down' } }),
  );
  renderPanel();
  expect(await screen.findByRole('alert')).toHaveTextContent('SNIPER_UPSTREAM_ERROR');
  expect(screen.getByRole('button', { name: /AID/ })).toBeInTheDocument();
  cleanup();
  vi.mocked(sniperApi.board).mockRejectedValue(new Error('feed down'));
  renderPanel();
  expect(await screen.findByRole('alert')).toHaveTextContent('feed down');
  expect(screen.queryByRole('button', { name: /AID/ })).not.toBeInTheDocument();
});

it('saves the arm switch and records an intent only after the exact phrase', async () => {
  await i18n.changeLanguage('zh-CN');
  const armedBoard = board({
    controls: { armed: true, minProgress: 65, minAgentWallets: 115, maxUsd: 20, dailyUsdCap: 60 },
    targets: [
      target({
        status: 'AWAITING_CONFIRM',
        reasons: ['READY'],
        preview: { amount: '5', asset: 'USDT', expiresAt: '2099-01-01T00:00:00.000Z' },
      }),
    ],
  });
  vi.mocked(sniperApi.board).mockResolvedValue(armedBoard);
  vi.mocked(sniperApi.saveControls).mockResolvedValue({
    ...armedBoard,
    controls: { ...armedBoard.controls, armed: false },
  });
  vi.mocked(sniperApi.confirm).mockResolvedValue({
    id: 'intent-1',
    targetId: 'target-1',
    amount: '5',
    asset: 'USDT',
    confirmationText: '确认狙击 5 USDT',
    status: 'RECORDED',
    broadcast: false,
    reason: 'WALLET_DELEGATED',
    createdAt: '2026-11-01T00:00:00.000Z',
  });
  renderPanel();
  const confirm = await screen.findByRole('button', { name: '确认记录意图' });
  expect(confirm).toBeDisabled();
  await userEvent.type(screen.getByRole('textbox', { name: '确认文案' }), '确认狙击 5 USDT');
  expect(confirm).toBeEnabled();
  await userEvent.click(confirm);
  expect(sniperApi.confirm).toHaveBeenCalledWith('target-1', '5', '确认狙击 5 USDT');
  expect(await screen.findByText('意图已记录。本机不广播，也不会自动买入。')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('checkbox', { name: '武装总开关' }));
  await userEvent.click(screen.getByRole('button', { name: '保存门槛' }));
  expect(sniperApi.saveControls).toHaveBeenCalledWith(
    expect.objectContaining({ armed: false, minProgress: 65, maxUsd: 20 }),
  );
});
