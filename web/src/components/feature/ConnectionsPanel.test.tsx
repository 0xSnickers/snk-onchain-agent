import { render, screen, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import { i18n } from '@/i18n';
import { onchainApi } from '@/services/api/onchainApi';
import { ConnectionsPanel } from './ConnectionsPanel';
vi.mock('@/services/api/onchainApi', () => ({ onchainApi: { health: vi.fn(), kols: vi.fn() } }));
beforeEach(async () => {
  vi.resetAllMocks();
  await i18n.changeLanguage('zh-CN');
  vi.mocked(onchainApi.health).mockResolvedValue({ status: 'ok', database: 'connected' });
});
afterEach(cleanup);
function show() {
  render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <ConnectionsPanel />
        </MemoryRouter>
      </QueryClientProvider>
    </I18nextProvider>,
  );
}
it('shows configured manual sync from server state and links to the monitor', async () => {
  vi.mocked(onchainApi.kols).mockResolvedValue({
    accounts: [],
    x: { configured: true, state: 'READY' },
  });
  show();
  expect(await screen.findByText('已配置 · 手动同步')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: '打开 KOL 监控 ↗' })).toHaveAttribute('href', '/kols');
});
it('does not report missing credentials when the status request itself failed', async () => {
  vi.mocked(onchainApi.kols).mockRejectedValue(new Error('Local API unavailable'));
  show();
  expect(await screen.findByRole('alert')).toHaveTextContent('Local API unavailable');
  expect(screen.queryByText('待配置 API Key')).not.toBeInTheDocument();
});
