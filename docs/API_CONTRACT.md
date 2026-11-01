# API 契约 v0.2

前缀 `/api/v1`。成功 `{ code: 0, message: "OK", data }`；失败 `{ code: "ERROR_CODE", message, data: null }`。业务错误使用有意义 HTTP 状态。GET/DELETE 成功 200；POST 成功 201。仅支持本机单用户会话，CORS 不对外开放，Host/Origin 限制由 `setup-app.ts` 统一实现。

| Method / path | 输入 | data |
|---|---|---|
| GET /health | — | `{ status: "ok", database: "connected", mode }`；实际执行 SELECT 1 |
| GET /wallet/status | — | `{ status: "DELEGATED", login: null }`。不调用 baw |
| POST /wallet/signin | — | 409 `WALLET_DELEGATED`。不发起扫码 |
| GET /wallet/overview | — | 409 `WALLET_DELEGATED`。不读取 baw 会话 |
| GET /wallet/holdings | — | 账本地址的 BSC 链上余额：原生 BNB（可带 DexScreener 美元价）和账本合约的 `balanceOf`。零余额不返回。NFT 的 `valueUsd` 为 null。部分合约失败放在 `failures`，不把列表伪装成完整。若存在 `data/nft-holders-result.json`，按合约地址附上持有者人数、confidence 和快照时间；文件缺失或无法解析时这些字段为 null，不影响余额。 |
| GET /market/pairs | q: 1–80 字符，默认 BNB；chain 默认 bsc | `{ source, fetchedAt, query, chain, pairs }` |
| GET /kols | — | `{ accounts: Kol[], x: { configured, state: "READY" | "OPTIONAL" } }`。`OPTIONAL` 表示未配置 XAPI_KEY，列表和日报仍可用 |
| POST /kols | `{ handle, note? }` | Kol；相同 handle 更新备注，大小写不敏感 |
| DELETE /kols/:id | UUID | `{ removed: true }`，幂等 |

市场 `chain` 枚举：bsc / solana（BNB Chain / SOL）；其余值返回 400。市场值为空时返回 null，零值不等于缺失。USD 由前端格式化；币价未知的余额价值显示 `—`。

`Kol = { id, handle, note, createdAt }`。handle 为 1–15 位 ASCII 字母、数字、下划线；不含 @。note 最多 500 字符，默认空串；额外 body 字段拒绝。

Agent Wallet 会话留在 Grok Bot。`GET /wallet/status` 固定返回 `DELEGATED`，不调用 baw。`POST /wallet/signin`、`GET /wallet/overview`、`POST /wallet/activity/sync`、预演、报价和执行均返回 409 `WALLET_DELEGATED`。身份只读 `data/baw-free-mints.json` 的地址与 scope，缺失时 `GET /wallet/identity` 与活动列表返回 409 `LEDGER_MISSING`。

市场 pair：`{ chainId, dex, pairAddress, symbol, name, tokenAddress, quote, priceUsd, volume24h, liquidityUsd, change24h, url }`。完整合约地址用于核对，外链固定生成至 dexscreener.com；只取来源搜索集合中按流动性排序最多 15 项。缓存上限 100 个查询、TTL 60 秒、仅进程内。

## 错误

| code | HTTP | 触发 |
|---|---|---|
| VALIDATION_ERROR | 400 | DTO / UUID / 查询枚举不合法 |
| LOCAL_ONLY | 403 | 非本机 Host 或不允许的 Origin |
| WALLET_NOT_CONNECTED | 409 | 未连接时请求 overview |
| LOGIN_IN_PROGRESS | 409 | 已有 signin 请求处理中 |
| INVALID_PAIRING | 400 | verify 的内部配对 ID 不合法 |
| INVALID_LOGIN_URL | 502 | CLI 登录 URL 非预期官方 HTTPS 域名 |
| WALLET_UNAVAILABLE | 502 | baw 缺失、超时或非 JSON |
| provider 原始 name（如 NETWORK_ERROR） | 502 | CLI success=false，保留原始错误 message |
| MARKET_UPSTREAM_ERROR | 502 | DEX Screener 非 2xx |
| MARKET_UNAVAILABLE | 502 | DEX 网络或超时 |
| REQUEST_FAILED | 对应状态，未知为 500 | 非业务异常；内部细节不发前端 |

