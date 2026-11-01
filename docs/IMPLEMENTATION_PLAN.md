# 实现方案 · 2026-10-27

## 目标与当前交付

建立以你本机钱包为入口的链上研究工作台：资产观察、链上市场数据、X 关注账号的公开信息，以及可以回溯到原文/链上记录的研究信号。优先 BNB Chain，预留 Ethereum / Base / Solana 等网络。当前完成阶段 1，且已完成本机钱包扫码连接及真实地址/余额联调；后续模块边界已经明确，已实现受门禁约束的 Mint 和标准 DEX 买入代码，默认关闭真实广播。

| 能力 | 当前状态 | 后续动作 |
|---|---|---|
| React + Nest + PostgreSQL 本地启动 | 已实现与验证 | 保持脚本和迁移可复现 |
| 本机钱包 CLI 桥接 | 已实现；扫码授权、CONNECTED、地址/余额联调通过 | 完善会话到期与刷新交互 |
| DEX 交易对公开数据 | 已实现适配；本机外部请求失败 | 恢复外网后验收真实响应，加入快照 |
| KOL 手动名单与备注 | 已实现、持久化验证 | 支持批量导入及标签 |
| 你的 X 关注列表与推文 | 待实现、未授权 | 确认 X 身份与 API 访问，完成 OAuth |
| 合约提取、跨源信号、提醒 | 待实现 | 在原始采集稳定后开发 |

## 1. 继承参考项目的架构

参考项目采用 web / server / sdk 三个独立项目。沿用 React 19 + Vite + Router + TanStack Query + Axios + i18n + Zustand + shadcn/ui，以及 NestJS + Prisma + PostgreSQL。

本项目的 `packages/contracts` 对应共享契约职责，而监控 SDK 的事件上报不属于本轮业务。React 页面只做组合，组件承担交互，hooks 管理 Query 缓存，API 文件只用唯一 HTTP client。Nest 控制器校验入参，service 处理规则，repository 负责持久化，provider 负责外部数据源。后续大型模块使用 `web/src/features/<domain>` 聚合内部实现，避免跨业务深层引用。

初版数据库仅存 Kol；v0.2 已增加候选、运行、动作、简报、确认、通知、执行租约和钱包历史。market 的缓存不作为历史记录，钱包资产查询不落盘。后台 worker、Redis 和消息队列暂不引入；第一轮采集由单实例调度器与 PostgreSQL Job 表完成，以数据量决定是否拆分 worker。

## 2. Binance Agentic Wallet

使用本机安装的 `binance-agentic-wallet` skill 与官方 `baw` CLI，不把 skill Markdown 当成应用 SDK。CLI 登录态归属于当前 OS 用户；以后远端部署必须用运行服务的独立用户重新登录，本机凭证不会自动传到服务器。

已完成：

1. 检查 CLI 版本与 wallet status。
2. 点击 `Sign in to my Agentic Wallet` 发起 signin，展示原样 pairingCode 和官方 urlForWeb。
3. 服务端持续运行 verify；用户在 Binance App 核对码并批准。
4. UI 轮询 status，以 CONNECTED 为准，再查 addresses / balances / chains / sessionExpireTime。
5. 前端仅获得字段投影，不保存 token、不接收原始 settings、不暴露任意命令入口。

联调验收：真实未登录 → 扫码 → verify 完成 → CONNECTED → 地址/余额显示；拒绝、过期、断网、重新登录均有明确状态；到期前提示与到期后的缓存清理加入下一轮。当前页面每 15 秒检查状态，钱包数据 30 秒 staleTime；后续增加可见性自适应刷新，减少 CLI 调用。

若未来增加 quote / swap / transfer，独立建 `execution` 模块：报价/预览 → 展示代币完整合约、金额、费用和风险 → 用户明确确认 → 执行 → 交易哈希追踪。每项执行遵守 wallet skill 对应命令参考和安全检查；条件订单不得降级为即刻市价交易。当前 API 无交易入口。

## 3. 链上数据采集

