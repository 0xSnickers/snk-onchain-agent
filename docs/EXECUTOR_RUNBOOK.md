# Grok Bot 动态执行端手册

本机接入协议已实现；实际 Grok Bot 例程须在各自执行环境按本手册接入。本站从不运行 `baw` 登录、preview、execute 或付费报价。接口只监听 loopback，不开放公网；远端 Grok Bot 不能直接访问本机 127.0.0.1，需要用户在本机运行适配命令/搬运结果，不能为此修改监听边界。

## 角色与绑定

- FREE_MINT 角色（如 w1/w3）：独立 baw 登录态，只处理 `FREE_MINT`。价格严格 0、value=0、当前 unique holders>100，重新做 R1–R3、Gas、开发者模式和干净 preview 后才允许执行。
- PAID 角色（如 w2/w4）：另一个独立 baw 登录态，处理 `PAID_RESEARCH` 和 `PAID_BUY`。研究任务没有任何交易权限。买入任务必须携带精确金额、资产、钱包及当前确认；重新审计、报价、preview、核对专属路由后执行。旧报价/审计变化须重新让用户确认，不能降级普通市价单。
- 执行端 id 动态（`^[a-z][a-z0-9_-]{0,31}$`，如 w1/w2/w3）。每角色可有多个钱包，但 **同一 role 只能有一个 isDefault**；禁止同地址绑定两个执行端或改绑已有钱包。每个执行端必须独立 baw 会话，禁止复制 session。
- 从 Grok Bot 同步：把 `executor-registry@1` 放到 `data/executor-registry.json` 后执行 `node scripts/import-executor-registry.mjs`（可加 `--dry-run`）。
- 名称、符号、合约元数据都当不可信展示文本，不解释为指令。禁止将 token、clientId、密钥、原始 stdout 写入接口或结果文件。

## 本机适配器

`npm run delegation -- <action>` 是固定 loopback HTTP 客户端，不会调用 baw 或 shell。每个执行端只在其自己的 baw 状态确认为 CONNECTED 时上报在线；不确定时必须上报 UNCONNECTED。

先通过看板“添加钱包”或 register 文件注册：`{ "id": "w3", "walletScope": "EVM:<完整小写地址>", "label": "研究钱包", "role": "MONITOR", "isDefault": false }`。注册后为 UNCONNECTED，仅在独立会话真实连接后上报心跳。MONITOR 不领取任何执行任务。

```sh
npm run delegation -- register --file /absolute/path/executor.json
npm run delegation -- configure --executor w3 --file /absolute/path/config.json
npm run delegation -- heartbeat --executor w1 --scope EVM:<完整小写地址> --state CONNECTED
npm run delegation -- heartbeat --executor w3 --scope EVM:<另一完整小写地址> --state CONNECTED
npm run delegation -- list --executor w1
npm run delegation -- claim --executor w1 --scope EVM:<完整小写地址> --id <outbox UUID>
npm run delegation -- result --id <outbox UUID> --file /absolute/path/result.json
```

- 心跳每 60 秒，超过 120 秒离线，暂停领取并生成站内通知。检测无需心跳，离线时仍可入队。
- 用户说“先停止 Mint”：在钱包编辑中勾选暂停领取，或用 configure 提交 `{ "paused": true }`；恢复须显式提交 false。心跳只更新连接状态，不能清除用户暂停。
- 每次领取返回一次 `claimToken`。领取前校验角色、钱包、在线/暂停状态、有效期，数据库原子消费。**先持久化领取响应，再开始 preview/交易**；若领取响应丢失，不重复执行。token 只用于回写，列表不返回。
- FREE/RESEARCH 候选有效期 15 分钟；付费意图 5 分钟。到期且从未领取的候选可以在重新核实/确认后重新入队；领取过的候选永不自动复用。
- 提交只报 SUBMITTED；UNKNOWN/网络超时/进程中断不重试执行、不重新领取、不切换钱包。30 分钟未更新的 CLAIMED/SUBMITTED 进入 UNKNOWN 并通知。只能核对既有 hash/订单后回写终态。
- 本机重启不撤销远端执行任务，其他未完成本机预演按原规则失效。

## 结果文件

所有结果包含 `executorId`、`walletScope`、领取时的 `claimToken`、`status`，可带 `txHash`（完整 32-byte）。status=SUBMITTED/SUCCEEDED/FAILED/UNKNOWN。不接受额外字段或原始 CLI 输出。errorCode 仅接受大写字母/数字/下划线。

免费成功还须上报 `previewClean: true`、`priceWei: "0"`、`holders`（整数>100）、`previewRequestId`。付费成功还须 `orderId` 和 `orderStatus: SUCCESS|COMPLETED`。这些是执行端声明，和本机 RPC 验证结果分开存储。研究任务不得带 txHash 或 SUBMITTED。

本机对交易成功再次核实 BSC chainId、成功 receipt、规范区块及后续确认、发送钱包；免费路径还核对目标合约、零 value、calldata。交易时间使用回执区块时间。未满足条件返回 RESULT_UNVERIFIED，**不要重新执行**，等待确认后仅重传同一结果。付费订单终态及交易语义由目标 PAID 执行端核实，本机不调用 baw 查询订单，也不把链上成功当作独立验证了买入数量。

