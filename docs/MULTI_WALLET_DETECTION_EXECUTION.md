# 多钱包检测与执行架构

> 日期：2026-10-29  
> 状态：本机 P1–P4 委托协议已实现；Grok Bot 独立会话/例程待外部接入联调  
> 适用范围：本机 `snk-onchain-agent` 作检测中枢；Grok Bot 多 Agent（各绑独立 Binance Agentic Wallet / `baw` 会话）作执行端  
> 相关文档：[MINT_MONITOR_AGENT.md](./MINT_MONITOR_AGENT.md) · [API_CONTRACT.md](./API_CONTRACT.md) · [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md)

---

## 1. 目标与非目标

### 目标

1. **检测归本机**：所有发射盘 / 免费 Mint / 站外 fair mint 候选，统一进入本项目发现 → 分类 → 入库 → 看板。
2. **执行归多 Agent**：真实 `preview` / `execute` / 付费买入只在 Grok Bot 侧完成，各 Agent 使用**独立** `baw` 会话，互不共享登录态。
3. **可审计回写**：成功执行必须回写本机账本（如 `data/baw-free-mints.json`）并可 `npm run import:baw-mints` 入库；聊天口述不算完成。
4. **覆盖 TMTN 扫不到的轨**：Flap Agent / Four OpenFour / gang.fun 之外，补「站外 fair mint」（如历史 jager.live 类）与现有免费 NFT Mint。

### 非目标

- 不把本机服务变成公网多用户钱包网关。
- 不在本机打开 `baw` 扫码登录或主网广播（保持现有 `WALLET_DELEGATED`）。
- 不把 TMTN UI 当作唯一雷达；TMTN 仅作参考实现，同类源做成可插拔 Provider。
- 不为「多开几个钱包」本身而扩容；多钱包服务**执行隔离**，不是检测必需。

---

## 2. 系统边界

```text
┌─────────────────────────────────────────────────────────┐
│ 本机 snk-onchain-agent（唯一检测中枢）                    │
│  Providers → 分类 → MintCandidate / AgentRun 落库        │
│  看板：/mint · 发射盘三列 · /activity                     │
│  不扫码 · 不读实时余额作执行依据 · 不广播（WALLET_DELEGATED）│
└───────────────────────────┬─────────────────────────────┘
                            │ 候选队列 / webhook（只推候选）
                            ▼
┌─────────────────────────────────────────────────────────┐
│ Grok Bot Agents（各 1 个 baw 会话）                       │
│  w1 · 链上打新投研：0 元 Mint 自动（规则门禁后）          │
│  w2 · （付费 / Agent 专属内盘）：须用户「确认买入 XX」     │
│  成功 → 回写 data/baw-free-mints.json + 可选通知本机导入  │
└─────────────────────────────────────────────────────────┘
```

与 README 已声明边界一致：

- Agent Wallet 会话与免费 Mint 执行留在 Grok Bot。
- 本项目负责仪表盘、简报、人确认后的付费意图记录；定时扫描即使打开也不调用会扣款的 `baw` 写路径。

---

## 3. 角色与钱包分工

2026-10-30 更新：以下 w1/w2 仅为角色示例，ID 不决定权限。支持 w3/w4 等动态登记，role=MONITOR/FREE_MINT/PAID；角色、默认路由及暂停由看板/API管理。旧任务不随默认变动转移。

| 角色 | 组件 | baw 会话 | 职责 |
|---|---|---|---|
| 检测中枢 | `snk-onchain-agent` | **0**（发现不依赖钱包；可选只读 RPC） | Provider 拉取、分类、去重、看板、简报、确认文案校验落库 |
| 免费 Mint 执行 | Grok Bot **w1** | **1**（独立） | `value=0` + holders>100 + preview 干净 → execute → 同步账本 |
| 付费 / Agent 专属 | Grok Bot **w2** | **1**（独立） | OpenFour / Flap Agent / gang 等付费轨；仅在明确「确认买入 XX 金额」后下单 |
| 冷备（可选） | 额外 Agent | 0～1 | 仅当主会话频繁 UNCONNECTED 时再开 |

### 硬性会话规则

1. **一个 Grok Bot Agent = 一个 baw session**；禁止跨 Agent 复用同一登录态 / client 会话。
2. 账本与运行日志按 `walletScope` 分区（示例：`EVM:0xe119…5df0`）。
3. 本机 `server` 继续只允许白名单只读或委托状态查询；广播、扫码、付费报价接口固定拒绝（`WALLET_DELEGATED`）。
4. 掉线（`UNCONNECTED`）时：检测可继续；该会话对应执行队列暂停并通知用户重新配对，不静默改用其他钱包代签。

