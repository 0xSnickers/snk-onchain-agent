import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import { i18n } from '@/i18n';
import { onchainApi } from '@/services/api/onchainApi';
import { KolPanel } from './KolPanel';
vi.mock('@/services/api/onchainApi', () => ({
  onchainApi: {
    kols: vi.fn(),
    addKol: vi.fn(),
    removeKol: vi.fn(),
    kolPosts: vi.fn(),
    syncKol: vi.fn(),
    syncSharedKols: vi.fn(),
    updateKol: vi.fn(),
  },
}));
function renderPanel() {
  return render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <KolPanel />
      </QueryClientProvider>
    </I18nextProvider>,
  );
}
beforeEach(async () => {
  vi.resetAllMocks();
  await i18n.changeLanguage('zh-CN');
  vi.mocked(onchainApi.kolPosts).mockResolvedValue({
    source: 'xapi.to',
    kolId: 'id',
    posts: [],
    nextCursor: null,
    lastSyncedAt: null,
    error: null,
  });
});
afterEach(cleanup);
it('shows empty state and adds a handle', async () => {
  vi.mocked(onchainApi.kols).mockResolvedValue({
    accounts: [],
    x: { configured: false, state: 'PLANNED' },
  });
  vi.mocked(onchainApi.addKol).mockResolvedValue({
    id: 'id',
    handle: 'example',
    note: '',
    createdAt: '',
  });
  renderPanel();
  expect(await screen.findByText('你的研究网络，从第一个账号开始')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: '添加' }));
  expect(screen.getByRole('dialog')).toBeInTheDocument();
  await userEvent.type(screen.getByLabelText('X 用户名（不含 @）'), 'example');
  await userEvent.click(screen.getByRole('button', { name: '添加账号' }));
  await waitFor(() =>
    expect(onchainApi.addKol).toHaveBeenCalledWith({ handle: 'example', category: 'DAILY' }),
  );
});
it('shows source failure', async () => {
  vi.mocked(onchainApi.kols).mockRejectedValue(new Error('Database unavailable'));
  renderPanel();
  expect(await screen.findByRole('alert')).toHaveTextContent('Database unavailable');
});
it('renders stored profile and removes it', async () => {
  vi.mocked(onchainApi.kols).mockResolvedValue({
    accounts: [{ id: 'id', handle: 'example', note: 'note', createdAt: '' }],
    x: { configured: false, state: 'PLANNED' },
  });
  vi.mocked(onchainApi.removeKol).mockResolvedValue(undefined);
  renderPanel();
  expect(await screen.findByRole('link', { name: 'X @example' })).toHaveAttribute(
    'href',
    'https://x.com/example',
  );
  await userEvent.click(screen.getByRole('button', { name: '移除 @example' }));
  await waitFor(() => expect(onchainApi.removeKol).toHaveBeenCalledWith('id', expect.anything()));
});
it('shows nicknames and selects the matching timeline directly from the mini watchlist', async () => {
  vi.mocked(onchainApi.kols).mockResolvedValue({
    accounts: [
      { id: 'first', handle: 'first_user', displayName: '第一个昵称', note: '', createdAt: '' },
      { id: 'second', handle: 'second_user', displayName: '第二个昵称', note: '', createdAt: '' },
    ],
    x: { configured: false, state: 'NOT_CONFIGURED' },
  });
  vi.mocked(onchainApi.kolPosts).mockImplementation(async (id) => ({
    source: 'xapi.to',
    kolId: id,
    posts: [],
    nextCursor: null,
    lastSyncedAt: null,
    error: null,
  }));
  renderPanel();
  expect(await screen.findByRole('heading', { name: '第一个昵称' })).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: /第二个昵称/ }));
  expect(await screen.findByRole('heading', { name: '第二个昵称' })).toBeInTheDocument();
  await waitFor(() => expect(onchainApi.kolPosts).toHaveBeenCalledWith('second'));
  expect(onchainApi.syncKol).not.toHaveBeenCalled();
});
it('edits account category without a research-note field', async () => {
  vi.mocked(onchainApi.kols).mockResolvedValue({
    accounts: [
      {
        id: 'id',
        handle: 'example',
        displayName: '示例昵称',
        category: 'DAILY',
        note: 'legacy',
        createdAt: '',
      },
    ],
    x: { configured: false, state: 'NOT_CONFIGURED' },
  });
  vi.mocked(onchainApi.updateKol).mockResolvedValue({
    id: 'id',
    handle: 'example',
    category: 'MEME',
    note: '',
    createdAt: '',
  });
  renderPanel();
  await userEvent.click(await screen.findByRole('button', { name: '编辑账号 @example' }));
  expect(screen.getAllByRole('option')).toHaveLength(4);
  expect(screen.getByRole('option', { name: 'Agent Wallet 打新' })).toBeInTheDocument();
  expect(screen.queryByLabelText('研究备注（可选）')).not.toBeInTheDocument();
  await userEvent.selectOptions(screen.getByLabelText('分类'), 'MEME');
  await userEvent.click(screen.getByRole('button', { name: '保存' }));
  await waitFor(() =>
    expect(onchainApi.updateKol).toHaveBeenCalledWith({
      id: 'id',
      handle: 'example',
      category: 'MEME',
    }),
  );
});