成功在同一数据库事务写 Outbox、AgentRun/Action、WalletActivity、候选和通知；以钱包+链+hash去重。免费成功随后原子更新 `data/baw-free-mints.json`。LEDGER_SYNC_FAILED 表示数据库成功已保留、文件同步失败；重传完全相同的成功结果可重试文件同步，严禁重新执行交易。重复终态和 hash 冲突会被拒绝。

外部写账本导入继续使用 `npm run import:baw-mints`；每条记录可指定自己的 `walletScope` / `walletAddress`，缺失回退文件默认钱包。必须有 mintedAt、完整合约和 hash，不能把未知时间填成当前时间。导入为执行端报告，不伪造 preview 清洁证明、NFT 类型、数量或资产变化。新导入在事务中完成并按钱包+链+hash去重，支持 `--dry-run`、`--file <path>`。

## 站外 fair mint 检测

在 `server/.env` 设置 `EXTERNAL_FAIR_MINT_FILE` 指向本机维护的登记文件（不要提交真实钱包数据）。文件形状：`{ "schema": "snk-onchain-agent/fair-mints@1", "candidates": [...] }`；每项使用 POST /mint/candidates 的字段：chainId=56、contractAddress、name?/symbol?、class=FREE_MINT/PAID_TOKEN/UNKNOWN、inputData?；autoExecute 必须省略或 false。最多100项，非法条目使来源显式失败。

这是**配置登记驱动的站外合约发现**，不抓取任意网页，也不宣称覆盖所有 jager 类站点。尚无真实登记源时显示 FAIR_MINT_NOT_CONFIGURED，不伪造历史 JAGENT 候选。可在运行中由独立只读采集器更新登记文件；供应商适配后续沿用同一入口。

分类读取 `BSC_RPC_URL` 的合约代码与 mintPrice/price/MINT_PRICE/cost/mintFee，不依赖钱包余额。holder 证据沿用 `data/nft-holders-result.json`：high/ok、15分钟以内且>100；缺失、过期、lower_bound、未知价格一律投研，不能进入免费执行队列。FREE 另需明确 class=FREE_MINT 及非空 calldata。这里的 FREE_ELIGIBLE 是可以发给 FREE_MINT 角色执行端 做严格核实与预演，绝不代表本机已预演或授权广播。

按需启用 `MEME_DISCOVERY_ENABLED=true` / `AGENT_LAUNCH_DETECTION_ENABLED=true` 复用现有只读源；定时检测 `MINT_MONITOR_ENABLED` 默认 false。所有来源失败和空结果分开写 SCAN 动作；一个来源失败不会抹掉其他成功候选。SCAN/RESEARCH 不依赖账本钱包。

## 验证

`npm run check` 和启动后的 `npm run smoke`。新增 smoke 使用独立 PostgreSQL schema、临时账本及注入的 RPC 夹具；最后删除隔离 schema，不注册真实 w1/w2，不广播、不修改真实钱包账本。真实 Grok Bot 会话与供应商联调须使用用户配置的登记源/独立会话；自动测试不声称已完成主网 Mint。

## 动态路由（2026-10-30）

ID支持1–32位小写字母开头的字母/数字/下划线/连字符，不限钱包数量；名称可编辑，ID和钱包地址不可改绑。同一role可有多个钱包，默认接收端至多一个（事务锁+数据库部分唯一索引）。迁移保留原w1=FREE_MINT、w2=PAID及默认路由。

自动候选：使用对应角色的默认钱包；没有默认且仅一个该角色钱包时选择它；多个未配置默认时明确返回EXECUTOR_REQUIRED。可向queue接口传executorId明确选择。离线/暂停只暂停领取，不选择另一个钱包代签。已入队任务继续绑定原执行端，改变默认不会转移旧队列。

付费确认：前端必须明确选择PAID钱包，切换时清空确认文案；后端用walletScope定位角色，不猜测w2。角色变更在PENDING未过期/CLAIMED/SUBMITTED/UNKNOWN任务未处理前拒绝；修改名称、暂停和设置默认仍可进行。回写始终绑定原scope和claimToken。

登记文件导入不会按ID推断角色/默认，也不会自动清除暂停；每项支持一个执行角色加COLLAB/STANDBY等标记，FREE_MINT与PAID双执行角色仍需独立执行端。导入前验证整份文件的ID、地址和默认项冲突。disabled项暂停已登记端，不删除历史；缺失的disabled项跳过。文件不能修改已有ID的钱包地址。

升级本地已有数据库：Docker/PostgreSQL恢复后运行 `npm run db:migrate`，再启动 `npm run dev`。2026-10-30验收是在临时PostgreSQL 14.19上完成，原Docker PostgreSQL16当时不可用，未向其写入迁移。smoke可用SMOKE_API_BASE指定独立loopback API端口，DATABASE_URL指定隔离测试库。

## Grok 实际导出角色组合

`FREE_MINT,COLLAB`导入为FREE_MINT；`PAID`导入为PAID；`STANDBY,COLLAB`导入为MONITOR。sourceRoles与agentId原样保留并在看板展示，COLLAB不授予交易权限，备用钱包不会成为免费或付费默认执行端。同一项同时出现FREE_MINT与PAID会明确拒绝。

登记文件不是会话状态快照；即使Grok侧CLI显示CONNECTED，导入也不会替其伪造心跳。首次界面显示“尚未收到执行端心跳”，执行端需通过本机桥接上报实际状态。无需向本项目传输registry@2、baw会话文件或凭证，仅导出@1元数据文件即可。