尚未实现的 X 授权和同步不注册假接口，`configured` 只表示环境配置存在，并不表示连接或采集成功。


## v0.2 当前钱包日志与 Mint/投研

| Method / path | 契约 |
|---|---|
| GET /wallet/identity | 当前 CONNECTED 钱包的 `{ scope, address, addresses }`，身份缓存最多 10 秒 |
| GET /wallet/activity | type=ALL/TRADE/MINT/TRANSFER/CONTRACT，cursor?=UUID；返回 `{ walletScope, walletAddress, source, items, nextCursor }`，每页 20 |
| POST /wallet/activity/sync | 409 `WALLET_DELEGATED`。流水只经 `npm run import:baw-mints` 入库 |
| GET /agent/config | 开关、间隔、Gas 预算与 rpcConfigured，不返回密钥或 RPC URL |
| GET /agent/runs | limit=1–50（默认 20），cursor?=UUID；返回当前钱包的 `{ walletScope, items, nextCursor }` |
| GET /agent/runs/:id | UUID；Run + 有序 Actions + 确认记录投影，隐藏执行 context；拒绝其他钱包的 Run |
| POST /agent/scan | 空 body，202 `{ id, status }`；后台执行并记录真实结果 |
| POST /agent/reconcile | 只读核对订单终态/回执，返回 `{ checked }` |
| GET /mint/candidates | 最近 100 个项目级候选 |
| POST /mint/candidates | chainId=56，完整非零 EVM contractAddress，name?/symbol?/class?/inputData?/autoExecute?；链+合约去重，重复添加不改写权限 |
| POST /mint/free/:id/retry | 重跑链上验证和预演，返回 Run；未知执行结果/已提交/已完成的候选不可重放 |
| POST /mint/:id/research | 生成真实审计/meta/dynamic/可选 X 数据的简报；缺失明确标注 |
| GET /research/briefs | 最近 50 份项目级简报 |
| POST /research/briefs/:id/confirm-buy | `{ amount, asset: BNB/USDT, slippage?: auto, confirmationText }`；确认文案严格等于 `确认买入 {amount} {asset}`，生成报价和确认记录，尚不 swap |
| POST /agent/runs/:id/execute | 免费 `{ confirmationText: "确认免费 Mint" }`；付费 `{ confirmationId }`；服务端按钱包/状态/有效期/风险/开关判断 |
| GET /agent/notifications | 当前钱包最近 50 条站内通知 |
| POST /agent/notifications/:id/read | UUID；`{ read: true }` |

日志以当前钱包地址规范化后的 scope 分区，前端 Query key 也包含 scope。历史以 `(walletScope, chainId, txHash)` 去重，返回原生 providerType、规范 type、链、状态、时间（未知为 null）、完整哈希、完整代币合约、精确资产数量、网络费/decimals、采集时间、关联 runIds。MINT 只取钱包明确给出的分类，不猜测普通合约调用。

来源 `BINANCE_AGENTIC_WALLET` 为真实钱包交易历史；AgentRun/AgentAction 为本项目运行记录。原生接口不是所有过去 CLI 调用的完整审计日志，页面明确标注此边界。候选和简报是本机项目级数据，运行和交易历史是钱包分区数据。

执行状态：AWAITING_CONFIRMATION → EXECUTING → SUBMITTED → SUCCEEDED/FAILED。SUBMITTED/BROADCASTED 不代表成功；免费须 receipt 成功、规范区块 hash 一致并有后续确认；付费须订单终态。App 待确认且没有 txHash 时保持等待，不猜测交易。执行中断/超时为 UNKNOWN，禁止自动重试。

