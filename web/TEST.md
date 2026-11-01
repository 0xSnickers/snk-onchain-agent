# React.js 单元测试指南

本模板使用 Vitest + React Testing Library。测试目标不是覆盖实现细节，而是验证用户可感知行为、业务分支和关键状态变化。

## 测试命令

```bash
npm run test
npm run test:watch
```

提交前建议同时运行：

```bash
npm run lint
npm run typecheck
npm run test
```

## 测试文件放置规则

- 组件测试放在组件同级目录，例如 `src/components/ui/button.test.tsx`。
- 页面测试放在页面同级目录，例如 `src/pages/UserListPage.test.tsx`。
- Hook 测试放在 Hook 同级目录，例如 `src/hooks/useAuth.test.ts`。
- Provider 测试放在 Provider 同级目录，例如 `src/providers/UserListProvider.test.tsx`。
- API 纯函数或数据转换测试放在对应模块同级目录，例如 `src/services/api/userApi.test.ts`。
- 跨模块集成测试可放在 `tests/` 目录。

## 新增组件如何写测试

组件测试优先验证：

- 是否渲染核心内容。
- 是否响应点击、输入、选择等用户行为。
- loading、disabled、empty、error 等状态是否正确。
- 对外回调是否按预期触发。

示例：

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from './Button';

describe('Button', () => {
  it('calls onClick when user clicks it', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();

    render(<Button onClick={onClick}>保存</Button>);

    await user.click(screen.getByRole('button', { name: '保存' }));

    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
```

## 新增页面如何写测试

页面测试重点验证页面组合后的用户流程，不要过度断言 DOM 结构。

建议覆盖：

- 页面标题、核心操作按钮、主要数据区域。
- 空状态和错误状态。
- 点击按钮后是否跳转、弹窗或触发请求。
- 依赖路由时使用 `MemoryRouter` 包裹。

示例：

```tsx
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { HomePage } from './HomePage';

describe('HomePage', () => {
  it('renders page title', () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading')).toBeInTheDocument();
  });
});
```

如果页面依赖 TanStack Query，需要在测试里提供 `QueryClientProvider`。建议在测试文件内创建独立 `QueryClient`，避免用例之间缓存互相影响。

## 新增功能如何写测试

新增功能通常至少包含一个页面、一个业务组件、一个接口方法和一个状态或 Hook。建议按下面顺序补测试：

1. 先测纯函数、类型转换、参数拼装。
2. 再测业务 Hook 或 Zustand store 的状态变化。
3. 再测组件交互。
4. 最后测页面级主流程。

接口调用统一通过 `src/services/api/httpClient.ts` 和 `src/services/api/*Api.ts`。测试中不要真实请求后端，使用 `vi.mock` mock API 模块。

示例：

```tsx
import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { getCurrentUser } from '@/services/api/userApi';
import { ProfileCard } from './ProfileCard';

vi.mock('@/services/api/userApi', () => ({
  getCurrentUser: vi.fn(),
}));

describe('ProfileCard', () => {
  it('renders current user name', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({
      id: '1',
      name: 'Alice',
      email: 'alice@example.com',
    });

    render(<ProfileCard />);

    expect(await screen.findByText('Alice')).toBeInTheDocument();
  });
});
```

## Zustand Store 测试

Store 测试关注 action 后的状态变化。每个用例前重置 store，避免状态串联。

```ts
import { useAuthStore } from './authStore';

describe('authStore', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null, token: null });
  });

  it('sets token after login', () => {
    useAuthStore.getState().setToken('token');

    expect(useAuthStore.getState().token).toBe('token');
  });
});
```

## Provider 测试

Provider 测试重点验证上下文默认值、更新动作和未包裹 Provider 时的错误提示。使用一个测试组件消费 context，不要直接测试内部 state。

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UserListProvider, useUserListContext } from './UserListProvider';

function TestConsumer() {
  const { keyword, setKeyword } = useUserListContext();

  return (
    <>
      <span>{keyword || 'empty'}</span>
      <button onClick={() => setKeyword('Alice')}>change</button>
    </>
  );
}

describe('UserListProvider', () => {
  it('shares keyword through context', async () => {
    const user = userEvent.setup();

    render(
      <UserListProvider>
        <TestConsumer />
      </UserListProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'change' }));

    expect(screen.getByText('Alice')).toBeInTheDocument();
  });
});
```

## 注意事项

- 优先使用 `getByRole`、`getByLabelText`、`getByText` 等接近用户行为的查询方式。
- 不测试组件内部 className、私有变量、实现步骤。
- 所有异步 UI 使用 `findBy*` 或 `waitFor`。
- mock 范围尽量小，只 mock 外部依赖、API 请求、浏览器能力。
- 新增公共组件必须至少包含一个基础渲染测试和一个关键交互测试。
- 新增 Provider 必须覆盖 context 值读取和核心更新动作。
- 新增业务功能必须覆盖成功、失败、空数据三类核心状态。

---

**最后更新**: 2026年5月27日
