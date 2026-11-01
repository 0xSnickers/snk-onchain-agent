# snk-onchain-server

NestJS + Prisma + PostgreSQL，本机 companion 服务。

从根目录 `npm run setup` 完成依赖、环境、迁移。`npm run dev` 同时启动两端；独立启动可 `cd server && npm run dev`。

`src/modules/wallet`：只读 CLI 桥接与扫码；`market`：DEX API；`kol`：PostgreSQL 观察名单。全局管道、响应与访问限制在 `src/common/setup-app.ts`。

接口与配置说明见根目录 docs/API_CONTRACT.md、README.md。测试默认内存替代 Prisma 和外部 provider；根目录 smoke 使用真实数据库。