默认关闭真实执行、自动免费 Mint、定时扫描、meme 发现和外部社媒查询。免费自动执行要求全局开关与候选 autoExecute 权限同时开启。链上验证需配置 BSC_RPC_URL；预演前要求 Developer Mode。启用广播须在新预演/报价前完成；重启使旧预演失效。

免费路径检查零价、零 value、代码、模拟、Gas、授权和资产变化。付费必须有可用且新鲜的简报与审计，并有报价绑定的逐次确认。确认在广播**之前**原子消费，防超时重放；执行前审计变化则 AUDIT_CHANGED，需重新报价确认。BSC Agent ID 特殊内盘路由不默默改走普通 market-order，而是明确拒绝并要求另行核实。

增量错误：RUN_NOT_FOUND/CANDIDATE_NOT_FOUND/BRIEF_NOT_FOUND（404）；CONFIRM_REQUIRED、CONFIRM_CONSUMED、EXECUTION_DISABLED、WALLET_CHANGED、AGENT_BUSY、CANDIDATE_BUSY、DEV_MODE_OFF、NOT_FREE、PRICE_UNVERIFIED、PRICE_AMBIGUOUS、PREVIEW_RISKY、PREVIEW_EXPIRED、RESEARCH_REQUIRED、TOKEN_HIGH_RISK、AUDIT_CHANGED、EXCLUSIVE_ROUTE_REQUIRES_REVIEW、RPC_NOT_CONFIGURED、RPC_CHAIN_MISMATCH、NOT_A_CONTRACT、GAS_LIMIT_EXCEEDED、ABORTED_INSUFFICIENT_GAS（409）；无效参数（400）；上游不可用/限流/CLI 非预期响应（502），不伪装成成功空列表。

### 登录配对恢复

`GET /wallet/status` 在已有未过期、WAITING 的新配对且旧会话查询失败时，返回 `{ status: "AUTHORIZING", login, statusError: { code, message } }`。AUTHORIZING 不表示 CONNECTED；错误字段明确保留上游失败，前端继续展示官方链接和配对码。无有效配对时仍按原 HTTP 错误返回，不伪装成未连接或空资产。登录成功后不等待旧状态刷新即可解除按钮 loading；用户点击时预留新标签页，成功后跳转原样官方 URL，浏览器拦截时提供显式链接。

## v0.3 SOL / BNB 市场与 KOL 公开推文

| 接口 | 输入 | 返回 |
|---|---|---|
| GET /market/tokens | chain=bsc/solana，默认 bsc | MemeMarket：source=GMGN、chain、interval=1h、fetchedAt、tokens |
| GET /market/kline | chain、完整 address、resolution=1m/5m/15m/1h/4h/1d，默认15m | MarketKline：source=GMGN、chain、address、resolution、fetchedAt、candles |
| GET /kols/:id/posts | UUID | source=xapi.to、kolId、posts（最近100）、nextCursor、lastSyncedAt、error |
| POST /kols/:id/sync | UUID，body={more?:boolean}，默认false | source=xapi.to、imported（本页观察条数，可能包含更新）、fetchedAt |

MemeToken 含 chain/address/symbol/name/priceUsd/changePercent/volumeUsd/liquidityUsd/marketCapUsd/holders/platform/url；涨跌和成交量为1h；`/market/pairs` 搜索仍为24h数据，页面分开标明窗口。榜单不限 MEME 标签。K 线包含 Unix 秒 time、open/high/low/close（USD）、volumeUsd；最多500根、时间升序去重，毫秒时间规范到秒，畸形OHLC报错，不填充虚构蜡烛。交易价格数据保留源精度。页面按数量级显示：不小于 0.000001 的价格最多 6 位小数并去掉尾随 0，更小的价格继续保留有效数字，不把非零价格收成 0.000000。

