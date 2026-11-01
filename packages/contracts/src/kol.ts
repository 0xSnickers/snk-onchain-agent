export type KolCategory = 'DAILY' | 'MEME' | 'AIRDROP';
export interface KolPost {
  id:string; kolId:string; postId:string; text:string; authorId:string; authorHandle:string;
  postedAt:string|null; likes:number|null; reposts:number|null; replies:number|null; fetchedAt:string;
}
export interface KolTimeline {
  source:'xapi.to'; kolId:string; posts:KolPost[]; nextCursor:string|null; lastSyncedAt:string|null; error:string|null;
}
export interface KolSyncResult { source:'xapi.to'; imported:number; fetchedAt:string }