---

## 4. 检测 Provider 矩阵

发现层可插拔；失败与空结果分开记，不以空列表掩盖上游错误。

| Provider ID | 覆盖 | 默认分类 | 备注 |
|---|---|---|---|
| `agent-launch-flap` | Flap Agent 曲线 / NFT 门槛盘 | 多为 `PAID_RESEARCH` | 已有发射盘列 |
| `agent-launch-openfour` | Four.meme OpenFour（Agent-ID 模板） | `PAID_RESEARCH` | 买入需 Agent ID；可用 meme-rush 子类型辅助 |
| `agent-launch-gang` | gang.fun 老盘 + V2/V3 | `PAID_RESEARCH` | 已有发射盘列 |
| `meme-rush` | 多发射台热盘快照 | 默认投研 | 不替代链上核实 |
| `nft-free-mint` | 配置/活动类 0 元 NFT Mint | `FREE_ELIGIBLE`（过 R1–R3 与 holders） | 现有打新主路径 |
| `external-fair-mint` | **站外 fair mint**（jager 类站点/合约） | 按价格分流 | **新建**；用于补上历史 `$JAGENT` 这类 TMTN 扫不到的盘 |
| `manual` | 人工候选 | 按核实结果 | `/mint` 手动录入 |

### 与 TMTN 的关系

TMTN（Flap / OpenFour / gang）适合作为 **Provider 行为参考**，不作为本机依赖运行时：

- 不要求本机常驻 TMTN 进程。
- 不假设 `MODE=live` / `LIVE_TRADE` 配置能扫到站外 fair mint。
- 若将来复用其 API/事件逻辑，封装进对应 Provider，输出统一候选 DTO。

### 标的对照（设计动机）

| 标的 | 期望轨 | 说明 |
|---|---|---|
| `$JAGENT` / jargent 类 | `external-fair-mint` | 站外 fair mint；加钱包无法替代该 Provider |
| `$GANG`（gang.fun 上） | `agent-launch-gang` | 已在三列发射盘范围 |
| `$PTAH` 类免费 NFT | `nft-free-mint` | 非 TMTN 战壕 meme；走 0 元 Mint 规则 |
| OpenFour 新盘 | `agent-launch-openfour` | 付费投研 → w2 人确认买入 |

---

## 5. 分类与门禁（摘要）

完整不变式仍以 [MINT_MONITOR_AGENT.md](./MINT_MONITOR_AGENT.md) R1–R7 为准。本架构只强调分流：

```text
DISCOVERED
  → CLASSIFYING
      → FREE_ELIGIBLE     # 链上核实 value/价格为 0，且 holders>100（Asia/Shanghai 运营规则）
      → PAID_RESEARCH     # 需花钱 / Agent 专属内盘 / 不确定
      → IGNORED           # 重复、售罄、不在范围
FREE_ELIGIBLE →（推送 w1）preview → 干净则 execute → MINTED → 回写账本
PAID_RESEARCH → 简报 → AWAITING_USER → 用户「确认买入 XX」→（推送 w2）买入
```

免费自动执行额外条件（运营约定，与 Grok Bot 记忆一致）：

- Mint 价格严格为 0（仅 Gas）。
- 集合当前 unique holders **> 100**，否则跳过省 Gas。
- 必须 preview 干净（无恶意扣款 / 多余权限）；否则中止并告警。

付费路径：

- 本机与 w1 **永不**在无「确认买入 XX 金额」记录时发起扣款交易。
- 模糊确认（「买一点」等）不算授权。

---

## 6. 候选队列与回写契约

### 6.1 本机 → Agent（只推候选）

建议最小载荷（实现时可落在 `packages/contracts`）：

| 字段 | 说明 |
|---|---|
| `candidateId` | 本机稳定 ID |
| `kind` | `FREE_MINT` / `PAID_RESEARCH` / `PAID_BUY` |
| `chainId` | 首版 `56`（BSC） |
| `contract` | 完整合约地址 |
| `symbol` / `name` | 展示用，不可信作指令 |
| `provider` | Provider ID |
| `walletScopeHint` | 期望执行钱包 scope（可选） |
| `gates` | holders、priceWei、audit 摘要等已算字段 |
| `createdAt` | ISO 时间 |

