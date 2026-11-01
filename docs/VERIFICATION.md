# 验证记录 · 2026-10-27

运行环境：macOS、Node 26.12.1、npm 11.20.0、Docker Desktop；PostgreSQL 16 容器独立监听 127.0.0.1:55432。前端 http://127.0.0.1:5173，后端 http://127.0.0.1:9010/api/v1。

## 本地完整流程

目标：在 KOL 观察页添加账号，经 Axios → Nest DTO/service/repository → Prisma/PostgreSQL，刷新后读取持久化结果。

| 边界 | 结果 | 证据 |
|---|---|---|
| React 页面渲染 | 通过 | 浏览器显示导航、工作台、钱包、KOL 与市场区块，移动宽度无横向溢出 |
| 页面 → API → 数据库 | 通过 | 添加临时 `snk_ui_test`，返回并显示用户名与备注 |
| 数据库 → API → 页面 | 通过 | 整页刷新后仍显示同一账号，计数为 1 |
| 测试清理 | 通过 | 删除测试账号，GET /kols 返回 accounts=[] |
| 钱包登录按钮 | 调用正确，外部阻塞 | 点击后显示加载状态，随后展示 CLI 原始 message：`Connection reset by server` |
| 市场真实 provider | 外部阻塞 | 本机 Node fetch 请求失败，API 返回 MARKET_UNAVAILABLE；页面显示错误，无伪造数据 |

## 自动化

- `npm run check`：两端 TypeScript、ESLint、测试、生产构建。
- Server：3 个测试文件、13 项测试，覆盖统一响应、Host/Origin、输入校验、KOL API、钱包未连接/网络失败/字段裁剪/登录配对、市场过滤/排序/缓存/失败。
- Web：3 个测试文件、5 项测试，包含模板 UI 组件与 KOL 空/成功/失败/添加/移除流程。
- `npm run smoke`：10 项真实 HTTP/PostgreSQL 检查；包含健康查询、CRUD/upsert、非法 handle/UUID/network、跨源登录拦截、测试数据清理。
- `npm audit`：安装最终锁文件时两端均 0 vulnerabilities；服务端固定 Prisma/client 为 6.12.0，path-to-regexp 使用同 major 的修复版本约束。

## 外部边界与下一步

Binance skill 版本 1.15.0、CLI 1.12.0，版本检查通过。`wallet status` 与网页登录请求均返回 `NETWORK_ERROR`，message 为 `Connection reset by server`。首次检查时尚未获取钱包地址/余额，最终扫码联调结果见文末。

本机 `curl` 访问 `https://api.dexscreener.com` 也返回 `Recv failure: Connection reset by peer`。因此没有把本轮结果标为“外部 API 联调成功”；网络恢复后需要重新验证真实行情和钱包扫码。当前错误不足以确定网络失败的具体原因。

X 尚未授权/采集，配置状态为 false。没有导入任何假定的个人关注列表。后续验收顺序见 IMPLEMENTATION_PLAN.md。

## 后续联调：官方扫码流程

按用户提供的 Binance 官方文档确认扫码流程。macOS 系统已配置本机 HTTP(S) 代理，但终端进程没有继承相应环境变量；本次 CLI 请求显式使用现有系统代理后，`auth signin --json` 成功返回配对码与官方短链接，浏览器打开后可见官方二维码页。原始 CLI urlForWeb 的 origin 实际为 `https://app.binance.com`，已同步加入严格 allowlist，同时保留 `https://web3.binance.com`，不修改返回 URL。

服务端本机 `.env` 已配置现有代理供 baw 子进程使用；样例中保留可选注释，未修改系统代理。新增 5 项登录 URL 测试，服务端共 18 项通过。扫码授权需以 verify 完成后的 CONNECTED 状态最终确认。

### 最终扫码联调结果

用户在 Binance App 确认授权后，前台 `auth verify` 返回 SUCCESS，随后 `wallet status` 返回 CONNECTED；项目 `/wallet/status` 同样返回 CONNECTED。`/wallet/overview` 实际返回 7 条链地址、7 个支持网络及 1 项非零余额，来源为真实 CLI。仅记录数量，不在文档保存个人地址、余额、配对码或登录链接。全量 `npm run check` 与 10 项真实数据库 smoke 通过。


