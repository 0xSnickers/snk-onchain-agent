# CLAUDE.md

本文件用于指导 Claude Code 在本项目中工作。执行任务前请先阅读 `AGENTS.md`，再阅读 `README.md`、`GUIDE.md`、`TEST.md`、`MERMAID.md`。

## 工作方式

- 先理解现有实现，再修改代码。
- 小步提交修改，避免一次性大范围重构。
- 优先复用项目已有工具、目录和命名方式。
- 不要引入未被要求的新依赖。
- 不要修改与任务无关的文件。
- 如果发现现有未提交改动，不要回滚，继续在当前状态上工作。

## 必须遵守

- 页面放在 `src/pages`。
- 路由统一维护在 `src/routes/index.tsx`。
- 业务组件放在 `src/components/feature`。
- 通用 UI 组件放在 `src/components/ui`，遵循 shadcn/ui 组件组织规则。
- HTTP 请求只能通过 `src/services/api/httpClient.ts` 和 `src/services/api/*Api.ts`。
- 页面/功能级共享上下文优先使用 `src/providers` 中的 Provider。
- 服务端状态优先使用 TanStack Query。
- 跨页面客户端状态使用 Zustand。
- 单元测试使用 Vitest + React Testing Library。
- 新增页面、组件、功能时按 `GUIDE.md` 开发。
- 写测试时按 `TEST.md` 编写。

## React SPA 注意事项

- 页面不要直接堆复杂业务逻辑。
- 不要在组件中重复创建请求客户端。
- 不要把同一组 props 连续向下透传 3 层以上。
- 不要用 Zustand 解决只属于单个页面或功能模块的 prop drilling。
- 不要用全局状态替代局部状态。
- 不要为了小功能引入额外状态库。
- 路由、接口、类型、状态要分层清晰。

## 修改后检查

优先运行：

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

如果任务很小且跳过了某些命令，需要说明跳过原因。

## 回复格式

完成后请简要说明：

- 修改内容。
- 测试或检查结果。
- 未运行检查的原因。
- 需要人工确认的风险点。

---

**最后更新**: 2026年5月27日
