# 链上打新与投研 Agent · 实现方案

> 日期：2026-10-27  
> 状态：v0.2 已实现；默认关闭真实广播，主网执行须另行配置与验收  
> 适用范围：`snk-onchain-agent` 本机 companion；对接 Binance Agentic Wallet（`baw`）运行记录与日志  
> 相关文档：[IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) · [API_CONTRACT.md](./API_CONTRACT.md) · [MULTI_WALLET_DETECTION_EXECUTION.md](./MULTI_WALLET_DETECTION_EXECUTION.md)

---

## v0.2 落地说明

已实现数据库模型、钱包分区运行日志、候选管理、官方技能投研、RPC 零价核实与预演门禁、付费两阶段确认、原子确认消费、数据库互斥、定时扫描、回执/订单核对、站内通知及页面。`/activity` 额外同步原生钱包交易与 Mint 历史；`/mint` 管理候选与简报。

本轮已读取真实钱包历史，但没有为了开发验收广播主网交易。执行路径由隔离夹具测试，确认并发/日志脱敏/钱包隔离/历史去重由 PostgreSQL smoke 验证。默认 RPC 未配置，真实执行、自动免费 Mint 和定时扫描关闭。

相对原稿的保守实现：未知价格或接受非零 value 的合约仅研究；广播前消费确认；BROADCASTED 先记 SUBMITTED；回执成功才记 MINTED；重启使预演失效；结果未知不重放。标准 DEX 买入不替代 Agent ID 特殊内盘路由。App 待批准且没有可绑定 txHash 时持续显示等待，不猜测已成功。

下文原稿作为设计背景保留，实际接口和开关以 API_CONTRACT.md 的 v0.2 节为准。

## 1. 目标

在现有「钱包桥接 + 市场观察 + KOL 名单」工作台上，增加一条**可审计、可回放**的打新流水线：

1. **0 元免费 Mint（全自动白嫖）**  
   链上核实 Mint 价格严格为 `0`（仅正常 Gas）→ `contract-call preview` 官方沙箱预演 → 无恶意扣款、无多余授权 → `execute` → 回写交易哈希与运行日志。
2. **付费打新（严禁私自扣款）**  
   只做投研：`query-token-audit` + `query-token-info` + X/社媒热度与团队背景检索 → 输出精简投研简报。  
   **只有**用户明确回复「确认买入 XX 金额」后，才允许进入买入执行链路。

本方案不把 LLM 聊天记录当账本；**一切可执行动作以服务端 `AgentRun` / `AgentAction` 落库为准**，前端只展示投影后的状态与摘要。

---

## 2. 硬性规则（产品不变式）

| ID | 规则 | 失败时行为 |
|---|---|---|
| R1 | 免费路径：`value`（wei）必须为 `0`；合约侧 `mintPrice/price/cost` 等可读价格字段若存在且 `>0`，不得走自动 Mint | 标记 `REJECTED_NOT_FREE`，通知用户，不 preview/execute |
| R2 | 免费路径：必须先 `contract-call preview`，再 `execute`；无成功 `requestId` 不得 execute | 标记 `PREVIEW_FAILED` / `PREVIEW_RISKY`，放弃 |
| R3 | preview 返回风险项（`risks.riskDetails` / 地址风险 / `authorityChanges` 非空且含增权）或 `simulationCode` 非成功 → **立刻放弃** | 通知用户，写入日志，不 execute |
| R4 | 付费路径：**禁止**任何会扣本金币种的 `market-order` / `wallet send` / 非零 `value` 的 contract-call，除非存在用户本轮明确的「确认买入 XX 金额」指令记录 | 尝试执行则拒绝并记 `UNAUTHORIZED_SPEND` |
| R5 | 付费路径执行前必须已有：audit + token-info（至少 dynamic）+ 简报已推送且用户确认文本匹配 | 缺任一环节则拒绝 |
| R6 | 不记录、不回传 session token / clientId / 原始 CLI stdout；日志只存结构化字段与脱敏摘要 | 违反则视为缺陷 |
| R7 | `baw` 仅通过白名单 `execFile`；禁止 shell 拼接与任意命令 | 同现有 wallet 模块 |

**确认文案约定（付费）：**  
用户消息需可解析为：`确认买入` + 金额 + 可选代币符号/合约。  
示例：`确认买入 0.05 BNB`、`确认买入 10 USDT 到 0xabc...`。  
模糊确认（如「买一点」「随便买」）**不算**授权。

