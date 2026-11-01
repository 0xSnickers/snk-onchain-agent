export type LaunchStage = "NEW" | "FINALIZING" | "MIGRATED";
export type LaunchSource = "FOUR_AGENT" | "FLAP_AGENT" | "GANG" | "GANG_V2";
export interface AgentLaunchToken {
  address: string;
  symbol: string;
  name: string;
  priceUsd: string | null;
  changePercent: number | null;
  volumeUsd: number | null;
  liquidityUsd: number | null;
  marketCapUsd: number | null;
  holders: number | null;
  platform: string | null;
  url: string;
  imageUrl?: string | null;
  chain: "bsc";
  source: LaunchSource;
  stage: LaunchStage;
  progress: number | null;
  marketAddress: string | null;
  tokenDeployed: boolean;
  evidence: "AGENT_ID_TEMPLATE" | "FLAP_AGENT_READER" | "AGENT_PLATFORM";
}
export interface AgentLaunchMarket {
  chain: "bsc";
  fetchedAt: string;
  scope: "AGENT_LAUNCHPADS";
  coverage: "BOUNDED_SAMPLE";
  tokens: AgentLaunchToken[];
  sources: {
    source: LaunchSource;
    status: "OK" | "ERROR";
    count: number;
    error: { code: string; message: string } | null;
  }[];
}