GMGN `market trending/kline --raw` 通过固定参数 execFile 执行，接收现有CLI的直接data及code/data格式；私钥不参与读取。缓存：tokens60秒，kline30秒，key含完整chain/address/resolution（SOL保留大小写），最多100项，同key在途请求合并、CLI串行。限流后按供应商reset时间或默认冷却阻止新请求，不自动重试失败调用。错误GMGN_NOT_CONFIGURED（409）、GMGN_RATE_LIMITED（429）、GMGN_UNAVAILABLE/GMGN_INVALID_RESPONSE（502）、INVALID_MARKET_ADDRESS（400）。DEX走支持本机环境代理的NetworkService，错误保留HTTP状态说明。

xapi.to仅调用官方能力网关 `https://action.xapi.to/v1/actions/execute` 的 `twitter.user_by_screen_name`、`twitter.user_tweets`，认证头读取服务端XAPI_KEY，不允许前端传任意action/URL。只采集选中账号本人公开推文，忽略其他作者的会话/转推条目，不导入个人关注列表。正文作为普通不可信文本展示，无钱包执行关联。posts含id/kolId/postId/text/authorId/authorHandle/postedAt/likes/reposts/replies/fetchedAt；未知时间/计数为null。先取稳定userId，本页upsert及账号检查点在同一事务提交，唯一键kolId+postId；删除KOL级联删除其推文。失败保留旧数据、记录error，不推进成功时间或分页cursor。每账号60秒冷却，单页最多200条、GET最近100条；未做后台调度。XAPI_NOT_CONFIGURED/KOL_SYNC_BUSY/KOL_NO_MORE（409）、KOL_SYNC_COOLDOWN（429）、KOL_NOT_FOUND（404），上游失败502，不返回伪成功空列表。

xapi.to Action 网关认证使用官方 CLI 对应的 `XAPI-Key` 头。网关可能以HTTP200返回 `{success:false,error:{code,...}}`；服务端显式映射为XAPI_AUTH_FAILED（409）、XAPI_QUOTA_EXCEEDED（402）、XAPI_RATE_LIMITED（429）或XAPI_UPSTREAM_ERROR（502），不误报成功或空数据，不向页面透传原始敏感错误字段。

### KOL 昵称

`Kol` 新增 `displayName: string | null`，来自 xapi.to profile 的 `name`，不使用示例或推测昵称。未知时前端回退handle。手动同步时对缺少昵称的账号补查profile；稳定userId不匹配时返回KOL_IDENTITY_CHANGED（409），拒绝将观察对象替换为被重新分配handle的账号。昵称与本页推文/成功检查点在同一事务更新，不在页面加载时触发付费profile调用。

### KOL 分类与编辑

`Kol` 的 category 为 DAILY/MEME/AIRDROP/AGENT_WALLET_MINT，默认 DAILY，分别展示为日常关注/MEME/撸空投/Agent Wallet 打新。POST /kols 支持 category；PATCH /kols/:id 接收 `{handle,category}`，返回公开 Kol 字段。重复 handle 返回 KOL_ALREADY_EXISTS（409）。修改分类保留昵称和推文；更换 handle 时清除旧身份和该条目的推文缓存，等待重新同步。UI 保存前显示该行为提示。编辑与同步落库使用同一行锁，旧 handle 的在途同步返回 KOL_CHANGED（409），不会把旧账号推文写到新账号。研究备注入口及展示移除；legacy note 字段仅为兼容保留，不用于分类。

`GET /kols` 的每条 Kol 还包含 `source`（`MANUAL` 或 `SHARED`）、`lastSyncedAt`（无成功同步时为 null）和 `syncError`（最近一次推文同步错误，无则为 null）。`source=SHARED` 表示该 handle 来自共享观察名单；手工添加且未被同 handle 覆盖的账号保持 `MANUAL`。

### 共享观察名单