## v0.2 当前钱包日志与 Mint · 最终验收

- `/wallet/activity/sync` 从已连接的钱包真实读取并持久化 3 条历史：2 条 providerType=mint、1 条转账，均 confirmed；重复同步后仍为 3 条。文档只记数量，不保存个人地址、哈希或余额。
- 浏览器 `/activity` 验证类型筛选、完整哈希、Mint 收到资产/完整代币合约、精确网络费和来源；整页刷新后持久化记录仍在。修复 StrictMode 挂载时同步完成但按钮停留 pending 的问题，并用 StrictMode 回归测试覆盖。
- 「本项目操作」通过一次真实只读扫描生成 SCAN/SUCCEEDED 与 wallet.status 步骤，当前没有候选，因此没有 preview 或 execute。该记录来自实际操作，不是演示数据。
- 服务端 10 个测试文件 / 61 项测试，前端 4 个文件 / 8 项测试；类型检查、ESLint 和生产构建通过。
- 真实 PostgreSQL smoke 除原 HTTP/CRUD 检查外，验证了并发确认仅一次消费、动作序号原子递增、敏感字段脱敏、钱包分区、历史去重和数据库执行互斥；所有测试夹具清理完毕。
- Mint 价格核查、风险门禁、确认与执行状态由隔离夹具测试。没有为验收广播主网交易；RPC/DevMode/明确候选与配置后的真实执行验收仍需单独进行。广播、自动 Mint、定时扫描和付费社媒默认关闭。

## 参考图视觉重设计

- 使用 ui-ux-pro-max，按用户参考图调整为蓝黑圆角工作台、灰蓝外背景、细边框与渐变卡片；统一工作台、钱包、日志、Mint、市场、KOL 与设置的基础视觉。设计规则保存在 `design-system/snk-onchain/`。
- 工作台连接后显示真实余额快照、持仓占比、网络与近期 Mint 数量；资产历史尚未采集时明确说明，不绘制虚构收益曲线。金额可隐藏；接口失败保留错误提示。
- 浏览器验证 375、768、1024、1440 宽度，无文档横向溢出；修复 768 宽度旧导航样式裁切。验证工作台至日志、Mint 页面导航。
- 本轮新增 2 项前端测试，覆盖真实快照映射、隐藏金额和上游失败状态；前端合计 10 项，服务端 61 项。`npm run check` 与真实数据库 `npm run smoke` 通过。
- 本轮外部服务复测：钱包状态接口返回 SERVICE_ERROR / `illegal parameter`，DEX Screener 请求超时。页面展示实际失败状态，未修改会话、重新授权或用假数据替代；因此本轮未重新验证已连接钱包的实时日志。此前成功联调记录保留于上文。

## 二维码登录恢复修复

- 复现：独立 `wallet status --json` 返回 SERVICE_ERROR/code=2/illegal parameter；`auth signin` 可成功生成新配对。旧会话查询错误不等于二维码生成失败。
- 修复：登录点击同步预留新标签页，signin 返回后跳转原样官方 URL；不再等待 status 刷新才解除按钮 loading。新配对等待期间查询失败仍返回 AUTHORIZING、login 与明确 statusError；刷新页面仍可取回未过期配对，未配对时仍返回原错误。
- 浏览器实际点击后自动打开 Binance 官方扫码页，页面可见二维码；项目页同时显示等待确认、配对码与旧会话错误说明。未执行 signout、删除凭证或广播交易。是否完成连接须以用户扫码后 wallet status=CONNECTED 为准。
- 新增服务端配对恢复/失败保留测试、前端自动跳转与慢状态刷新回归测试；数据库 smoke 通过。
- 最终检查：服务端 typecheck/lint、63 项测试及构建通过；前端 lint/typecheck、11 项测试及构建通过。新增接口字段已同步共享契约和 API 文档。
- 扫码后最终联调：`/wallet/status` 返回 CONNECTED、login=VERIFIED；浏览器钱包页显示已连接、7 条网络地址与 1 项真实非零资产，页面无 alert。仅记录数量，不保存个人地址、余额和授权码。旧会话的 illegal parameter 在重新授权后消失。

