import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import { i18n } from '@/i18n';
import { onchainApi } from '@/services/api/onchainApi';
import { KolTimeline } from './KolTimeline';
vi.mock('@/services/api/onchainApi', () => ({
  onchainApi: { kolPosts: vi.fn(), syncKol: vi.fn() },
}));
afterEach(cleanup);
it('only fetches local posts on mount and requires explicit sync for xapi calls', async () => {
  await i18n.changeLanguage('zh-CN');
  vi.mocked(onchainApi.kolPosts).mockResolvedValue({
    source: 'xapi.to',
    kolId: 'id',
    posts: [],
    nextCursor: null,
    lastSyncedAt: null,
    error: null,
  });
  vi.mocked(onchainApi.syncKol).mockRejectedValue(new Error('Upstream unavailable'));
  render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={new QueryClient()}>
        <KolTimeline
          accounts={[{ id: 'id', handle: 'test', note: '', createdAt: '' }]}
          configured
        />
      </QueryClientProvider>
    </I18nextProvider>,
  );
  expect(await screen.findByText('尚无采集记录，请配置后手动同步。')).toBeInTheDocument();
  expect(onchainApi.syncKol).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button', { name: '同步最新推文' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Upstream unavailable');
});