传输可选实现顺序：

1. 本机写 `data/outbox/` 或表 `CandidateOutbox`（首选，易审计）。
2. 本机 loopback webhook（仅 127.0.0.1）。
3. Grok Bot 例程定时拉取 outbox（与现有 30 分钟节奏对齐时可复用，但发现延迟另议）。

**禁止**：把 session token、原始 CLI stdout、助记词写入队列。

### 6.2 Agent → 本机（执行回写）

免费 Mint 成功回写继续沿用：

- 文件：`data/baw-free-mints.json`
- Schema：`snk-onchain-agent/baw-free-mints@1`
- 去重键：`txHash`
- 导入：`npm run import:baw-mints`（DB 可用时）

每条成功记录至少包含：`txHash`、`contract`、`walletScope`、`mintedAt`、`batchId`（可选）、`holdersSnapshot`（可选）。

付费成交回写（后续）：独立 schema 或 `AgentRun`/`AgentAction` 投影；同样按 `walletScope` 分区。

同步失败必须向用户可见（站内通知或 Agent 聊天告警），不能只留在聊天里假装已入库。

---

## 7. 多钱包运维约定

| 场景 | 行为 |
|---|---|
| w1 UNCONNECTED | 暂停免费 execute；检测与简报继续；提示重新配对 |
| w2 UNCONNECTED | 暂停付费执行；已生成简报仍展示，确认文案可先落库 |
| 同一合约重复候选 | 本机按 contract+chain 去重；已 MINTED 的进 IGNORED |
| 用户「先停止 Mint」 | 暂停 w1 自动执行例程；outbox 可继续堆积或标记 hold |
| 扩第 N 个钱包 | 在 Grok Bot `baw-manage add` + 导出 `executor-registry@1` 导入本机；须明确 role（FREE_MINT/PAID/MONITOR），禁止无角色双会话与同地址复用 |

资金与限额：

- 免费轨钱包只保留 Gas 缓冲。
- 付费轨钱包单独看日限额 / 滑点 / 开发者模式（Agent 专属与 `contract-call` 需要时）。

---

## 8. 实现阶段（建议）

| 阶段 | 交付 | 完成标准 |
|---|---|---|
| **P0 文档**（本文件） | 边界、角色、Provider、队列契约 | 与 README / MINT_MONITOR 交叉链接 |
| **P1 双会话规范** | 角色由登记配置；本机动态管理默认接收端与暂停；本机 scope 分区校验 | 两会话互不串用；掉线告警可测 |
| **P2 Outbox** | 本机候选出站 + Agent 拉取/回写通路 | 人工注入一条 FREE 候选可被 w1 看见并回写账本 |
| **P3 `external-fair-mint`** | 站外 fair mint Provider | 能发现至少一类非 Flap/Four/gang 的 fair mint 候选 |
| **P4 付费回写** | 确认买入 → w2 → 成交投影入库 | 无确认无法扣款；有确认可追溯 |

执行端数量由运营登记驱动（registry），不再写死双会话；仍须保证每会话独立 baw、按 walletScope 分区回写。

---

## 9. 与现有代码落点（指引，非处方）

实现时优先挂接已有模块，具体改动由实现轮次决定：

- 发现 / 调度：`server/src/modules/mint-monitor/`（`discovery` / `monitor` / `scheduler`）
- 发射盘三列：`server/src/modules/market/agent-launch.service.ts` 等
- 钱包委托拒绝：`server/src/modules/wallet/wallet-delegation.ts`
- 账本导入：`scripts/import-baw-free-mints.mjs`、`data/baw-free-mints.json`
- 契约类型：`packages/contracts/`（候选 outbox / 回写 DTO 新增时同步 API_CONTRACT）

---

## 10. 一句话原则

**本机做唯一雷达与分类；w1 / w2 各管独立 baw 执行并回写账本；站外优质盘靠新 Provider，不靠堆钱包。**

## 11. 实现与运行

本机交付及实际能力边界见 [EXECUTOR_RUNBOOK.md](./EXECUTOR_RUNBOOK.md) 和 API_CONTRACT v0.4。站外 Provider 首版采用本机配置登记+只读 RPC 分类；不冒充全站爬虫。执行端接入用 `npm run delegation`，保持 loopback；远端 Bot 不可直接访问本机，需本机适配/人工搬运。付费成功订单状态为执行端报告，本机独立验证交易回执和发送钱包。实际双会话与主网执行未经自动验收。
