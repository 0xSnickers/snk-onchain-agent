# Codex 交接说明：Boltbook 符文石 + 多 Agentic Wallet

> 日期：2026-10-30（Asia/Shanghai）  
> 撰写方：Grok Bot `XM15_w1_AgentWallet · 链上打新投研`  
> 目的：因 Grok Bot **无法切换到 Codex 模型**，且本周额度约 **98.5%**（周六 10/31 15:33 Asia/Shanghai 重置），把当前可继续的任务状态交给 Cursor/Codex 接手。  
> 相关文档：[MULTI_WALLET_DETECTION_EXECUTION.md](./MULTI_WALLET_DETECTION_EXECUTION.md) · [MINT_MONITOR_AGENT.md](./MINT_MONITOR_AGENT.md) · [EXECUTOR_RUNBOOK.md](./EXECUTOR_RUNBOOK.md)

---

## 0. 重要边界（先读）

1. **Grok Bot 没有模型选择器**，不能把同一会话「切成 Codex」。Codex 需在 Cursor 侧另开 Agent/会话，用本文档 + 本机文件接续。
2. **打新 / 免费 Mint 已全面停止**（用户 2026-10-29 明确要求）：
   - 例程「币安生态打新监控」= **paused**
   - 禁止自动 preview / execute / 补打 readyPending
   - 付费买入须用户原文「确认买入 XX 金额」；当前也**不要主动推进**
3. **Boltbook 是游戏协作（符文石）**，不是打新 Mint；可继续，但会消耗 Grok Bot 额度。若额度紧张，优先在 Cursor/Codex 本机跑，或暂停 Grok 侧心跳例程。
4. **密钥**：Pod token / baw 登录态在 Grok Bot 沙箱 `/home/box/...`，**不要**把 `credentials.json` / `pod_token.json` 全文贴进聊天。本机若要接管，请用户从沙箱导出或在本机重新登录。

---

## 1. 钱包花名册（Multi Agentic Wallet）

| ID | Agent | EVM | Solana | Agent ID | baw | 角色 |
|---|---|---|---|---|---|---|
| **w1** | XM15_w1_AgentWallet | `0xE119136669eBbCfEE2e7192176f15771F0eb5dF0` | `6sPBpTB9dFFt1mWvRhHqP3rg2GEAcyjB3V7LT4cr2iLF` | `0xqiufeng.ai` | `baw-w1` | 免费 0 元 Mint（**现已停**）+ 协作 |
| **w2** | iPhone11_w2_AgentWallet | `0x31dae4B21a77404fd247E2eD14644f25aCB2f9D0` | `GWDqvNv2SRkD1va8r7rGvh9KaVh5CxzTZKWgUmjtBeoY` | `0xhammer.ai` | `baw-w2` | 付费（须「确认买入」） |
| **w3** | XM13_w3_AgentWallet | `0xe3F04BdE56c28695591a5a4F21507A082f935Ad2` | `J4kWcJe3KzLHXqVcut7sFA3grbGQwmsfCyiJVQJ3KM38` | `ajane.ai` | `baw-w3`（若未登记则需隔离建档） | 协作 / 冷备 |

Registry（Grok 沙箱）：`/home/box/.baw-profiles/registry.json`（schema `agent-wallet-manager/registry@2`）。  
**规则**：一 Agent = 一 baw 会话；禁止共享登录态。

### 免费 Mint 规则（恢复前勿执行）

- 价格严格 **0**（仅 gas）
- 系列 **unique holders > 100**
- 必须 **preview** 干净（无恶意扣款/额外授权）再 execute
- 成功后同步本机账本：`data/baw-free-mints.json`（schema `snk-onchain-agent/baw-free-mints@1`，按 `txHash` 去重，`walletScope` 如 `EVM:0xe119…5df0`）
- DB 可用时：`npm run import:baw-mints`

### 付费规则

- 先投研简报（audit + token info + X 讨论）
- **仅**用户明确回复「确认买入 XX 金额」后下单

---

## 2. Boltbook 当前快照（~17:09 Asia/Shanghai / 09:09 UTC）

权威快照文件（Grok 沙箱）：`/home/box/.config/boltbook/last_heartbeat.json`  
每钱包凭据目录：`/home/box/.config/boltbook/w{1,2,3}/`（`credentials.json` + `pod_token.json`）  
本机可参考技能/脚本：沙箱 `/workspace/boltbook-pod`、`mine.sh`、`tail.mjs`、`run-log.md`（若已同步）。

### 总览

| 钱包 | Forum | 状态 | Round | Bits | 协作进度 | 符文石 |
|---|---|---|---|---|---|---|
| w1 | 0xqiufeng | **forming**，已 ready，等 dadang13 | `#R-60ba7fa5…` / `0x60ba7fa5…` | 35 / tier7 | successes=6，short=**3**（冲第 3 石） | **#5603、#7901 已质押**，power=58 |
| w2 | 0xhammer | **relay**，等 frikey 交棒（已 voted_end） | `#R-0xb937acfe…` | 33 / tier7 | short=**2**（冲第 1 石） | 无 |
| w3 | ajane | **relay，我方挖棒** | `#R-0xc05e3a86…` | 35 / tier7 | successes=2，short=**1**（再成 1 局可 redeem 第 1 石） | 无 |

- solo ladder：**sold_out**（三钱包均是）
- 本轮：**无新 Mint、无 App 确认**
- 石 #7901 mint tx（已完成）：`0x8f913eaf655d24267a83b54b51760fdd2654d267f6c64dd1bb2986b17c70db79`

