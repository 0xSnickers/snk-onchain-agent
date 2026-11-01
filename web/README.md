# snk-onchain-web

由 SNK React SPA 模板生成的链上研究工作台。保留 React 19 / Router / TanStack Query / Axios / i18n / Zustand / Tailwind / shadcn-ui。

本地 `npm run dev`；默认 127.0.0.1:5173，`/api` 代理到 Nest 9010。业务页面在 pages，交互在 components/feature，请求在 services/api，数据 hooks 在 hooks。

检查：`npm run check`。环境配置从 src/config/env.ts 读取；密钥只能放 server/.env。项目总览、接入状态与实现计划见根目录文档。
