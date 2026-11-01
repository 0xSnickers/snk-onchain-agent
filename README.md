# SNK Onchain Agent

本机链上研究工作台。基于指定 `admin-system-template` 的 React SPA + NestJS + Prisma/PostgreSQL 分层，前端由本机 SNK React 模板生成。已交付基础架构、当前钱包的真实交易/Mint 日志和可审计的 Mint/投研流程。

## 快速开始

需要 Node.js 22.12+（本次验证为 26.12.1）、npm、运行中的 Docker Desktop；钱包功能另需本机 `baw` CLI ≥1.12.0。

```bash
npm run setup      # 两端依赖、环境文件、独立 PostgreSQL、迁移
npm run dev        # 同时启动前后端，日志写 logs/
```

- 工作台：http://127.0.0.1:5173
- 健康接口：http://127.0.0.1:9010/api/v1/health
- PostgreSQL：127.0.0.1:55432，Docker volume `snk-onchain-agent_snk_pg`
- `Ctrl+C` 停止前后端；`docker compose stop` 停止数据库并保留数据。
- 本机钱包会话属于运行服务的 OS 用户，服务从 PATH 查找 `baw`。

## 已实现

- 深色工作台、钱包日志、Mint 监控、响应式布局、中文/英文和主题色。
- NestJS 分层业务模块：wallet、market、kol、wallet-activity、agent-runs、research、execution；统一响应、DTO 校验、错误状态。
- Agent Wallet 会话和免费 Mint 留在 Grok Bot。本项目不扫码、不读取实时余额、不广播。成功记录由 `data/baw-free-mints.json` 经 `npm run import:baw-mints` 入库后在看板查看。
- BNB Agent 专属发射盘：默认三列展示 Flap Agent、Four Agent ID、gang.fun 的内盘新创建/即将发射/已迁移代币；显示真实来源、采样边界、预测合约与来源失败。
- SOL / BNB Chain 市场：GMGN 1h 活跃代币列表与真实 OHLCV，DEX Screener 名称/合约搜索；TradingView Lightweight Charts 显示蜡烛图、USD 成交量、十字线及多周期。带缓存、合并请求和限流冷却。
- KOL 名单与 xapi.to 手动公开推文同步：稳定 userId、分页、PostgreSQL 去重、原文链接、失败状态与成功同步时间；默认不定时采集。
- 独立数据库与迁移、一键启动、自动化测试、真实数据库 smoke。

X 关注列表导入、定时推文采集、链上历史快照和提醒属于后续阶段；不会把示例 KOL 当成你的真实关注名单。

## 钱包日志与 Mint

- [当前钱包操作/交易/Mint 日志](http://127.0.0.1:5173/activity)：同步最新/更多历史、类型筛选、完整交易哈希、资产变动、Gas、浏览器链接。
- 「本项目操作」显示 SCAN/FREE_MINT/RESEARCH/PAID_BUY 时间线和有序动作、状态、错误、requestId、txHash，与原生历史分来源展示。
- [Mint 监控](http://127.0.0.1:5173/mint)：手动候选、官方技能简报、免费 Mint 预演、付费两阶段确认、站内通知。
- 广播、扫码、实时流水同步和付费报价接口固定拒绝（`WALLET_DELEGATED`）。定时检测即使打开也不会调用 baw。简报仍可在本机生成。

## 多钱包检测与委托

`/mint` 支持动态钱包登记、角色/默认接收端/暂停管理、按钱包查看日志、检测与 Outbox、付费意图。只读扫描无需钱包；站外 fair mint 首版从本机登记文件发现并核实代码/价格/holder证据。各执行端在独立 Grok Bot 会话使用 `npm run delegation` 接入；领取原子消费，UNKNOWN 不重放，成功回写数据库和免费 Mint 账本。本机继续不登录、不报价、不广播。

迁移：`npm run db:migrate`。配置/协议/例程约束见 [EXECUTOR_RUNBOOK.md](docs/EXECUTOR_RUNBOOK.md)。真实 Grok Bot 会话和站外登记源尚需接入；没有来源配置时明确失败，不生成示例候选。

## 架构

```text
web/                    React 19 · Vite 8 · TS · Router · Query · Axios · i18n · Zustand
  src/pages/            页面组合
  src/components/       layout / feature / shadcn-ui
  src/services/api/     唯一 Axios 客户端与业务接口
  src/hooks/            Query keys 和数据 hooks
server/                 NestJS 11 · Prisma 6 · PostgreSQL 16
  src/modules/wallet/   CLI 白名单桥接与登录流程
  src/modules/market/   DEX Screener 数据源与缓存
  src/modules/kol/      controller → service → repository
  src/common/           全局响应、校验与本机访问策略
  prisma/migrations/    可复现数据库变更
packages/contracts/     前端使用的领域响应类型
scripts/                setup / dev / check / smoke
```

与参考项目的取舍：保留技术栈、请求与状态边界、模块分层和接口 envelope；去掉监控埋点业务。当前为单用户本机 companion，替代演示 JWT 账号的是 loopback 监听和 Host/Origin 检查，不具备远程多用户部署的鉴权能力。`packages/contracts` 承接共享类型职责，未复制无关的监控 SDK；后端 DTO 是运行时校验来源，API 测试保障响应契约。

## 检查

```bash
npm run check          # 两端 lint / typecheck / test / build
npm run smoke          # 服务和数据库运行时：HTTP/数据库检查，以及确认原子性、日志脱敏、钱包隔离、历史去重、执行互斥
```

完整方案与边界见 [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md)，接口见 [docs/API_CONTRACT.md](docs/API_CONTRACT.md)，本次验证记录见 [docs/VERIFICATION.md](docs/VERIFICATION.md)。多钱包检测与执行分工见 [docs/MULTI_WALLET_DETECTION_EXECUTION.md](docs/MULTI_WALLET_DETECTION_EXECUTION.md)。

## 配置

配置样例位于 `server/.env.example`、`web/.env.example`。`.env`、日志及依赖不入库。本地数据库口令仅用于 loopback 开发容器；远程部署时需提供独立凭证与应用认证。当前后端端口为 9010，修改后须同步 Vite proxy。X 关注列表授权仍待接入；投研中的可选社媒查询默认关闭，需单独启用并配置服务端 token。

## 市场与 KOL 数据源

- 市场仅支持 `bsc`（BNB Chain）和 `solana`（SOL）。GMGN 使用本机 `gmgn-cli` 与现有 `~/.config/gmgn/.env` API Key，只执行 `market trending/kline` 白名单，不签名交易。可设置 `GMGN_CLI_PATH`。
- DEX Screener 公共 REST API 没有公开 OHLCV 端点，负责搜索；K 线由 GMGN 提供，图表由 TradingView Lightweight Charts 渲染。榜单是供应商 1h 活跃集合，不能保证全部为 MEME，也不是安全审计。
- xapi.to 只需在 `server/.env` 设置 `XAPI_KEY` 后重启服务；无需提供 X 登录 cookie。KOL 页选择已保存账号，点击同步最新推文或采集下一页；每账号有 60 秒冷却，可能产生供应商调用费用。当前不读取私人推文、不发帖、不导入你的个人关注列表。
- 金额、价格、代币数量和百分比统一显示 6 位小数；数量悬浮可看精确源值，表单与广播参数不受显示舍入影响。原始技术日志不重写。
