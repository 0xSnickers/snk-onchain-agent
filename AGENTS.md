# SNK Onchain Agent

先读 README、docs/API_CONTRACT.md 和 docs/IMPLEMENTATION_PLAN.md。参考架构来源：用户指定的 admin-system-template。

- server：controller/DTO → service → repository/provider，业务分模块；全局行为在 common/setup-app.ts。
- web：页面仅组合，业务组件位于 components/feature，API 只能使用 services/api/httpClient；服务端数据用 TanStack Query，文案走 i18n。
- packages/contracts 是领域响应类型；改接口同步类型、契约和测试。
- 当前仅为本机单用户应用；禁止把钱包桥接直接暴露公网。钱包凭证只留 CLI；只允许命令白名单，不执行任意 shell，不记录原始 CLI 输出。
- 不提交 .env、钱包数据、密钥、日志或依赖。不用示例数据冒充实时资产、行情、KOL 或推文。
- 新业务代码保持单文件 <=300 行；先写可验证的完整纵向流程，再扩展采集供应商。
- 检查：npm run check；启动后 npm run smoke。外部服务失败与本地失败分别记录，不以空数据掩盖错误。

## 钱包日志与 Mint

- 交易与运行按当前钱包 scope 分区，前端缓存同样分区；区分原生历史和本项目日志，不猜测 Mint 类型。
- 广播前原子消费确认；提交不等于成功；超时/中断的 UNKNOWN 结果不自动重放。
- 详见 docs/MINT_MONITOR_AGENT.md。广播默认关闭，开发测试使用隔离夹具，不为验收发送主网交易。
- 多钱包检测/执行边界见 docs/MULTI_WALLET_DETECTION_EXECUTION.md（本机检测，Grok Bot 多会话执行并回写账本）。
