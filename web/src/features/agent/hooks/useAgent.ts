import { useQuery, useQueryClient } from '@tanstack/react-query';
import { agentApi } from '@/services/api/agentApi';
export const agentKeys = {
  all: ['agent'] as const,
  identity: ['wallet', 'identity'] as const,
  config: ['agent', 'config'] as const,
  runs: (scope: string) => ['agent', scope, 'runs'] as const,
  run: (scope: string, id: string) => ['agent', scope, 'run', id] as const,
  activity: (scope: string, type: string) => ['agent', scope, 'activity', type] as const,
  briefs: (scope: string) => ['agent', scope, 'briefs'] as const,
  candidates: (scope: string) => ['agent', scope, 'candidates'] as const,
  notifications: (scope: string) => ['agent', scope, 'notifications'] as const,
};
export const useIdentity = (scope?: string) =>
  useQuery({
    queryKey: [...agentKeys.identity, scope || 'default'],
    queryFn: () => agentApi.identity(scope),
    retry: false,
    refetchInterval: 15000,
    staleTime: 10000,
  });
export const useAgentConfig = () =>
  useQuery({ queryKey: agentKeys.config, queryFn: agentApi.config, retry: false });
export function useRefreshAgent() {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: agentKeys.all });
}
export async function assertScope<T extends { walletScope: string }>(data: T, scope: string) {
  if (data.walletScope !== scope) throw new Error('Wallet identity changed. Refresh the page.');
  return data;
}