`POST /kols/sync-shared` 无业务 body。读取 `KOL_SHARED_WATCHLIST_PATH`，未设置时默认 `/home/box/.config/shared/x-mint-bloggers.json`。文件 schema 必须为 `agent-wallet-manager/x-mint-bloggers@1`。分类优先用文件内 `snkKolHint.categoryMap` 的合法值，否则使用：

| 文件分类 | 应用分类 |
|---|---|
| daily | DAILY |
| meme | MEME |
| airdrop | AIRDROP |
| agent_wallet_mint | AGENT_WALLET_MINT |

账号对象为 `{ handle, xUrl, notes, projects[] }`。文件若另有这些字段，一并入库，没有则留空，不编造：顶层 `dailySummary` / `summary` / `digest`、`reportDate` 或 `date`（`YYYY-MM-DD`）、`generatedAt`、`updatedAt`；分类上的 `label`、`summary`、`highlights[]`、`actions[]` / `actionableNotes[]`；账号上的 `summary` / `highlight`、`tweetUrl` / `tweetUrls` / `statusUrl` / `postUrl`、`posts[].url`，以及 `projects` 里的 `https://x.com|twitter.com/{handle}/status/{id}`。handle 可带或不带 `@`，入库为小写且不含 `@`。按 handle 大小写不敏感 upsert 当前行：缺失则创建，已存在则更新 category、note、profileUrl、projects、账号 summary 和 `source=SHARED`。不删除文件里没有的账号，不改昵称、头像、已采集推文或 xapi 检查点，也不调用 xapi。

每次内容哈希变化都会新增一份快照（`KolSharedReport` + 分类段 + 账号行），旧快照保留。相同哈希只补当前行，不复制快照。`reportDate` 是 Asia/Shanghai 日历日：优先文件里的 `reportDate`/`date`，否则用 `generatedAt` 或 `updatedAt` 换算，都没有时用本次入库时刻。账号从文件消失不会抹掉已入库快照。

成功 201，data 为 `{ created, updated, skipped, categories, report }`。`report` 为 `{ id, ingested, reportDate, entries }`。`categories` 是四个应用分类下、文件中有效且唯一的账号数。`skipped` 包含非法 handle、与 xUrl 冲突、未知分类、文件内重复项，以及当前行已与文件一致的账号。文件缺失、不是普通文件或不可读：409 `SHARED_WATCHLIST_UNAVAILABLE`。JSON 非法、schema 不符或超过 500 条：409 `SHARED_WATCHLIST_INVALID`。不以空名单伪装成功。

`GET /kols/reports` 只读数据库，按 `reportDate` 倒序最多 30 个上海日。每天 `latest` 是该日最晚入库的快照，`earlier` 最多 5 份更早快照，`earlierCount` 是该日更早快照总数。快照含 `summary`（每日总结）和 `sections[]`（分类、要点 highlights、可执行备注 actions、账号 note / 出处链接）。不调用 xapi。

`POST /kols/:id/sync` 仍是可选的实时推文拉取。`XAPI_KEY` 未设置或只有空白时返回 200 `{ source:"xapi.to", imported:0, skipped:true, reason:"XAPI_OPTIONAL" }`，不写 `syncError`，不请求上游。配置了 key 之后的错误码不变。观察页不要求先配置该 key。

### 头像与代币图片

- `Kol.avatarUrl?: string | null`：xapi.to 公开资料头像。手动同步时补齐缺少的昵称/头像；更改账号会清除旧头像。
- `MemeToken.imageUrl?` / `MarketPair.imageUrl?`：GMGN `logo` / DexScreener `info.imageUrl`。仅保留 HTTPS 图片 URL。
- 图片由浏览器按需加载，不发送 Referer；缺图或失败回退简称，不以链图标代替代币图片。

## BNB Agent 专属发射盘（2026-10-28）