第一步已接 DEX Screener 搜索接口：网络、DEX、代币完整合约、交易对、USD 价格、24h 量、涨跌和流动性；结果有 source 与 fetchedAt。该接口返回有限搜索集合，不能当成全市场榜单。

下一阶段：

- `watchlists`：按 `(chainId, tokenAddress)` 保存代币观察项，不能只按 symbol 去重。
- `collectors`：每 1–5 分钟对关注代币采集，支持 backoff、429 Retry-After、超时、任务幂等和失败重试；不做无限全量扫描。
- `market_snapshots`：保存 provider、observedAt、fetchedAt、token/pair、price、volume、liquidity，Decimal 储存数值，唯一键抑制重复。
- `wallet_snapshots`：只在用户启用时保存资产快照，用于净值曲线与资产变化；避免把充值算作投资收益。
- `rpc` adapter：按实际使用链配置 RPC，抓 block height、gas、选定地址转账和合约事件；EVM 与 Solana 用不同 adapter。记录 block/tx/logIndex、确认数，处理重组；浏览器不直接携带 RPC 密钥。

首轮不把付费的索引/风控供应商硬塞进来。确认数据覆盖和频率后，再比较 Binance public APIs、Etherscan、Alchemy、Helius 或其他 provider 的实际权限、限流与成本。

