# 共享 KOL 观察名单

X日常摘要与本应用的 KOL 页使用同一份观察名单。名单文件由 **Agent Wallet Manager** 写入；本应用只读，并在用户点击「从共享名单同步」时把账号 upsert 进本地 `Kol` 表。

## 路径

- 默认：`/home/box/.config/shared/x-mint-bloggers.json`
- 覆盖：服务端环境变量 `KOL_SHARED_WATCHLIST_PATH`（见 `server/.env.example`）
- 结构样例（占位 handle，不是线上名单）：[samples/x-mint-bloggers.sample.json](samples/x-mint-bloggers.sample.json)

schema：`agent-wallet-manager/x-mint-bloggers@1`。

## 分类

优先读取 `snkKolHint.categoryMap` 里指向 `DAILY` / `MEME` / `AIRDROP` / `AGENT_WALLET_MINT` 的项。未给出时：

| 文件键 | 标签 | 应用分类 |
|---|---|---|
| `daily` | 日常关注 | `DAILY` |
| `meme` | MEME | `MEME` |
| `airdrop` | 撸空投 | `AIRDROP` |
| `agent_wallet_mint` | Agent Wallet 打新 | `AGENT_WALLET_MINT` |

每条账号为 `{ handle, xUrl, notes, projects[] }`。`handle` 不含 `@`（带 `@` 也会去掉）。`projects` 不写入本库。

## 同步行为

`POST /api/v1/kols/sync-shared` 把这份 JSON 当作入库来源，不是唯一存档。

- 当前 `Kol` 行按小写 handle 创建或更新 category、note、profileUrl（来自合法 xUrl）、projects、账号 summary、`source=SHARED`
- 内容哈希变化时新增一份 `KolSharedReport`。`reportDate` 为 Asia/Shanghai 日历日：文件 `reportDate`/`date` 优先，否则由 `generatedAt`/`updatedAt` 换算，都没有时用入库时刻
- 快照保留每日总结（`dailySummary` / `summary` / `digest`）、分类 `highlights` / `actions`、账号备注和 status URL。文件里没有的字段留空
- 相同哈希不复制快照。文件后来变短或删掉某个 handle，已入库快照仍在
- 不删除 JSON 之外的手工账号，不改昵称、头像、已采集推文和 xapi 检查点，也不调用 xapi

`GET /api/v1/kols/reports` 从数据库按日期返回日报。观察页以此为主视图。实时推文在「原始推文」里，且 `XAPI_KEY` 为空时跳过，不阻断页面。

文件缺失或 schema 不对时返回明确错误，不会当成空名单成功。