it('shows initial loading without an empty-state flash', async () => {
  vi.mocked(onchainApi.kols).mockReturnValue(new Promise(() => {}));
  renderPanel();
  expect(screen.getByRole('status')).toHaveTextContent('加载');
  expect(screen.queryByText('你的研究网络，从第一个账号开始')).not.toBeInTheDocument();
});
it('closes the add dialog with Escape and restores focus', async () => {
  vi.mocked(onchainApi.kols).mockResolvedValue({
    accounts: [],
    x: { configured: false, state: 'PLANNED' },
  });
  renderPanel();
  await screen.findByText('你的研究网络，从第一个账号开始');
  const add = screen.getByRole('button', { name: '添加' });
  await userEvent.click(add);
  expect(screen.getByRole('dialog')).toBeInTheDocument();
  await userEvent.keyboard('{Escape}');
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  await waitFor(() => expect(add).toHaveFocus());
});
it('paginates cached posts by ten and resets on account switch', async () => {
  HTMLElement.prototype.scrollIntoView = vi.fn();
  vi.mocked(onchainApi.kols).mockResolvedValue({
    accounts: [
      { id: 'first', handle: 'first_user', note: '', createdAt: '' },
      { id: 'second', handle: 'second_user', note: '', createdAt: '' },
    ],
    x: { configured: true, state: 'READY' },
  });
  vi.mocked(onchainApi.kolPosts).mockImplementation(async (id) => ({
    source: 'xapi.to',
    kolId: id,
    nextCursor: null,
    lastSyncedAt: null,
    error: null,
    posts: Array.from({ length: 21 }, (_, i) => ({
      id: `${id}-${i}`,
      kolId: id,
      postId: String(i),
      text: `${id} tweet ${i + 1}`,
      authorId: id,
      authorHandle: `${id}_user`,
      postedAt: null,
      fetchedAt: '',
      likes: null,
      reposts: null,
      replies: null,
    })),
  }));
  renderPanel();
  expect(await screen.findByText('first tweet 1')).toBeInTheDocument();
  expect(screen.getAllByRole('article')).toHaveLength(10);
  expect(screen.queryByText('first tweet 11')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: '上一页' })).toBeDisabled();
  await userEvent.click(screen.getByRole('button', { name: '下一页' }));
  expect(screen.getByText('first tweet 11')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: '下一页' }));
  expect(screen.getAllByRole('article')).toHaveLength(1);
  expect(screen.getByRole('button', { name: '下一页' })).toBeDisabled();
  await userEvent.click(screen.getByRole('button', { name: /^second_user/ }));
  expect(await screen.findByText('second tweet 1')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '上一页' })).toBeDisabled();
  expect(onchainApi.syncKol).not.toHaveBeenCalled();
});
it('shows four watch groups, shared source, and syncs the shared list', async () => {
  vi.mocked(onchainApi.kols).mockResolvedValue({
    accounts: [
      {
        id: 'daily',
        handle: 'daily_one',
        category: 'DAILY',
        source: 'SHARED',
        note: '',
        createdAt: '',
        lastSyncedAt: null,
        syncError: null,
      },
      {
        id: 'meme',
        handle: 'meme_one',
        category: 'MEME',
        source: 'MANUAL',
        note: '',
        createdAt: '',
        lastSyncedAt: '2026-11-01T00:00:00.000Z',
      },
      {
        id: 'drop',
        handle: 'drop_one',
        category: 'AIRDROP',
        source: 'SHARED',
        note: '',
        createdAt: '',
        syncError: 'upstream',
      },
      {
        id: 'mint',
        handle: 'mint_one',
        category: 'AGENT_WALLET_MINT',
        source: 'SHARED',
        note: '',
        createdAt: '',
      },
    ],
    x: { configured: false, state: 'NOT_CONFIGURED' },
  });
  vi.mocked(onchainApi.syncSharedKols).mockResolvedValue({
    created: 4,
    updated: 1,
    skipped: 2,
    categories: { DAILY: 1, MEME: 1, AIRDROP: 1, AGENT_WALLET_MINT: 1 },
  });
  renderPanel();
  expect(await screen.findByRole('heading', { name: /Agent Wallet 打新/ })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: /撸空投/ })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: /日常关注/ })).toBeInTheDocument();
  expect(screen.getAllByText('共享名单').length).toBeGreaterThan(0);
  expect(screen.getAllByText('未配置 XAPI_KEY').length).toBeGreaterThan(0);
  expect(screen.getByText('同步失败')).toBeInTheDocument();
  expect(screen.getAllByText('未同步推文').length).toBeGreaterThan(0);
  await userEvent.click(screen.getByRole('button', { name: /^MEME/ }));
  expect(screen.queryByRole('button', { name: /^daily_one/ })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: /^meme_one/ })).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: '从共享名单同步' }));
  await waitFor(() => expect(onchainApi.syncSharedKols).toHaveBeenCalled());
  expect(await screen.findByText(/新增 4，更新 1，跳过 2/)).toBeInTheDocument();
});