官方文档：[DEX Screener API reference](https://docs.dexscreener.com/api/reference)。

## 4. X 关注 KOL 与内容

目前只保存你手动添加的用户名、备注和原主页链接，未获取你的 X 身份或关注名单。拥有钱包登录态不等于获得 X 授权。

推荐流程：

1. 新建 `x-connection` 模块，采用用户授权的 OAuth 2.0 PKCE；回调校验 state 和一次性授权，scope 根据实际读取端点要求最小化申请。
2. 读取授权用户身份；分页获取 `GET /2/users/{id}/following`，关注账号先导入候选区，再由你标记研究 KOL。关注列表不等于全部为 KOL。
3. 为选中的账号采集 `GET /2/users/{id}/tweets`，使用 since_id 增量、分页 token、限流预算、指数退避与检查点。
4. 保存原始 post ID、作者 ID、时间、文本、原文 URL、转推/引用关系、采集时间；账号更名依赖稳定的 user ID 跟踪。
5. UI 展示时间线，按账号/关键词/链筛选，有来源链接和同步错误，允许停用/移除采集及清理数据。

`X_BEARER_TOKEN` / `X_USER_ID` 仅为当前配置预留，不代表所有用户级端点均可用，也不代替 OAuth。具体 endpoint 的认证、可见性、额度与计费以开发者控制台和当时文档为准；实现采集前设置请求预算。无需把 key 或登录 cookie 发到聊天中，写入本机服务端环境文件即可。

若暂不使用 X API，可先手工维护用户名，后续支持用户导出的关注列表 CSV/JSON 导入。不会绕过账号权限抓取私有内容。

官方文档：[Following](https://docs.x.com/x-api/users/get-following)、[User posts](https://docs.x.com/x-api/users/get-posts)。

## 5. 研究信号与证据

在采集稳定后增加 `signals`：从文本中提取合约候选 → 按链校验 → 查询 provider 确认 → 与观察代币关联。符号相同、EVM 地址相同但链不同都不能自动合并。

每条信号保存原文 ID、作者、提取方式/版本、合约、链、快照 ID、生成时间与置信信息。区分“账号提及”“链上价格/流动性变化”“实际链上地址行为”；KOL 说买入不代表已链上验证。先做规则匹配与来源展示，确有需求后再引入 LLM 摘要。推文与链上元数据只作为不可信内容输入，不能触发钱包执行或读取凭证。

提醒规则首轮可做“关注代币被多个观察账号提及”“交易量/流动性阈值变化”“关注地址转账”。先提供站内通知；外部推送渠道和接收者由用户配置后实现。

## 6. 表设计与模块演进

| 模块 | 计划实体 | 关键约束 |
|---|---|---|
| wallet | WalletSnapshot / BalanceSnapshot | provider + wallet + chain + sampledAt；敏感信息最少化 |
| market | TokenWatch / Pair / MarketSnapshot | chain+contract、source+timestamp；数值用 Decimal |
| social | XConnection / Kol / Post / FollowingSync | 稳定 userId/postId 唯一，OAuth token 加密 |
| collectors | CollectionJob / SyncCursor | 幂等键、租约、状态、失败原因、下一次执行时间 |
| signals | Mention / Signal / Evidence | 证据外键、规则版本、跨链不混合 |

新表必须附迁移与 repository 测试；采集调度与 HTTP 请求生命周期分离。任务租约保证服务重启可继续，外部失败不得写成成功的空结果。

## 7. 里程碑与验收

- M1 本轮：可启动工作台 + 独立 DB + 钱包桥接 + 市场适配 + 手动 KOL；检查与本地 CRUD 完成，外部联调列出实际阻塞。
- M2：网络恢复后完成真实扫码/余额、DEX 响应验证；增加来源健康度、最后成功时间和限流。
- M3：确定 X 账号与 API 授权方式，完成关注列表分页导入、选中 KOL 的增量推文采集；能够从 UI 追溯原文。
- M4：关注代币快照、采集作业和研究信号；重启继续、重试幂等、数据时间线与站内提醒。
- M5 按需求：远端部署前增加应用账号认证、用户隔离、CSRF、HTTPS、token 加密和审计；钱包执行独立评审与逐次确认。

本机钱包扫码与真实资产查询已完成。下一步补齐市场 provider 外网访问及 X 的账号身份/API 授权。当前不需要提供私钥、助记词或钱包会话 token。

## 8. 打新监控与 Agent 运行日志（设计稿）

链上「0 元免费 Mint 自动执行 / 付费只投研不扣款」规则、与 `baw` preview→execute 门禁、以及 AgentRun/AgentAction 运行记录落库方案，见独立文档：

- [MINT_MONITOR_AGENT.md](./MINT_MONITOR_AGENT.md)

v0.2 已落地运行日志、候选、投研、执行门禁和页面，API/迁移/CLI 白名单均已同步；默认真实执行关闭。当前钱包的实际交易与 Mint 历史已在 `/activity` 展示。

## v0.3 本轮落地（2026-10-28）

市场范围收敛到 SOL / BNB Chain。以 GMGN 读取热门集合与OHLCV，以 DEX Screener 搜索定位合约；TradingView Lightweight Charts作为展示层。业务分provider→service缓存→controller/DTO，共享领域类型同步维护。桌面市场列表与图表并排，窄屏堆叠。

KOL监控新增xapi.to读取公开资料/推文，替代此前必须先做X官方OAuth的首轮方案；个人following导入和官方OAuth仍是独立后续能力。本轮手动同步、分页、稳定userId与原文证据、事务去重/检查点、失败保留与费用冷却。定时任务后续按用户配置预算启用；XAPI_KEY缺失时不伪装已接通。

统一六位小数只改显示格式，使用十进制字符串+BigInt舍入避免大数量浮点损失；保留精确源值供核对，不修改用户输入或执行参数。

官方依据：[DEX Screener](https://docs.dexscreener.com/api/reference)、[GMGN market](https://github.com/GMGNAI/gmgn-skills/blob/main/skills/gmgn-market/SKILL.md)、[TradingView](https://tradingview.github.io/lightweight-charts/)、[xapi.to Twitter](https://github.com/xapi-labs/xapi-cli/blob/main/skills/xapi/guides/twitter.md)。

## MINI 显示与 KOL 名称

全站使用统一MINI密度：缩小导航、标题、卡片及间距，折叠次要信息，保留完整执行确认/输入与错误。市场列表单行约40px，使用web/public/solana.png与binance.png作为链图标；完整合约/流动性/成交量仍在选中图表的数据详情可查看。KOL昵称持久化，名单直接选择联动动态；桌面主内容区滚动、名单sticky，窄屏使用自然文档滚动与横向账号条，避免嵌套列表锁住滚轮。

## 页面初始化与图片（2026-10-28）

所有路由懒加载、首次查询统一使用 LoadingState 骨架屏；后台刷新保留已有内容，失败单独展示错误。初始 HTML 提供启动提示，侧栏不随路由加载消失。钱包未连接时不等待被禁用的资产查询。

KOL 添加/编辑通过 Dialog 完成，支持 Escape 关闭并恢复触发按钮焦点。公开头像在手动同步时补齐；市场列表使用真实代币图片，失败显示简称。

KOL 动态每页显示 10 条，分页使用当前缓存（接口最多返回最近 100 条），不触发 xapi.to 付费请求；采集更多仍须手动点击“采集下一页”。切换账号回到第一页，末页不足 10 条按实际显示。

## BNB Agent 发射盘（2026-10-28）

参考用户指定的TMTN（Flap Agent Reader、Four Agent ID模板、gang.fun老盘与V2），市场页默认进入BNB Agent视图，分新创建/即将发射/已迁移三列，原有SOL/BNB热门与搜索保留为独立视图。用户确认AI范围为Agent专属盘，并非名字中含AI或泛AI题材。

新增controller→AgentLaunchService→HTTP/RPC providers的完整只读流程；共享领域声明、DTO及接口/供应商/组件测试同步维护。四个来源并行、有界采样、请求合并、30秒缓存、60秒前端刷新；失败按来源呈现，全部失败返回502。预测Token与市场合约分开显示，不生成内盘价格/K线。每个Token可核对完整地址和筛选依据，已迁移Token延用GMGN蜡烛图。可配置独立市场RPC，不打开任何执行权限。

参考：[TMTN](https://github.com/bnbxcs/TMTN)、[Agent Reader](https://github.com/bnbxcs/TMTN/blob/main/engine/live/agentCurve.js)、[Four Agent模板](https://github.com/bnbxcs/TMTN/blob/main/engine/live/fourMeme.js)、[Gang公开列表](https://github.com/bnbxcs/TMTN/blob/main/engine/live/gangFun.js)。

## v0.4 检测与执行委托（2026-10-29）

P1：w1/w2角色绑定、120秒心跳/暂停、离线通知、钱包分区查询和前端缓存。P2：CandidateOutbox持久化、角色/scope/有效期校验、原子领取、UNKNOWN不重放、回执核实、事务结果投影与账本同步。P3：本机配置登记驱动的external-fair-mint Provider，复用RPC价格字段与新鲜holder证据，不声称任意站点全网抓取。已有发射盘与meme-rush可按开关入同一队列。P4：精确付费意图绑定w2、领取时消费、订单终态报告/交易回执、钱包分区成交投影；本机继续不报价/广播。

新增迁移、共享类型、API、看板、loopback适配命令与隔离数据库smoke。实际Grok Bot两独立会话、例程和真实站外登记源需在外部环境配置后联调；仓库测试使用夹具，不能代表主网执行通过。详见[执行手册](./EXECUTOR_RUNBOOK.md)。

## v0.5 动态钱包（2026-10-30）

执行端不再限制w1/w2：新增label/role/isDefault及迁移、动态登记/编辑API与看板、角色默认路由、明确付费钱包选择。MONITOR仅监控，连接/暂停与执行权限分开；旧任务不因默认变化或离线而转移。动态CLI及登记文件导入沿用loopback与独立会话边界。数据库锁及唯一约束防默认冲突；未完成/未知任务阻止改角色。共享类型、API契约、组件及隔离数据库smoke同步更新。

## 狙击手（2026-11-01）

对照 [agentid-sniper](https://github.com/nancyc0813-maker/agentid-sniper) 的监视规则，增加 `/sniper`。参考项目在本机扫 BSC 新合约 bytecode 是否引用 Agent ID 登记合约，并用进度、Agent ID 付费钱包数、上限、资金留存和开池状态决定是否用 baw 自动铸造和止盈。本仓库只接 Four.meme `openfour.meme.AgentIdExclusive` 的有界榜单和手动合约的可选 bytecode 核对，不扫全区块、不学别人的 calldata、不自动卖出、不发 Telegram。免费只通知；付费未知项保持观察；总开关默认关闭；确认文案匹配后只记录 USDT 意图，不广播。
