export interface WalletIdentity {scope:string;address:string;addresses:{binanceChainId:string;chainName:string;address:string}[]}
export interface AgentConfig {enabled:boolean;executionEnabled:boolean;autoFree:boolean;discoveryEnabled:boolean;socialEnabled:boolean;intervalMs:number;rpcConfigured:boolean;maxGasWei:string}
export interface AgentAction {id:string;seq:number;name:string;decision:string;requestId:string|null;txHash:string|null;riskSummary:string;detailJson:unknown;durationMs:number|null;createdAt:string}
export interface AgentRun {id:string;kind:string;status:string;trigger:string;summary:string;errorCode:string|null;errorMessage:string|null;candidateId:string|null;walletScope?:string|null;startedAt:string;finishedAt:string|null}
export interface SpendConfirmation {id:string;amount:string;asset:string;slippage:string;contractAddress:string;quote:unknown;expiresAt:string;consumedAt:string|null}
export interface AgentRunDetail extends AgentRun {actions:AgentAction[];confirmations:SpendConfirmation[];candidate:MintCandidate|null}
export interface MintCandidate {id:string;chainId:string;contractAddress:string;name:string|null;symbol:string|null;class:string;status:string;source:string;inputData:string;autoExecute:boolean;lastRunId:string|null;createdAt:string;updatedAt:string}
export interface ResearchBrief {id:string;runId:string;candidateId:string;chainId:string;contractAddress:string;symbol:string|null;riskLevel:string|null;liquidityUsd:string|null;top10Percent:string|null;auditAvailable:boolean;dynamicAvailable:boolean;bodyMd:string;evidenceJson:unknown;createdAt:string}
export interface AgentNotification {id:string;runId:string;message:string;createdAt:string;readAt:string|null}
export interface WalletMovement {direction:string;symbol:string;tokenAddress:string;amount:string|null;rawAmount:string|null;counterparty:string}
export interface WalletActivity {id:string;walletAddress:string;chainId:string;txHash:string;type:string;providerType:string;status:string;txTime:string|null;movements:WalletMovement[];networkFee:{symbol:string;tokenAddress:string;rawAmount:string;decimals:number|null};source:string;fetchedAt:string;runIds:string[]}
export interface ActivityPage {walletAddress:string;walletScope:string;source:string;items:WalletActivity[];nextCursor:string|null}
export interface HistorySync {walletAddress:string;imported:number;observed:number;hasMore:boolean;nextCursor:string|null;fetchedAt:string}
export interface RunPage {walletScope:string;items:AgentRun[];nextCursor:string|null}
export interface CandidateInput {chainId:string;contractAddress:string;class:string;name:string;symbol:string;inputData:string;autoExecute:boolean}