---

## 3. 与现有架构的衔接

```text
web/  Workspace
  └─ components/feature/
       MintMonitorPanel.tsx      # 候选、简报、运行时间线
       AgentRunPanel.tsx         # Agent Wallet 运行记录 / 日志

server/src/modules/
  wallet/          # 已有：status/signin/overview；扩展白名单命令
  market/          # 已有：DEX 搜索；可复用流动性展示
  kol/             # 已有：手动 KOL
  mint-monitor/    # 新增：发现 → 分类 → 调度
  research/        # 新增：audit / token-info / 社媒摘要 → Brief
  execution/       # 新增：preview →（门禁）→ execute；付费买入另轨
  agent-runs/      # 新增：运行记录、动作日志、通知投递

packages/contracts/
  mint-monitor.ts / agent-run.ts   # 前端响应类型
```

继承约束（见 `AGENTS.md`）：

- 本机单用户；不把钱包桥接暴露公网。
- 新业务单文件尽量 ≤300 行；先打通纵向流程再扩采集源。
- 外部失败与本地失败分开记，不以空数据掩盖错误。

---

## 4. 运行时状态机

### 4.1 候选项目 `MintCandidate`

```text
DISCOVERED
  → CLASSIFYING
      → FREE_ELIGIBLE          # 判定为 0 元 Mint
      → PAID_RESEARCH          # 需花钱 / 不确定 → 只投研
      → IGNORED                # 重复、已处理、不在监控范围
FREE_ELIGIBLE
  → PREVIEWING → PREVIEW_OK → EXECUTING → MINTED
                 ↘ PREVIEW_FAILED / PREVIEW_RISKY → ABORTED
PAID_RESEARCH
  → RESEARCHING → BRIEF_READY → AWAITING_USER
       ↘ 用户「确认买入 XX」→ BUY_PREVIEWING → BUY_EXECUTING → BOUGHT
       ↘ 用户拒绝 / 超时 → CLOSED
```

### 4.2 Agent 运行 `AgentRun`

一次扫描周期或一次用户触发 = 一条 `AgentRun`：

| 字段 | 说明 |
|---|---|
| id | UUID |
| kind | `SCAN` / `FREE_MINT` / `RESEARCH` / `PAID_BUY` |
| status | `RUNNING` / `SUCCEEDED` / `FAILED` / `ABORTED` |
| trigger | `SCHEDULE` / `USER` / `WEBHOOK` |
| startedAt / finishedAt | |
| summary | 短文本，可展示 |
| errorCode / errorMessage | 业务错误，非堆栈 |

其下挂多条 `AgentAction`（有序）：

| step | 典型 name | 允许的 baw / 外部调用 |
|---|---|---|
| 1 | `wallet.status` | `wallet status` |
| 2 | `onchain.price_check` | RPC/`cast` 或只读 eth_call（服务端 adapter） |
| 3 | `contract.preview` | `contract-call preview` |
| 4 | `gate.evaluate` | 纯本地规则引擎 |
| 5 | `contract.execute` | `contract-call execute`（仅 FREE 且门禁通过） |
| 6 | `audit.token` | query-token-audit HTTP |
| 7 | `info.token` | query-token-info CLI |
| 8 | `social.lookup` | X/网页检索（只读） |
| 9 | `brief.emit` | 写 Brief + 通知 |
| 10 | `notify.user` | 站内通知 |

每条 Action 记录：`requestId`（若有）、`txHash`（若有）、`decision`（`ALLOW`/`DENY`/`SKIP`）、`riskSummary`、`durationMs`、`createdAt`。  
**禁止**存完整 CLI 原始输出；preview 只存投影字段（parsedTx、value、to、risks 标题列表、balanceChanges 摘要）。

---

## 5. 免费 Mint 流水线（自动）

### 5.1 发现源（可插拔）

| Provider | 用途 | 备注 |
|---|---|---|
| `meme-rush`（BSC Open Four / Agent ID exclusive） | 打新代币雷达 | 多为**付费买币**，默认进投研轨，不进自动 Mint |
| 人工/配置的 Mint 合约列表 | NFT/活动免费 Mint | 首版主路径 |
| 后续：社区 Hub / 官方活动页解析 | 扩源 | 解析结果不可信，必须过 R1–R3 |

