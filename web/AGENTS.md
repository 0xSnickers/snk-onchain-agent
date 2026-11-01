# AGENTS.md

本文件用于约束 AI Agent 在本项目中的开发行为。开始任何修改前，必须先阅读本文件，并结合 `README.md`、`GUIDE.md`、`TEST.md` 执行。

## 项目上下文

- 项目类型：React 19 + Vite 8 + TypeScript 6 SPA。
- 路由方案：React Router 7。
- 样式方案：Tailwind CSS v4 + `@tailwindcss/postcss`。
- UI 组件：shadcn/ui + Radix UI，基础组件放在 `src/components/ui`。
- HTTP 请求：统一使用 Axios 封装。
- 国际化：react-i18next，语言包放在 `src/i18n`。
- 服务端状态：TanStack Query。
- 客户端状态：Zustand。
- 测试工具：Vitest + React Testing Library。

## 必读文档

- `README.md`：项目技术栈、目录说明、常用命令。
- `GUIDE.md`：新页面、新组件、新功能开发流程。
- `TEST.md`：单元测试编写规范和示例。
- `MERMAID.md`：数据流、请求流、状态边界和新功能开发流。

## 开发原则

- 优先遵守现有目录结构和代码风格。
- 修改前先阅读相关文件，不要凭空假设项目结构。
- 保持变更范围最小，不做无关重构。
- 不随意新增框架、状态库、请求库、UI 库或构建工具。
- 不绕过 TypeScript、ESLint、Prettier、测试配置。
- 不直接在页面或组件中散落 HTTP 请求逻辑。
- 不绕过 `src/i18n` 直接散落用户可见业务文案。
- 不提交真实密钥、接口 Token、用户隐私数据或本地环境配置。

## 目录约定

- `src/pages`：页面组件。
- `src/routes`：路由配置。
- `src/components/ui`：shadcn/ui 风格的无业务基础组件。
- `src/components/error`：错误边界和错误兜底组件。
- `src/components/layout`：布局组件。
- `src/components/feature`：业务功能组件。
- `src/services/api`：接口方法和 Axios 客户端。
- `src/i18n`：国际化配置和语言包。
- `src/theme`：主题色配置和运行时切换工具。
- `src/providers`：应用级或功能级 Provider。
- `src/store`：Zustand 全局状态。
- `src/hooks`：React Hook。
- `src/config`：环境变量和应用配置。
- `src/types`：类型定义。
- `src/utils`：纯函数工具。

## 新页面开发要求

- 页面必须放在 `src/pages`。
- 新页面必须在 `src/routes/index.tsx` 注册。
- 页面只负责组织布局和业务组件。
- 复杂业务逻辑拆到 `src/components/feature`、`src/hooks` 或 `src/services`。
- 页面依赖的接口方法必须放在 `src/services/api/*Api.ts`。
- 页面内多个子组件共享上下文时，优先使用功能级 Provider，避免 prop drilling。

## 新组件开发要求

- 通用 UI 组件放 `src/components/ui`，文件名使用 shadcn/ui 的小写 kebab-case / 单词命名风格。
- 布局组件放 `src/components/layout`。
- 业务组件放 `src/components/feature`。
- 组件 props 必须显式声明类型。
- 组件不直接读取环境变量，不直接创建 Axios 实例。
- 组件不得把同一组 props 连续向下透传 3 层以上。
- 有交互或多状态组件必须补单元测试。

## 新功能开发要求

推荐顺序：

1. 定义类型：`src/types`。
2. 封装接口：`src/services/api/*Api.ts`。
3. 编写状态或 Hook：`src/store` / `src/hooks`。
4. 如存在页面/功能级共享上下文，编写 Provider：`src/providers`。
5. 编写业务组件：`src/components/feature`。
6. 接入页面和路由：`src/pages` / `src/routes`。
7. 补充测试：参考 `TEST.md`。
8. 更新文档：必要时更新 `README.md` / `GUIDE.md` / `TEST.md`。

## Provider 要求

- 2 层以内简单传递继续使用 props。
- 3 层以上透传、兄弟组件共享上下文、页面级筛选条件等场景优先使用功能级 Provider。
- 跨页面共享、持久化、登录态等状态使用 Zustand。
- 接口缓存和服务端数据优先使用 TanStack Query。
- Provider 作用域应尽量小，不要变成万能全局状态。

## HTTP 请求要求

- 必须使用 `src/services/api/httpClient.ts`。
- 不允许在业务代码中直接 `fetch`。
- 不允许在业务代码中重复创建 Axios 实例。
- 接口方法统一放在 `src/services/api/*Api.ts`。
- `baseURL`、超时、请求头、认证 Token、通用错误处理集中维护。
- 401 跳转、登出、刷新 Token 等业务动作通过 `setUnauthorizedHandler` 注册，不直接写死在 `httpClient`。
- 主题色新增或调整必须同步 `src/theme/config.ts`，不要在业务组件里硬编码主色。

## 测试要求

- 新增公共组件：至少包含基础渲染测试和关键交互测试。
- 新增业务功能：至少覆盖成功、失败、空数据状态。
- 新增 store / hook：测试核心状态变化。
- 测试文件优先与被测文件同级。
- 不真实请求后端，使用 mock。

## 提交前检查

修改完成后优先运行：

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

如果无法运行某个命令，必须在回复中说明原因。

## Agent 回复要求

- 说明修改了哪些文件。
- 说明是否新增或更新测试。
- 说明已运行的检查命令和结果。
- 如有风险或未完成项，明确列出。

---

**最后更新**: 2026年5月27日
