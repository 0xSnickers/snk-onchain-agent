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

`POST /api/v1/kols/sync-shared`：

- 按小写 handle 创建缺失行，或更新已有行的 category、note、`source=SHARED`
- 不删除 JSON 里没有的手工账号
- 不改昵称、头像、推文和 xapi 检查点
- 不调用 xapi；推文仍按账号手动同步。未配置 `XAPI_KEY` 时页面会说明原因，而不是显示空成功

文件缺失或 schema 不对时返回明确错误，不会当成空名单成功。