`GET /market/agent-launches?chain=bsc`：仅支持 BNB；其他 chain、额外参数返回400。
返回 `AgentLaunchMarket = { chain: bsc, scope: AGENT_LAUNCHPADS, coverage: BOUNDED_SAMPLE, fetchedAt, tokens, sources }`，领域类型见 `packages/contracts/src/launch.d.ts`，供前后端共享。

- `tokens` 含市场基础字段及 `source=FOUR_AGENT/FLAP_AGENT/GANG/GANG_V2`、`stage=NEW/FINALIZING/MIGRATED`、`progress`（0–100百分数或null）、`marketAddress`、`tokenDeployed`、`evidence`。按BNB完整合约小写去重；Four多个阶段重叠时保留已迁移优先、即将发射其次。价格/市值/数量未知为null，不虚构数据。涨跌/成交量如供应商提供，窗口为24h。
- AI范围由用户确认为TMTN的Agent专属盘，并非AI题材关键词：Four同时提交protocol2004及`openfour.meme.AgentIdExclusive`过滤，响应再次验证链/协议/模板/迁移状态；Flap只读TMTN所用Agent Reader登记；Gang读取Agent平台公开列表。
- Four通过Binance公共Pulse接口每阶段最多100项；Flap同一区块读取最近64个市场（16个一页）；Gang老盘/V2各读取最近100项。有限供应商采样，不表示完整历史或全链覆盖。Flap phase2或进度≥80%、Gang进度≥80%归FINALIZING；Four使用供应商阶段榜单。
- Flap内盘的predictedToken明确标为尚未部署，保留marketAddress，不拿市场合约当作Token。Reader未提供可靠USD指标时保持null；内盘不请求GMGN K线，迁移且已部署后允许查询GMGN。
- `sources[] = { source, status: OK/ERROR, count, error: null | {code,message} }`；部分失败HTTP200但明确标出来源错误，成功空采样仍为OK。全部失败HTTP502 `LAUNCH_UNAVAILABLE`。不透传RPC地址、供应商原始错误或敏感配置。
- 进程内缓存30秒，同一在途请求合并；前端每60秒刷新，失败保留旧数据显示刷新错误。来源并行；外部单次请求上限12秒，Flap整条读链上限25秒。`MARKET_BSC_RPC_URL`可覆盖市场只读RPC，未配置则使用BSC_RPC_URL或公共节点；每次校验chainId=56。该接口不依赖钱包，不触发报价/签名/交易。

## v0.4 多钱包检测与执行委托（2026-10-29）

本节覆盖前文同名接口的旧行为。`POST /agent/scan` 改为仅本机只读检测，HTTP202，返回 `{id,status,failures}`；本轮检测完成后返回，逐来源/逐候选动作入库，失败时 status=FAILED，不伪装成空成功。无需钱包或账本。`RESEARCH` 同样不依赖钱包。旧扫码、overview、原生同步、retry/preview、报价及execute接口仍409 WALLET_DELEGATED。