## v0.3 市场 / TradingView / KOL / 六位小数 · 2026-10-28

- 实际GMGN CLI和应用HTTP接口读取BNB Chain热门集合20项，真实15m OHLCV成功返回；浏览器Solana热门集合20项与真实蜡烛图也成功显示。切换链时旧链数据立即移除，切换代币可更新图表；支持1m/5m/15m/1h/4h/1d。
- 使用TradingView Lightweight Charts显示真实蜡烛与USD成交量；保留TradingView归属链接。修复应用全局table样式挤压图表内部pane的问题。桌面1440并排、手机375堆叠，文档无横向溢出；列表在卡片内横向/纵向滚动。
- GMGN曾返回IP限流：串行CLI、同key合并、30/60秒缓存和供应商reset冷却已实现；错误不转为空数据。未使用网站私有端点或伪造K线。
- 六位小数覆盖价格、USD、代币数量与百分比；使用字符串/BigInt显示舍入，测试大数、负数、科学计数及舍入进位。钱包页面真实余额/估值已按六位展示。精确数量保留于悬浮提示；表单、签名、广播参数和技术原始日志不改写。
- xapi.to已完成公开profile/tweets官方能力schema核对、手动同步/下一页、稳定userId、事务去重/检查点、错误保留与前端时间线；数据库迁移已应用。当前本机XAPI_KEY缺失，未执行真实付费推文采集；测试使用隔离夹具，未添加模拟KOL作为真实观察名单。
- 新增真实数据库smoke验证市场DTO仅SOL/BNB、KOL推文持久化/重复upsert、来源与失败保留、删除级联清理；不调用外部付费接口。
- 最终 `npm run check`（两端类型、lint、测试及构建）和 `npm run smoke` 全部通过。DEX Screener经支持环境代理的NetworkService实测HTTP200，搜索GANG返回14项BNB交易对。浏览器验证SOL的1h周期切换，真实蜡烛与成交量显示、无alert。

## KOL 手动接入状态补全

继续验收时本机XAPI_KEY仍未配置、真实观察名单为空。数据接入页改为读取后端配置状态，状态请求失败时明确显示不可用，不冒充缺Key；KOL空名单也展示手动模式、配置位置、重启提示和添加账号指引。浏览器验证提示与真实空名单一致，未虚构账号或推文，定时采集保持关闭。新增配置状态和失败状态回归测试。

## xapi.to 真实 KOL 同步 · 2026-10-28

用户指定的4个账号已持久化；本机XAPI_KEY配置后重载后端。实测发现Action网关需要官方CLI使用的XAPI-Key认证头，并可能以HTTP200承载success=false错误；修复认证头及显式错误映射，新增回归测试。随后4个账号各成功同步20条真实公开推文，合计80条落库，成功时间与下一页游标可读，错误已清除。只记录数量，不在文档保存Key或推文正文；仍只允许手动同步，未启用定时采集。

## 全屏简洁布局与 K 线修复 · 2026-10-28

根据 ui-ux-pro-max 的暗色/简洁建议，应用容器改为100%视口宽度与100dvh，取消外层留白、最大宽度和装饰卡片；缩小导航、工具栏和标题，冗长来源与合约说明折叠。市场用侧边代币列表和主图，手机优先显示图表；KOL账号管理和动态分栏，正文默认4行可展开，仍只手动同步。

K线无法查看的因素分开修复：窄屏旧布局把图表排在长列表后，改为图表优先；少量蜡烛fitContent撑满图，改为默认80根逻辑时间范围；图表按容器ResizeObserver更新尺寸，价格与成交量分pane。行情刷新失败时保留相同chain/address/resolution的上次成功数据并标注更新失败，避免白屏；跨代币/链仍不复用数据。实测期间GMGN曾ECONNRESET，后恢复，真实ONECOIN OHLCV 100根可正常显示。钱包状态查询/配对的illegal parameter改为友好重新扫码文案，服务端错误仍保留。