### 5.2 免费判定（链上，先于 preview）

对候选合约在目标链（首版 BSC `56`）执行只读检查：

1. 字节码非空。  
2. 尝试读取 `mintPrice` / `price` / `MINT_PRICE` / `cost` / `mintFee` 等；任一返回 `>0` → 非免费。  
3. 用用户地址 `eth_call` 模拟目标 calldata，**`value=0`** 必须成功（或明确可 mint）；`value=1 wei` 若反而成功且逻辑依赖付款，需人工复核（默认拒绝自动）。  
4. 估算 Gas；钱包原生币余额不足 Gas → `ABORTED_INSUFFICIENT_GAS`，不 execute。  
5. 确认 Developer Mode 已开启（`wallet settings` → `devMode.enabled`）；未开启则停止并提示用户在 App 打开。

### 5.3 Preview → Execute

扩展 `BawService` 白名单（仅下列命令，参数校验）：

```text
contract-call preview
  --binanceChainId <enum>
  --from <userAddress>
  --to <checksumAddress>
  --value 0                    # 免费路径硬编码 0，忽略调用方非零 value
  --inputData <0x-hex>

contract-call execute
  --requestId <from preview only>
```

门禁 `gate.evaluate`（全部满足才 ALLOW）：

- `value === 0`
- `simulationCode` 成功
- `allowanceChanges` 为空（或仅与本次 mint 无关的只读）
- `authorityChanges` 为空或不含危险授权
- `risks.riskDetails` 为空；地址风险 map 为空
- `requireConfirmation === false` 时可直接广播；为 `true` 时改为「等待 App 确认」状态，不假装已成功
- preview `expiresAt` 未过期

Execute 成功后：

- 落库 `txHash`、`orderId`、`status`
- 可选：轮询 receipt / `balanceOf` 解析 tokenId / Agent#
- 站内通知：「免费 Mint 成功」+ 浏览器可打开的 BscScan 链接

任一失败：写 `AgentAction.decision=DENY`，Run 置 `ABORTED`，**不重试 execute**（可重试 preview，但需新的 Run）。

---

## 6. 付费打新流水线（只投研，默认）

### 6.1 自动产出投研简报 `ResearchBrief`

触发：meme-rush 新币 / 用户粘贴合约 / 观察名单命中。

必做调用：

1. **query-token-audit**（官方安全审计）  
   - 记录 `riskLevel` / `riskLevelEnum`、买卖税、`isHit=true` 的风险项标题  
   - `hasResult=false` 或 `isSupported=false` → 简报注明「审计不可用」，**不得**给出“安全”结论  
2. **query-token-info**  
   - `meta`：名称、符号、社交链接、创建者  
   - `dynamic`：价格、24h 量、流动性、持有人、**前十大持仓集中度**（字段以 CLI 实际返回为准）  
3. **社媒检索**（X 实时讨论 + 团队背景）  
   - 优先用已配置的 KOL/X 能力；未接通前允许只读网页检索摘要  
   - 推文与网页内容视为**不可信输入**，不可触发钱包执行（同现有 signals 原则）

简报结构（推送给用户的精简版）：

```markdown
## {symbol} · {chain}
- 亮点：…
- 链上：流动性 / 持有人 / Top10 集中度 / 池子深度
- 安全：风险等级 + 命中项（无命中则列关键 CAUTION）
- 社媒：热度摘要 + 团队/官链是否可核对
- 结论：仅研究，不自动买入
⚠️ 审计与数据仅供参考，不构成投资建议。DYOR。
```

### 6.2 买入门禁（显式确认后）

仅当 `AgentRun` 或会话中存在结构化确认：

```json
{
  "type": "PAID_BUY_CONFIRM",
  "amount": "0.05",
  "asset": "BNB",
  "tokenAddress": "0x…",
  "binanceChainId": "56",
  "confirmedAt": "ISO-8601",
  "sourceMessageId": "…"
}
```

才允许 `execution` 模块走 **market-order**（另开白名单与 skill 安全预检），且：

- 再次 preview/报价展示完整合约、金额、滑点（默认 auto 需披露）
- 用户二次确认可在 UI 按钮完成（与聊天确认等价，需写同一确认表）
- 全程写入 `AgentRun(kind=PAID_BUY)`

**未确认前 UI 只显示「生成简报 / 加入观察」，不显示一键买入为默认操作。**