| 接口 | 输入 / data |
|---|---|
| GET /delegation/scans | 最近20条无钱包SCAN和有序动作，来源失败与空结果分开展示 |
| GET /delegation/sessions | 执行端数组，id 动态、role=MONITOR/FREE_MINT/PAID、label、isDefault、walletScope、state、paused、heartbeatAt、online |
| POST /delegation/sessions/:id | `{walletScope,state:CONNECTED/UNCONNECTED,paused?}`；id 须已注册（`POST /delegation/executors`）；scope 完整小写 EVM；绑定后不可改绑；地址全局唯一。普通心跳保留 paused。在线判定120秒 |
| POST /delegation/executors | 注册执行端 `{id,walletScope,role,label?,isDefault?}` |
| PATCH /delegation/executors/:id | 更新 label/role/isDefault/paused |
| GET /delegation/outbox | executorId?=动态 id；最近100条；返回 CandidateOutbox，不返回claimToken。超时任务进入UNKNOWN且通知，不重新排队 |
| POST /delegation/candidates/:id/queue | UUID；只读RPC分类后按角色/钱包生成出站项；零价、显式FREE_MINT、非空calldata、可信新鲜holders>100才FREE_MINT，否则PAID_RESEARCH；失败明确报错 |
| POST /delegation/briefs/:id/confirm-buy | `{walletScope,amount,asset:BNB/USDT,slippage?:auto,confirmationText}`；文案严格 `确认买入 {amount} {asset}`，金额>0，绑定默认 PAID 执行端（或请求里的 walletScope），要求15分钟内可用审计/dynamic且severity<4；创建5分钟PAID_BUY意图，无报价/广播。相同意图幂等；已消费/不同意图拒绝 |
| POST /delegation/outbox/:id/claim | `{executorId,walletScope}`；原子领取，校验在线/暂停、角色、scope、候选状态及有效期；仅返回一次claimToken。PAID_BUY确认在领取时原子消费，UNKNOWN/已领取不重放 |
| POST /delegation/outbox/:id/result | `{executorId,walletScope,claimToken,status,txHash?,errorCode?,previewClean?,priceWei?,holders?,previewRequestId?,orderId?,orderStatus?}`；status=SUBMITTED/SUCCEEDED/FAILED/UNKNOWN；免费成功必有clean preview报告/0价/>100holders；付费成功必有订单终态报告。成功需RPC回执核实。结果按钱包隔离、终态不可改写、重复成功幂等；免费成功回写账本失败返回502 LEDGER_SYNC_FAILED，DB结果保留 |

领域声明见 `packages/contracts/src/delegation.ts`。候选名称/符号都不可信；队列不接受命令、URL、凭证、原始stdout。只使用本机Host/Origin规则，无公网回调。前端状态和查询按walletScope分区。`GET /wallet/identity`、`GET /wallet/activity`、`GET /agent/runs`、`GET /agent/runs/:id`、`GET /agent/notifications` 支持可选walletScope；必须为已登记执行端或已导入钱包，否则404 WALLET_SCOPE_UNKNOWN。不传保持账本默认钱包。项目级候选/简报/检测记录不属于执行钱包私有数据。

免费回执验证 chainId、receipt成功/规范块/后续确认、from、to、value=0、calldata；付费订单/审计/preview属于执行端报告，RPC仅独立验证其成功交易和发送钱包，不伪称验证了成交数量。WalletActivity来源为GROK_BOT_LEDGER、providerType=DELEGATED，未知资产变化为空且有来源标识。交易时间使用回执块时间；导入只接受实际mintedAt。账本@1支持每条记录的walletScope/可选walletAddress、batchId、holdersSnapshot，兼容顶层默认钱包；按(walletScope,chainId,txHash)事务去重，拒绝scope/地址冲突或无效记录。

错误：EXECUTOR_NOT_CONFIGURED/EXECUTOR_OFFLINE/EXECUTOR_WALLET_BOUND/SESSION_SHARED/EXECUTOR_ROLE、CANDIDATE_PROCESSED、OUTBOX_CONSUMED、CONFIRM_REQUIRED、RESEARCH_REQUIRED、AUDIT_UNAVAILABLE、WALLET_CHANGED、RESULT_CONFLICT、RESULT_UNVERIFIED、GATE_EVIDENCE_REQUIRED、ORDER_NOT_FINAL、TX_ALREADY_IMPORTED（409）；OUTBOX_NOT_FOUND（404）；TX_REQUIRED/VALIDATION_ERROR（400）；LEDGER_SYNC_FAILED（502）；FAIR_MINT_NOT_CONFIGURED/FAIR_MINT_INVALID（409）；RPC来源失败保持原错误，不当作0价。运行方式见 EXECUTOR_RUNBOOK.md。

## v0.5 动态执行端（2026-10-30）