浏览器验证375/768/1024/1440宽度无文档横向溢出，1440x900容器覆盖整个视口，375手机图表首屏可见；新增80根默认视图/resize释放、刷新失败保留图表、钱包友好提示回归测试。
最终检查：npm run check与npm run smoke通过，服务端73项、前端29项，共102项测试。浏览器最终确认KOL270px账号栏+动态主区域、市场真实蜡烛图与成交量均可见，视口临时覆盖已恢复。

## 全站 MINI 与 KOL 名单编辑 · 2026-10-28

- 使用统一MINI样式缩小导航、标题、卡片/表单和市场代币行，移除首页推广卡片及设置页静态路线说明。市场项仅名称/价格/涨跌，完整合约与成交量/流动性保留在主图详情；链图标使用用户提供的public/solana.png、public/binance.png，HTTP200验证。
- KOL增加持久化displayName与category迁移。真实补查4账号昵称成功，分别为菠萝头🍍、冷静冷静再冷静、0xAA、花轮；不猜测昵称或分类。默认DAILY，支持MEME/AIRDROP。名单直接选择对应动态。
- 移除备注入口与展示；新增账号/分类编辑，小号＋按钮位于观察名单标题右侧。更换handle明确提示重新同步，旧推文缓存与身份清除；用行锁和expectedHandle阻止旧在途同步串入新账号。
- 桌面改为main正常滚动，取消推文列表内层滚动。浏览器1440验证main高度853/内容3256，滚轮使main.scrollTop变化，名单sticky仍可见；切换账号回到内容顶部。昵称与分类编辑界面已验证，预览分类后取消，未擅自改变用户账号分类。
- 数据库smoke覆盖分类修改保留推文、账号更换重置缓存、旧handle同步拒绝与夹具级联清理。无外部付费smoke、无主网广播。
最终浏览器检查：工作台、钱包、日志、Mint、设置标题统一18px，1440宽度均无文档横向溢出；市场MINI代币项实测约46px，public/binance.png与solana.png图标加载成功。KOL昵称联动、分类编辑下拉和取消流程已验证，无研究备注输入；添加＋按钮在标题右侧。分类与编辑真实数据库smoke通过。

## 2026-10-28 初始化、图片与分页

- 浏览器实测 KOL 20 条动态分为两页，每页 10 条；末页下一页禁用，翻页自动回到动态顶部。
- KOL 添加/编辑通过 Dialog，Escape/取消关闭并恢复焦点；首次查询使用统一骨架屏，空状态不抢先显示。
- 四个 KOL 公开头像均加载成功；市场前五个 Token Image 加载成功。528px 视口未出现水平溢出。
- 页面懒加载保留导航；资产、市场、KOL、钱包日志、Mint、运行及接入页查询使用同一 LoadingState，后台刷新保留已有内容。
- `npm run smoke` 通过：本机服务、数据库、DTO、隔离、确认消费、行情/KOL 契约及清理；未发送主网交易。

## 2026-10-29 多钱包检测与委托

- `npm run db:up`、`npm run db:migrate`：独立 PostgreSQL 正常，delegation 迁移已应用。
- `npm run check`：通过；后端17套/92项，前端14套/50项，lint、typecheck、两端生产构建通过。共享工作站默认并发下3个既有前端交互用例达到5秒上限；限制jsdom workers=2后完整检查通过，未放宽断言或超时。
- 改造持久化分层和排队状态保护后追加运行 delegation/fair-mint 定向用例：16项通过。
- `npm run smoke`：通过；新增隔离schema/临时账本验证双角色独立绑定、离线拒绝、并发原子领取、回执/钱包/value/calldata验证、重复结果/账本导入去重、两钱包分区、UNKNOWN不重放、精确付费意图、订单终态和HTTP DTO/跨scope拒绝。夹具schema和临时文件均清理；未调用baw、付费供应商或主网广播。
- 开发watch与生产build同时操作dist时曾导致本机服务短暂停止；待构建完成后重新启动服务，smoke通过。这属于本机启动过程问题，没有将其归为外部供应商失败。
- 浏览器人工巡检未完成：IAB不可用，Chrome扩展连接超时。组件交互由RTL、HTTP/数据库流由隔离smoke验证，未声称截图验收通过。
- 外部待接入：w1/w2各自独立Grok Bot会话/例程、真实站外fair mint登记源、BSC RPC与新鲜holders快照。本轮没有注册真实执行钱包、伪造候选、修改真实成功账本或发送主网交易。
- 运行和接入见 `docs/EXECUTOR_RUNBOOK.md`；loopback限制及WALLET_DELEGATED保持。

