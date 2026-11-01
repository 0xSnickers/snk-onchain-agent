import type { SniperBoard, SniperControls, SniperIntent, SniperTarget } from '@snk/contracts';
import type { ApiResponse } from '@/types/api';
import { httpClient } from './httpClient';

async function send<T>(method: 'post' | 'patch', path: string, body?: unknown) {
  const response = await httpClient.request<ApiResponse<T>>({ method, url: path, data: body });
  return response.data.data;
}

export const sniperApi = {
  board: async () => (await httpClient.get<ApiResponse<SniperBoard>>('/sniper/board')).data.data,
  saveControls: (controls: SniperControls) =>
    send<SniperBoard>('patch', '/sniper/controls', controls),
  add: (contractAddress: string) =>
    send<SniperTarget>('post', '/sniper/targets', { contractAddress }),
  arm: (id: string) => send<SniperTarget>('post', `/sniper/targets/${id}/arm`),
  disarm: (id: string) => send<SniperTarget>('post', `/sniper/targets/${id}/disarm`),
  preview: (id: string, amount: string) =>
    send<SniperTarget>('post', `/sniper/targets/${id}/preview`, { amount }),
  confirm: (id: string, amount: string, confirmationText: string) =>
    send<SniperIntent>('post', `/sniper/targets/${id}/confirm`, {
      amount,
      asset: 'USDT',
      confirmationText,
    }),
};
