# React.js 开发指南

本文档说明 React.js 模板的新页面、新组件、新功能开发流程。模板使用 React 19、Vite 8、TypeScript 6、React Router 7、TanStack Query、Axios、react-i18next、Zustand、shadcn/ui 和 Radix UI。

## 开发前检查

```bash
npm install
cp .env.example .env
npm run dev
```

确认 `.env` 中的 `VITE_API_BASE_URL` 指向正确后端地址。

## 开发新页面

1. 在 `src/pages` 下创建页面文件，例如 `UserListPage.tsx`。
2. 页面只负责页面级组合、路由参数读取和布局组织。
3. 页面内复杂区域拆到 `src/components/feature`。
4. 在 `src/routes/index.tsx` 注册路由。
5. 如页面需要接口数据，优先通过 `src/services/api/*Api.ts` 和 React Query 获取。
6. 如果页面内多个子组件共享同一组上下文，优先在页面或功能模块边界增加 Provider，避免层层传递 props。

示例：

```tsx
// src/pages/UserListPage.tsx
import { UserList } from '@/components/feature/UserList';

export function UserListPage() {
  return <UserList />;
}
```

## 开发新组件

按组件职责选择目录：

- `src/components/ui`：shadcn/ui 风格的无业务基础组件，如 Button、Modal、Input。
- `src/components/error`：错误边界和错误兜底组件。
- `src/components/layout`：页面布局、导航、侧边栏。
- `src/components/feature`：业务组件，如 UserList、OrderForm。
- `src/providers`：应用级或功能级 Provider，用于共享页面上下文、筛选条件、步骤状态等。

组件规范：

- 单个组件不超过 500 行，超过应拆分。
- Props 必须定义 TypeScript 类型。
- 不在组件里直接调用 `axios` 或 `fetch`。
- 不在组件里写复杂数据转换，提取到 hook 或 utils。
- 避免把同一组 props 连续向下传递 3 层以上；出现 prop drilling 时，优先抽取功能级 Provider 或组合组件。

## 开发新功能

推荐顺序：

1. 在 `src/types` 定义接口类型。
2. 在 `src/services/api` 新增接口封装。
3. 在 `src/hooks` 封装数据获取或业务动作。
4. 如多个业务组件共享页面上下文，在 `src/providers` 或功能目录中定义 Provider。
5. 在 `src/components/feature` 实现业务 UI。
6. 在 `src/pages` 组合页面。
7. 补充必要测试。

## HTTP 请求规范

所有 HTTP 请求统一通过 `src/services/api/httpClient.ts`。

```ts
// src/services/api/userApi.ts
import { httpClient } from './httpClient';

export function getUsers() {
  return httpClient.get('/users');
}
```

禁止在页面、组件、hook 中直接散落调用 `fetch` 或创建新的 Axios 实例。

`httpClient` 已内置请求 ID、`Accept-Language`、Bearer Token 注入、业务错误码识别和 Axios 错误归一化。认证 Token 通过 `src/services/api/authToken.ts` 读写，统一错误类型通过 `src/services/api/apiError.ts` 暴露。

## 错误处理和国际化

- 全局错误边界在 `src/components/error/ErrorBoundary.tsx`，入口已在 `src/main.tsx` 包裹。
- 国际化配置集中在 `src/i18n`，组件文案优先通过 `useTranslation` 读取语言包。
- 新增页面时，页面标题、按钮和状态提示等用户可见文案优先添加到语言包。
- 语言和主题切换入口在 `src/components/layout/AppControls.tsx`。
- 主题色配置集中在 `src/theme/config.ts`，通过 CSS 变量覆盖 Tailwind v4 主题色。

## 状态管理

- 服务端数据优先使用 TanStack Query。
- 跨页面客户端状态使用 `src/store` 中的 Zustand store。
- 页面或功能模块内部共享上下文优先使用 Provider。
- 组件内部临时状态使用 `useState`。
- 不把表单输入、弹窗开关等局部状态放入全局 store。

## Provider 使用规范

Provider 用于解决页面或功能模块内部的 prop drilling，不是替代 Zustand 的全局状态工具。

适合使用 Provider 的场景：

- 同一页面内多个兄弟组件需要共享筛选条件、选中项、编辑模式。
- 一个功能模块有多层子组件共同依赖当前业务实体。
- 表单向导、步骤流、局部权限、局部 UI 配置需要在模块内共享。
- 需要把页面级动作统一暴露给深层业务组件。

不适合使用 Provider 的场景：

- 只有父子两层传递，直接使用 props。
- 登录态、用户信息、主题等跨页面状态，使用 Zustand 或应用级 Provider。
- 接口数据缓存，优先使用 TanStack Query。
- 临时输入值或弹窗开关只被单个组件使用，使用 `useState`。

推荐结构：

```tsx
// src/providers/UserListProvider.tsx
import { createContext, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

interface UserListContextValue {
  keyword: string;
  setKeyword: (keyword: string) => void;
}

const UserListContext = createContext<UserListContextValue | null>(null);

export function UserListProvider({ children }: { children: ReactNode }) {
  const [keyword, setKeyword] = useState('');

  const value = useMemo(
    () => ({
      keyword,
      setKeyword,
    }),
    [keyword],
  );

  return <UserListContext.Provider value={value}>{children}</UserListContext.Provider>;
}

export function useUserListContext() {
  const context = useContext(UserListContext);

  if (!context) {
    throw new Error('useUserListContext must be used within UserListProvider');
  }

  return context;
}
```

使用方式：

```tsx
// src/pages/UserListPage.tsx
import { UserList } from '@/components/feature/UserList';
import { UserListProvider } from '@/providers/UserListProvider';

export function UserListPage() {
  return (
    <UserListProvider>
      <UserList />
    </UserListProvider>
  );
}
```

## 测试规范

- 基础组件、复杂 hook、关键业务组件需要测试。
- 测试文件可以与组件同目录，例如 `Button.test.tsx`。
- 普通展示页面不强制测试。

```bash
npm run test
```

## 提交前检查

```bash
npm run lint
npm run format:check
npm run typecheck
npm run test
npm run build
```

---

**最后更新**: 2026年5月28日
