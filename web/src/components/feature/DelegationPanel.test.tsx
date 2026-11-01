import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import { i18n } from '@/i18n';
import { delegationApi } from '@/services/api/delegationApi';
import { DelegationPanel } from './DelegationPanel';
import { DelegatedBuyForm } from './DelegatedBuyForm';
vi.mock('@/services/api/delegationApi', () => ({
  delegationApi: {
    scans: vi.fn(),
    sessions: vi.fn(),
    outbox: vi.fn(),
    scan: vi.fn(),
    confirm: vi.fn(),
    register: vi.fn(),
    update: vi.fn(),
  },
}));
const scope = 'EVM:0x' + '1'.repeat(40);
function show(node: React.ReactNode) {
  return render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider
        client={
          new QueryClient({
            defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
          })
        }
      >
        {node}
      </QueryClientProvider>
    </I18nextProvider>,
  );
}
beforeEach(async () => {
  vi.resetAllMocks();
  await i18n.changeLanguage('zh-CN');
  vi.mocked(delegationApi.scans).mockResolvedValue([]);
  vi.mocked(delegationApi.sessions).mockResolvedValue([]);
  vi.mocked(delegationApi.outbox).mockResolvedValue([]);
});
afterEach(cleanup);
it('allows wallet-independent detection and shows empty queue', async () => {
  vi.mocked(delegationApi.scan).mockResolvedValue({ id: 'run', status: 'FAILED', failures: 1 });
  show(<DelegationPanel scope="" onScope={vi.fn()} />);
  expect(await screen.findByText('暂无出站候选')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: '检测并生成候选队列' }));
  expect(await screen.findByRole('status')).toHaveTextContent('FAILED · 1 项失败');
});
it('shows failures instead of empty success', async () => {
  vi.mocked(delegationApi.outbox).mockRejectedValue(new Error('Database unavailable'));
  show(<DelegationPanel scope="" onScope={vi.fn()} />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Database unavailable');
  expect(screen.queryByText('暂无出站候选')).not.toBeInTheDocument();
});
it('switches to the chosen executor wallet scope', async () => {
  vi.mocked(delegationApi.sessions).mockResolvedValue([
    {
      id: 'w3',
      label: '第三钱包',
      isDefault: false,
      walletScope: scope,
      state: 'UNCONNECTED',
      paused: false,
      online: false,
      role: 'FREE_MINT',
      heartbeatAt: null,
    },
  ]);
  const onScope = vi.fn();
  show(<DelegationPanel scope="" onScope={onScope} />);
  await screen.findByText(/尚未收到执行端心跳/);
  await userEvent.selectOptions(screen.getByLabelText('查看钱包'), scope);
  expect(onScope).toHaveBeenCalledWith(scope);
});
it('records exact paid intent for offline w2 and preserves the explicit wallet binding', async () => {
  vi.mocked(delegationApi.sessions).mockResolvedValue([
    {
      id: 'w4',
      label: '第四钱包',
      isDefault: false,
      walletScope: scope,
      state: 'UNCONNECTED',
      paused: false,
      online: false,
      role: 'PAID',
      heartbeatAt: null,
    },
  ]);
  show(<DelegatedBuyForm briefId="brief" />);
  await userEvent.click(screen.getByText('记录付费买入意图'));
  await userEvent.selectOptions(screen.getByLabelText('付费目标钱包'), 'w4');
  await screen.findByText(scope);
  await userEvent.type(screen.getByLabelText('金额'), '0.01');
  const button = screen.getByRole('button', { name: '确认意图并加入所选钱包队列' });
  expect(button).toBeDisabled();
  await userEvent.type(screen.getByLabelText('输入完整确认文案'), '确认买入 0.01 BNB');
  await userEvent.click(button);
  await waitFor(() =>
    expect(delegationApi.confirm).toHaveBeenCalledWith('brief', {
      amount: '0.01',
      asset: 'BNB',
      confirmationText: '确认买入 0.01 BNB',
      walletScope: scope,
    }),
  );
});

it('adds arbitrary executor IDs as monitor-only wallets without faking online state', async () => {
  show(<DelegationPanel scope="" onScope={vi.fn()} />);
  await userEvent.click(await screen.findByRole('button', { name: '添加钱包' }));
  await userEvent.type(screen.getByLabelText('执行端 ID'), 'w17');
  await userEvent.type(screen.getByLabelText('钱包名称'), '研究钱包');
  await userEvent.type(screen.getByLabelText('钱包地址'), scope.slice(4));
  await userEvent.click(screen.getByRole('button', { name: '保存' }));
  await waitFor(() =>
    expect(delegationApi.register).toHaveBeenCalledWith({
      id: 'w17',
      label: '研究钱包',
      walletScope: scope,
      role: 'MONITOR',
      isDefault: false,
    }),
  );
});
it('selects paid wallets explicitly and clears confirmation when target changes', async () => {
  const secondScope = 'EVM:0x' + '2'.repeat(40);
  vi.mocked(delegationApi.sessions).mockResolvedValue([
    {
      id: 'w4',
      label: 'Paid A',
      walletScope: scope,
      state: 'UNCONNECTED',
      paused: false,
      online: false,
      role: 'PAID',
      heartbeatAt: null,
      isDefault: true,
    },
    {
      id: 'w8',
      label: 'Paid B',
      walletScope: secondScope,
      state: 'UNCONNECTED',
      paused: false,
      online: false,
      role: 'PAID',
      heartbeatAt: null,
      isDefault: false,
    },
  ]);
  show(<DelegatedBuyForm briefId="brief" />);
  await userEvent.click(screen.getByText('记录付费买入意图'));
  await userEvent.selectOptions(screen.getByLabelText('付费目标钱包'), 'w4');
  await userEvent.type(screen.getByLabelText('输入完整确认文案'), '确认买入 1 BNB');
  await userEvent.selectOptions(screen.getByLabelText('付费目标钱包'), 'w8');
  expect(screen.getByLabelText('输入完整确认文案')).toHaveValue('');
  expect(screen.getByText(secondScope)).toBeInTheDocument();
  expect(delegationApi.confirm).not.toHaveBeenCalled();
});
it('shows imported Grok standby/collaboration metadata without claiming connectivity', async () => {
  vi.mocked(delegationApi.sessions).mockResolvedValue([
    {
      id: 'w3',
      label: 'w3',
      walletScope: scope,
      role: 'MONITOR',
      sourceRoles: ['STANDBY', 'COLLAB'],
      agentId: 'backup.ai',
      paused: false,
      state: 'UNCONNECTED',
      heartbeatAt: null,
      online: false,
      isDefault: false,
    },
  ]);
  show(<DelegationPanel scope="" onScope={vi.fn()} />);
  expect(await screen.findByText('Agent ID: backup.ai')).toBeInTheDocument();
  expect(screen.getByText('Grok 角色: 备用 · 协作')).toBeInTheDocument();
  expect(screen.getByText('仅监控')).toBeInTheDocument();
  expect(screen.queryByText('在线')).not.toBeInTheDocument();
});
