export const KOL_CATEGORIES = [
  "DAILY",
  "MEME",
  "AIRDROP",
  "AGENT_WALLET_MINT",
] as const;

export type KolCategoryName = (typeof KOL_CATEGORIES)[number];
