import { lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { NotFoundPage } from '@/pages/NotFoundPage';
const Home = lazy(() => import('@/pages/HomePage').then((m) => ({ default: m.HomePage })));
const Workspace = lazy(() =>
  import('@/pages/WorkspacePage').then((m) => ({ default: m.WorkspacePage })),
);
const Agent = lazy(() => import('@/pages/AgentPage').then((m) => ({ default: m.AgentPage })));
const Sniper = lazy(() => import('@/pages/SniperPage').then((m) => ({ default: m.SniperPage })));
export function AppRoutes() {
  return (
    <Routes>
      <Route element={<MainLayout />}>
        <Route index element={<Home />} />
        <Route path="activity" element={<Agent />} />
        <Route path="agent/runs" element={<Navigate to="/activity#runs" replace />} />
        <Route path="mint" element={<Navigate to="/activity#mint" replace />} />
        <Route path="sniper" element={<Sniper />} />
        {(['wallet', 'market', 'kols', 'connections'] as const).map((path) => (
          <Route
            key={path}
            path={path}
            element={<Workspace section={path === 'connections' ? 'settings' : path} />}
          />
        ))}
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