本节取代v0.4中固定w1/w2的约束。ExecutorId为 `^[a-z][a-z0-9_-]{0,31}$`，支持w3/w4和自定义ID，不再从ID推断权限。ExecutorSession增加label（最多80字）、role=MONITOR/FREE_MINT/PAID、isDefault。迁移保留原w1/w2角色和默认路由。

- POST `/delegation/executors`：`{id,walletScope,label?,role,isDefault?}`，201，创建UNCONNECTED钱包，不读取baw或伪造在线。相同ID/地址409 EXECUTOR_EXISTS/SESSION_SHARED。
- PATCH `/delegation/executors/:id`：`{label?,role?,isDefault?,paused?}`，200；ID/钱包地址不可改绑。有效PENDING或CLAIMED/SUBMITTED/UNKNOWN任务存在时，角色变更409 EXECUTOR_BUSY。设置默认在事务内清除同角色旧默认，部分唯一索引保证最多一个。MONITOR不可设执行默认。
- POST `/delegation/sessions/:id`：动态ID，必须事先登记，否则404 EXECUTOR_NOT_FOUND。只更新连接状态和心跳，保留用户暂停；旧paused字段只有与当前值相同时接受，改变须走PATCH（409 EXECUTOR_CONFIG_REQUIRED）。
- GET `/delegation/sessions` / `/delegation/outbox?executorId=`：动态列表与ID过滤；回写仍绑定原executorId、walletScope、claimToken。
- POST `/delegation/candidates/:id/queue`：body可选`{executorId}`；未指定按角色默认选择，无默认且仅一个角色钱包时选该钱包，多个无默认409 EXECUTOR_REQUIRED。离线/暂停不会自动切钱包。已有任务绑定其他明确目标时409 OUTBOX_BOUND，不修改旧队列。
- POST `/delegation/briefs/:id/confirm-buy`：walletScope必须对应已登记PAID角色；前端明确选钱包，变更目标清空确认。未登记404；MONITOR/不匹配角色409 EXECUTOR_ROLE。付费意图仍须精确金额确认且只消费一次。

角色、默认配置、入队和领取共享事务锁，防止并发改角色绕过领取校验；监控钱包无法领取任意执行任务。登记导入客户端仅接受loopback HTTP，完整校验文件，不按ID设置默认，不将enabled同步解释为解除用户暂停。

## Grok 多角色登记数据兼容（2026-10-30）

`executor-registry@1` 的roles支持FREE_MINT、PAID、MONITOR、STANDBY、COLLAB。COLLAB为协作元数据；STANDBY映射本机MONITOR（即使同时出现执行角色，也不作为自动执行端）。非备用项按唯一执行角色FREE_MINT/PAID映射，否则MONITOR；同时指定FREE_MINT与PAID拒绝，不猜测执行权限。

ExecutorSession、POST/PATCH执行端接口增加可选sourceRoles（最多5个去重枚举）、agentId（最多100位字母/数字/点/下划线/连字符，可为null）。导入保留原始Grok角色与Agent ID；本机实际权限仍取role。导入缺少agentId时保留旧值，显式null可清除。UI展示两者，不将COLLAB等同于交易授权。

文件导入只写登记元数据，不写CONNECTED或心跳。首次登记保持UNCONNECTED/heartbeatAt=null，界面显示尚未收到心跳；这不证明远端Grok会话已掉线。只有执行端真实上报心跳后才按本机规则显示在线。

### 旧账本 checksum scope 兼容

账本读取、账本导入和文件回写去重接受EVM地址checksum大小写；比较前统一规范为 `EVM:` + 小写地址。钱包地址确实不同、零地址或畸形scope仍返回LEDGER_INVALID。行级scope同样规范后按钱包过滤，不混入其他钱包合约。接口、数据库和前端Query key仍使用规范小写scope，兼容逻辑不重写历史交易文件。

动态钱包管理查询独立于默认账本身份/配置加载；默认账本失败时保留明确错误，同时仍可查看、编辑和切换已登记钱包。