## 2026-10-30 动态钱包管理

- `npm run check` 通过：后端17套/93项、前端14套/52项，以及4项登记文件客户端测试；lint、typecheck、两端构建通过（共149项）。
- 数据库运行环境：原Docker Desktop无法提供socket；启动/重启尝试后，CLI报告backend startup stuck、停止后端进程超时。没有删除或重建原Docker卷，没有修改真实钱包/执行端登记。
- 使用本机PostgreSQL 14.19建立临时数据目录，监听127.0.0.1:54399，独立API监听127.0.0.1:19010。9项迁移全部应用成功，再以SMOKE_API_BASE运行完整 `npm run smoke`，全部通过。完成后停止临时API/数据库并删除临时目录；原开发Docker PostgreSQL16数据库的迁移仍待Docker恢复后执行 `npm run db:migrate`。
- 新增隔离数据库检查：w3/w4动态登记、MONITOR不能执行、动态角色默认路由、变更默认不转移旧任务、离线不换钱包、心跳不解除暂停、未完成任务禁止改角色、并发设置默认至多一个、付费确认绑定任意PAID钱包、HTTP登记/编辑/非法参数。
- 登记文件测试覆盖：动态ID不推断默认、禁止改绑钱包、disabled暂停与enabled保留用户暂停、整份文件预检、拒绝多角色歧义和非loopback地址。所有测试使用隔离夹具，无baw调用、付费供应商调用或主网广播。
- Docker UI诊断的计算机控制连接超时；界面交互由RTL验证，未声称完成浏览器截图验收。

## 2026-10-30 Grok 实际登记数据联调

- 本机Docker已恢复，PostgreSQL容器healthy。已在原开发数据库成功应用动态执行端及sourceRoles/agentId迁移；此前“原库待迁移”的阻塞已解除。
- 读取本机 `data/executor-registry.json` 的真实@1导出，兼容FREE_MINT+COLLAB、PAID、STANDBY+COLLAB组合。原始角色及Agent ID保留，备用映射MONITOR、协作不授予交易权限。
- dry-run通过；真实 `npm run import:executors` 三项201成功，重复导入三项200成功。API回读、按walletScope查询identity/activity/runs均核对成功。w1已有交易和运行历史（第一页各20项、交易还有后续页）；w2/w3当前无导入交易和运行记录，没有填充示例数据。
- 三个登记端heartbeatAt均为null，本机未收到真实心跳；UI显示等待心跳。没有根据用户转述的Grok CONNECTED伪造在线，也未访问Grok的registry@2或本机baw会话文件。
- `npm run check`通过：93项后端、53项前端、5项登记客户端测试及两端lint/typecheck/build。`npm run smoke`在原开发PostgreSQL16环境通过，额外的动态/元数据用例使用独立schema并清理。
- 服务启动于127.0.0.1:9010，工作台127.0.0.1:5173。没有执行Mint、买入或主网广播，没有改写真实成功账本。

## 2026-10-30 旧账本 scope 大小写修复

- 根因：实际账本walletAddress和walletScope使用checksum大小写，读取器将地址转小写后与未规范化scope严格比较，错误拒绝同一钱包。
- 增加统一账本解析和scope规范化；同步修复导入、行级scope过滤及回写文件去重。实际地址不一致仍拒绝；没有修改真实账本文件或交易记录。
- 默认钱包identity/holdings真实请求已返回200。holdings保留实际来源及单合约失败，不以空数据掩盖外部错误。真实90条账本导入dry-run通过，未重新写入交易。
- 动态钱包列表不再等待默认identity/config完成；RTL覆盖pending及LEDGER_INVALID时仍可见钱包。
- `npm run check`通过：97项后端、55项前端、5项登记客户端用例及两端lint/typecheck/build；`npm run smoke`通过。隔离smoke增加真实含a–f字母的checksum账本导入及canonical walletScope分区断言。
- 后端已重启加载修复；前端开发服务保持运行。未调用baw或发送任何交易。