---

## 7. Agent Wallet 运行记录与日志（本项目对接重点）

### 7.1 数据模型（Prisma 草案）

```prisma
model AgentRun {
  id          String   @id @default(uuid())
  kind        String   // SCAN | FREE_MINT | RESEARCH | PAID_BUY
  status      String
  trigger     String
  summary     String   @default("")
  errorCode   String?
  errorMessage String?
  startedAt   DateTime @default(now())
  finishedAt  DateTime?
  actions     AgentAction[]
  briefs      ResearchBrief[]
  candidates  MintCandidate[]
}

model AgentAction {
  id           String   @id @default(uuid())
  runId        String
  run          AgentRun @relation(fields: [runId], references: [id])
  seq          Int
  name         String
  decision     String   // ALLOW | DENY | SKIP | INFO
  requestId    String?
  txHash       String?
  riskSummary  String   @default("")
  detailJson   Json     // 已投影、无密钥
  durationMs   Int?
  createdAt    DateTime @default(now())

  @@index([runId, seq])
  @@index([txHash])
}

model MintCandidate {
  id              String   @id @default(uuid())
  chainId         String
  contractAddress String
  symbol          String?
  name            String?
  class           String   // FREE_MINT | PAID_TOKEN | UNKNOWN
  status          String
  source          String
  lastRunId       String?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@unique([chainId, contractAddress])
}

model ResearchBrief {
  id              String   @id @default(uuid())
  runId           String?
  chainId         String
  contractAddress String
  symbol          String?
  riskLevel       String?
  liquidityUsd    Decimal? @db.Decimal(38, 18)
  top10Percent    Decimal? @db.Decimal(10, 4)
  bodyMd          String
  createdAt       DateTime @default(now())

  @@index([chainId, contractAddress, createdAt])
}

model UserSpendConfirm {
  id              String   @id @default(uuid())
  chainId         String
  contractAddress String
  amount          String
  asset           String
  sourceMessageId String?
  createdAt       DateTime @default(now())
  consumedAt      DateTime? // execute 成功后标记，防重放
}
```

### 7.2 日志文件与隐私

- 应用日志继续写 `logs/server.log`：只含 runId、action name、decision、errorCode。  
- **禁止**把 `baw` stdout 全文打进日志（现有 `BawService` 已遵守）。  
- DB 为运行记录 SSOT；`logs/` 仅运维排障。  
- UI「运行记录」页：按时间倒序展示 Run → 展开 Actions → 有 txHash 则外链区块浏览器。

### 7.3 API 草案（前缀 `/api/v1`，本机限制不变）

| Method / path | 说明 |
|---|---|
| GET `/agent/runs` | 分页列表：`{ items, nextCursor }` |
| GET `/agent/runs/:id` | Run + Actions 投影 |
| POST `/agent/scan` | 手动触发一轮 SCAN |
| GET `/mint/candidates` | 候选列表与状态 |
| GET `/research/briefs` | 简报列表 |
| POST `/research/briefs/:id/confirm-buy` | body: `{ amount, asset }` → 写 `UserSpendConfirm` 并启动 PAID_BUY Run |
| POST `/mint/free/:candidateId/retry` | 仅 FREE 且未成功时重跑 preview 流程 |

错误码增量：`NOT_FREE`、`PREVIEW_RISKY`、`DEV_MODE_OFF`、`UNAUTHORIZED_SPEND`、`CONFIRM_REQUIRED`、`CONFIRM_CONSUMED`。

---

## 8. 调度与并发

| 项 | 首版选择 |
|---|---|
| 调度 | Nest 进程内 `@Interval` 或 PostgreSQL Job 表（与 IMPLEMENTATION_PLAN collectors 一致） |
| 默认频率 | 可配置，建议 15–30 分钟；免费 Mint 发现可缩短至 5 分钟 |
| 并发 | 全局一把互斥锁：同时只跑 1 个 `FREE_MINT` execute；SCAN 可与 RESEARCH 并行只读 |
| 幂等 | `(chainId, contractAddress, kind)` 在冷却窗口内不重复自动 execute |
| 重启 | 进行中的 preview `requestId` 作废；Run 标 `FAILED`，需重新 preview |

环境变量（示例，写入 `.env.example`，不入库真值）：

