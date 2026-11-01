export type KolCategory = 'DAILY' | 'MEME' | 'AIRDROP' | 'AGENT_WALLET_MINT';
export type KolSource = 'MANUAL' | 'SHARED';
export interface KolSharedSyncResult {
  created: number;
  updated: number;
  skipped: number;
  categories: Record<KolCategory, number>;
  report: { id: string; ingested: boolean; reportDate: string; entries: number };
}
export interface KolReportAccount {
  handle: string;
  note: string;
  summary: string;
  profileUrl: string | null;
  projects: string[];
  tweetUrls: string[];
}
export interface KolReportSection {
  category: string;
  label: string;
  summary: string;
  highlights: string[];
  actions: string[];
  accounts: KolReportAccount[];
}
export interface KolReportSnapshot {
  id: string;
  ingestedAt: string;
  generatedAt: string | null;
  summary: string;
  sections: KolReportSection[];
}
export interface KolReportDay {
  reportDate: string;
  earlierCount: number;
  latest: KolReportSnapshot;
  earlier: KolReportSnapshot[];
}
export interface KolReportList { days: KolReportDay[] }
export interface KolPost {
  id:string; kolId:string; postId:string; text:string; authorId:string; authorHandle:string;
  postedAt:string|null; likes:number|null; reposts:number|null; replies:number|null; fetchedAt:string;
}
export interface KolTimeline {
  source:'xapi.to'; kolId:string; posts:KolPost[]; nextCursor:string|null; lastSyncedAt:string|null; error:string|null;
}
export interface KolSyncResult {
  source:'xapi.to'; imported:number; fetchedAt:string; skipped?:boolean; reason?:string;
}
