# 打新账本（Binance Agentic Wallet 监控）

由 Grok Bot 侧「币安生态打新监控」写入/同步。本项目不连接 Agent Wallet 做自动执行；只读账本并可选导入 Postgres。

## 文件

- `baw-free-mints.json`：已成功的 **0 元免费 Mint** 记录（一笔 tx 一条）。
  - schema：`snk-onchain-agent/baw-free-mints@1`
  - 字段含 name / symbol / contractAddress / txHash / qty / mintedAt / batch / walletScope 等
  - 监控每轮成功 Mint 后按 `walletScope+chainId+txHash` 去重追加，并同步到本目录
- `nft-holders-result.json`：账本内各系列 **持有者人数**快照（BSC Transfer 重建；含 confidence / note）。按需刷新，不随每笔 Mint 强制更新。

## 入库（需 Postgres 已起）

```bash
npm run db:up   # 若库未起
npm run import:baw-mints
# 或预览：node scripts/import-baw-free-mints.mjs --dry-run
```

导入后会写入：

- `MintCandidate`（`class=FREE_MINT`, `status=MINTED`）
- `AgentRun` / `AgentAction`（带 `txHash`，trigger=`WEBHOOK`）
- `WalletActivity`（`type=MINT`，按 walletScope+chain+tx 去重）

可在工作台 [Mint 监控](http://127.0.0.1:5173/mint) 与 [Activity](http://127.0.0.1:5173/activity) 查看。

## 多钱包委托

每条成功记录优先使用自己的 walletScope / walletAddress，缺失时回退顶层默认钱包；两者必须匹配。mintedAt 必填，不填当前时间代替未知值。导入不推测 ERC721/数量/资产变化或预演结论。回写、角色绑定及 loopback 客户端见 [EXECUTOR_RUNBOOK.md](../docs/EXECUTOR_RUNBOOK.md)。本目录 JSON/出站文件不入库。


## 执行端登记（动态 N 钱包）

- `executor-registry.json`：由 Grok Bot `baw-manage export-snk` 写出，schema `snk-onchain-agent/executor-registry@1`。
- 导入：`node scripts/import-executor-registry.mjs`（服务需已起；`--dry-run` 可预览）。
- 每条含 id / walletScope / roles / enabled；本机映射为 `ExecutorSession.role`（FREE_MINT / PAID / MONITOR）。

## 共享 KOL 观察名单

不在本目录。Agent Wallet Manager 写入 Ubuntu 上的 `/home/box/.config/shared/x-mint-bloggers.json`（schema `agent-wallet-manager/x-mint-bloggers@1`）。本应用用 `KOL_SHARED_WATCHLIST_PATH` 只读它。`POST /api/v1/kols/sync-shared` 把账号、备注、链接和日报快照写入数据库，并保留每次内容变化；不删除文件外的手工账号，也不采集推文。观察页按上海日期读这些快照。

| 文件分类 | 标签 | 应用分类 |
|---|---|---|
| daily | 日常关注 | DAILY |
| meme | MEME | MEME |
| airdrop | 撸空投 | AIRDROP |
| agent_wallet_mint | Agent Wallet 打新 | AGENT_WALLET_MINT |

文件内 `snkKolHint.categoryMap` 的合法值优先于上表。样例见 [docs/samples/x-mint-bloggers.sample.json](../docs/samples/x-mint-bloggers.sample.json)，说明见 [KOL_SHARED_WATCHLIST.md](../docs/KOL_SHARED_WATCHLIST.md)。