### w1 细节

- 队友：`pikabz.ai` / `0xqiufeng.ai` / `dadang13.ai`（index=1）
- ready：pikabz✓ qiufeng✓ dadang13✗ → 等 dadang13 确认；先前 alfiann 局超时已 rematch
- Pod token 到期：约 `2026-10-31T01:23Z`（≈ 11/01 09:23 Asia/Shanghai 前需续）
- 动作：lobby + post-forming watch 已挂（沙箱 PID 参考 last_heartbeat）

### w2 细节

- 队友：`matoranai.ai` / `frikey.ai` / `0xhammer.ai`（index=2）
- 答案：`5`；turn=1 在 frikey；prev_nonce=`10290005896785`
- 已 `voted_end`；对方交棒后我方再挖 33-bit
- Pod token 到期：约 `2026-10-30T15:49Z`（**可能已过期，接手先续登录**）

### w3 细节（最高优先级进行中）

- 队友：`vcing.ai` / `ajane.ai` / `yuamikami.ai`（index=1）
- 答案：`vela`；**当前我方 turn**，挖 **35-bit** baton
- prev_nonce=`110271346913`
- 进度约（17:09）：~449M tried / 期望 ~34360M；多线程矿机 + 自动 submit watcher
- 截止交棒：约 `2026-11-02T00:52Z`
- Pod token 到期：约 `2026-10-30T15:37Z`（**可能已过期，接手先续登录**）

### Baton 规则（摘要）

对 UTF-8 字符串：

```text
{roundId}:{index}:{answer}:{previousNonce}:{walletLowercase}:{nonce}
```

求 `keccak256` 前导零位数 ≥ bits 的十进制 nonce，然后 `POST /api/rounds/{roundId}/baton`。

---

## 3. Grok Bot 例程状态

| 例程 | 状态 | 调度（Asia/Shanghai） | 说明 |
|---|---|---|---|
| 币安生态打新监控 | **paused** | `*/30 * * * *` | 打新停用，勿 resume 除非用户明确说恢复 |
| Boltbook 符文石心跳 | **enabled** | `*/30 8-23 * * *` | 约每 30 分钟；额度紧张时可 pause 或改每小时 |

额度大户（本周）：本 Agent 的 Boltbook 心跳 + 打新监控（已停）+ Agent Wallet Manager 的「Boltbook 三钱包心跳」。

---

## 4. Codex / 本机接手建议清单

### A. 立即（Boltbook）

1. **续登录** w2、w3 Pod（token 可能已过期）；核对 w1 token。
2. **接管 w3 挖矿**：35-bit baton，答案 `vela`，prev_nonce 见上；挖到自动 POST baton。
3. **盯 w1 forming**：dadang13 ready → 阅读/答题 → 按 index 挖棒。
4. **盯 w2**：frikey 交棒后挖我方 33-bit（answer=`5`）。
5. w3 再成功 1 局 → redeem + 链上 mint 协作石第 1 枚（preview value=0 → execute → 记 tx）。
6. 新石是否质押挖 RUNE：问用户一次；当前 w1 的 #5603+#7901 **已质押**。

### B. 打新（默认不动）

- 保持监控 paused；不要 preview/execute。
- 用户说「恢复打新」后再按 §1 规则。

### C. 本机工程

- 账本：`/Users/chuizi/josen/0xSnickers/snk-onchain-agent/data/baw-free-mints.json`
- 架构：`docs/MULTI_WALLET_DETECTION_EXECUTION.md`
- 参考实现：GitHub `bnbxcs/TMTN`（本地 trenches；`LIVE_TRADE=1` 才真交易）

### D. 与 Grok Bot 并行注意

- 若 Codex 接管 Boltbook，**请用户暂停** Grok 侧「Boltbook 符文石心跳」及 Manager「三钱包心跳」，避免双开抢局 / 重复 mint。
- 不要两边同时对同一 round 交棒。

---

## 5. 近期已完成（免重复）

- 打新任务已停；例程 paused。
- TOSH 等付费路径已结束（历史）；AIDROP `registerForRewards` 预览为已注册，未广播。
- Boltbook：w1 第 2 枚协作石 **#7901** 已 mint 并质押；#5603 已质押。
- w3 协作成功 2/3，差 1 次铸第 1 石。

---

## 6. 用户偏好（Jay Stephen）

- 时区：Asia/Shanghai  
- 语言：zh-Hans  
- 打新：免费自动（现停）；付费须确认句  
- Boltbook：约每 30 分钟心跳；3 局成功后 mint；需 App 确认时通知  
- 成功免费 Mint 必须同步本机账本，不能只聊天汇报  

---

## 7. 交接检查清单（Codex 勾选）

- [ ] 已读本文 + `MULTI_WALLET_DETECTION_EXECUTION.md`
- [ ] 已确认用户是否 pause Grok Boltbook 例程
- [ ] w1/w2/w3 Pod 登录有效
- [ ] w3 35-bit 矿机在跑且能自动 submit
- [ ] w1/w2 watcher 或等价轮询在跑
- [ ] 打新仍保持停止，除非用户恢复
- [ ] 任何链上 mint：preview → 用户规则 → execute → 写账本

---

*本文件由 Grok Bot 按 2026-10-30 ~17:09 快照生成；接手后请以 `last_heartbeat.json` 或链上/API 实时状态为准。*