```bash
MINT_MONITOR_ENABLED=true
MINT_MONITOR_INTERVAL_MS=1800000
MINT_MONITOR_CHAIN_IDS=56
BAW_PATH=baw
# Node 走系统代理时（若本机需要）：
# NODE_USE_ENV_PROXY=1
```

---

## 9. 前端交互

1. **Mint 监控面板**  
   - Tab：免费候选 / 投研简报 / 已完成  
   - 免费成功：突出 txHash  
   - 投研：展示简报 +「确认买入」表单（金额、支付资产）  
2. **Agent 运行日志面板**  
   - 对接 `GET /agent/runs`  
   - 与钱包状态并列，便于核对「当时是否 CONNECTED / DevMode」  
3. 文案：所有自动 Mint 成功通知带 DYOR；投研页固定免责声明。

---

## 10. 安全与威胁模型

| 威胁 | 缓解 |
|---|---|
| 假「免费」合约骗授权 | R1–R3；拒绝非空 allowance/authority；风险项即停 |
| Prompt 注入（代币名/推文） | 不可信内容边界；不据此改白名单或跳过确认 |
| 重放「确认买入」 | `UserSpendConfirm.consumedAt`；金额/合约绑定 |
| CLI 凭证泄漏 | 不落盘原始输出；前端零凭证 |
| 误把 meme 买币当免费 Mint | 分类器默认 PAID_RESEARCH；FREE 需链上价格证据 |
| Developer Mode 关闭仍执行 | preview 前检查 settings |

---

## 11. 里程碑

| 里程碑 | 交付 | 验收 |
|---|---|---|
| M-A | Prisma 模型 + `agent-runs` 只读 API + UI 时间线骨架 | 手工插入假 Run 可在 UI 看见；无密钥进日志 |
| M-B | 免费路径：价格核查 + preview 门禁 + execute + txHash 回写 | 用已知 0 元合约（或本地 fork 夹具）跑通；故意非 0 / 有风险时必停 |
| M-C | 付费路径：audit + token-info → Brief API/UI；无确认无法买入 | 缺确认调用买入接口返回 `CONFIRM_REQUIRED` |
| M-D | 调度 SCAN + meme-rush 发现源 + 通知 | 间隔触发有 Run 记录；失败可区分上游/本地 |
| M-E | 付费确认买入（market-order）+ 完整审计字段 | 仅在确认后出现 txHash；与 wallet skill 安全预检一致 |

---

## 12. 非目标（本方案明确不做）

- 全网无差别自动扫块打新。  
- 条件单静默降级为市价单。  
- 多用户远端托管私钥。  
- 把 X 推文或第三方列表的合约地址不经验证直接 execute。  
- 在聊天里索要助记词/私钥/session。

---

## 13. 与当前代码的改造清单（实现时）

1. `server/src/modules/wallet/baw.service.ts`：扩展 Command 联合类型与参数校验；保持禁止 log stdout。  
2. 新增 modules：`agent-runs`、`mint-monitor`、`research`、`execution`。  
3. `prisma/schema.prisma` + migration。  
4. `packages/contracts` 同步类型；`docs/API_CONTRACT.md` 增补接口表。  
5. `web`：`MintMonitorPanel`、`AgentRunPanel`；i18n 中英文案。  
6. `scripts/smoke.mjs`：增加 runs 列表与「未确认不能买」负向用例。  
7. `AGENTS.md` / `IMPLEMENTATION_PLAN.md`：增加指向本文档的链接与 M5 执行评审引用。

---

## 14. 首轮人工验收剧本

1. 钱包未登录 → SCAN 记失败 `WALLET_NOT_CONNECTED`，无 execute。  
2. DevMode 关闭 → 免费候选停在提示，无 preview。  
3. 合约 mint 价非 0 → `REJECTED_NOT_FREE`。  
4. preview 带风险 → `PREVIEW_RISKY`，无 txHash。  
5. 真·0 元 mint → preview OK → execute → UI 显示 txHash，BscScan 可查。  
6. 付费代币 → 仅 Brief；直接调买入 API → `CONFIRM_REQUIRED`。  
7. 用户提交「确认买入 0.01 BNB」→ 才允许报价/执行链路（另轮确认策略可在 UI 再点一次）。

---

**一句话：免费只打「链上证明为 0 + preview 干净」的；花钱只出简报，没你那句「确认买入 XX 金额」就绝不扣款；所有动作进 AgentRun 日志，供本工作台回放与对接。**
