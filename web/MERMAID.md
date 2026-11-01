# React.js 架构流程图

本文档用 Mermaid 时序图说明 React SPA 模板的数据流向、HTTP 请求路径、状态边界和新功能开发流程。所有图尽量统一使用 `sequenceDiagram`，方便按调用顺序理解系统行为。

## 整体数据流

```mermaid
sequenceDiagram
    participant User as 用户
    participant Router as React Router
    participant Page as src/pages
    participant Feature as src/components/feature
    participant Query as TanStack Query
    participant Provider as src/providers
    participant Store as src/store Zustand
    participant API as services/api/*Api.ts
    participant HTTP as httpClient.ts
    participant BE as 后端 API

    User->>Router: 访问路由 / 触发跳转
    Router->>Page: 渲染页面组件
    Page->>Feature: 组合业务组件
    Feature->>Provider: 读取/更新页面或功能级上下文
    Provider-->>Feature: 返回共享上下文
    Feature->>Store: 读取/更新跨页面状态
    Store-->>Feature: 返回全局状态
    Feature->>Query: useQuery / useMutation
    Query->>API: 调用业务接口方法
    API->>HTTP: 使用统一 Axios 客户端
    HTTP->>BE: 请求后端服务
    BE-->>HTTP: 返回响应
    HTTP-->>API: 统一处理响应 / 错误
    API-->>Query: 返回业务数据
    Query-->>Feature: 更新缓存和请求状态
    Feature-->>User: 更新页面 UI
```

## HTTP 请求流

```mermaid
sequenceDiagram
    participant UI as Page / Feature / Hook
    participant Query as TanStack Query
    participant API as services/api/*Api.ts
    participant HTTP as httpClient.ts
    participant ENV as config/env.ts
    participant BE as Backend API

    UI->>Query: useQuery / useMutation
    Query->>API: 调用业务接口方法
    API->>HTTP: 使用统一 Axios 客户端
    HTTP->>ENV: 读取 baseURL / 配置
    HTTP->>BE: 发送 HTTP 请求
    BE-->>HTTP: 返回响应
    HTTP-->>API: 统一处理响应 / 错误
    API-->>Query: 返回业务数据
    Query-->>UI: 更新缓存和 UI 状态
```

## 状态边界流

```mermaid
sequenceDiagram
    participant Component as 组件
    participant Local as useState 局部状态
    participant Provider as 功能级 Provider
    participant Query as TanStack Query
    participant Store as Zustand Store

    Component->>Local: 只被当前组件使用的 UI 状态
    Local-->>Component: 返回局部渲染状态

    Component->>Provider: 同一页面/功能模块内共享上下文
    Provider-->>Component: 返回筛选条件/选中项/局部动作

    Component->>Query: 服务端数据、缓存和请求状态
    Query-->>Component: 返回 data / loading / error

    Component->>Store: 跨页面共享、持久化、登录态
    Store-->>Component: 返回全局状态

    Note over Component,Provider: 3 层以上 props 透传优先考虑 Provider
    Note over Component,Store: 单页面临时上下文不要放入 Zustand
    Note over Provider,Query: 接口缓存交给 TanStack Query
```

## 新功能开发流

```mermaid
sequenceDiagram
    participant Dev as 开发者
    participant Types as src/types
    participant API as src/services/api
    participant Hook as src/hooks
    participant State as 状态归属判断
    participant Provider as src/providers
    participant Store as src/store
    participant Feature as src/components/feature
    participant Page as src/pages
    participant Route as src/routes
    participant Test as 单元测试
    participant Check as 质量检查

    Dev->>Types: 定义 API 和业务类型
    Dev->>API: 封装接口方法
    Dev->>Hook: 封装数据获取或业务动作
    Dev->>State: 判断状态作用域
    State->>Provider: 页面/功能内共享上下文
    State->>Store: 跨页面共享或持久化状态
    State-->>Feature: 局部状态留在组件内部
    Dev->>Feature: 实现业务组件
    Dev->>Page: 组合页面
    Dev->>Route: 注册路由
    Dev->>Test: 补充组件/Provider/store/API 测试
    Dev->>Check: 运行 lint / typecheck / test / build
```

## 阅读建议

- 开发新页面前阅读 `GUIDE.md`。
- 编写测试前阅读 `TEST.md`。
- 使用 AI Agent 前阅读 `AGENTS.md` / `CLAUDE.md`。

---

**最后更新**: 2026年5月27日
