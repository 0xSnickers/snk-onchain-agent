import { Suspense } from 'react';
import { LoadingState } from '@/components/feedback/LoadingState';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Activity,
  ArrowUpRight,
  LayoutDashboard,
  Crosshair,
  Radio,
  Settings2,
  Users,
  Wallet,
  ListChecks,
} from 'lucide-react';
import { AppControls } from './AppControls';
const links = [
  { path: '/', key: 'overview', icon: LayoutDashboard },
  { path: '/wallet', key: 'wallet', icon: Wallet },
  { path: '/activity', key: 'agent.activity', icon: ListChecks },
  { path: '/market', key: 'market', icon: Radio },
  { path: '/sniper', key: 'sniper', icon: Crosshair },
  { path: '/kols', key: 'kols', icon: Users },
  { path: '/connections', key: 'settings', icon: Settings2 },
];
export function MainLayout() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const current = links.find(({ path }) =>
    path === '/' ? pathname === '/' : pathname === path || pathname.startsWith(`${path}/`),
  );
  const title = current
    ? t(current.key.startsWith('agent.') ? current.key : `onchain.${current.key}`)
    : '';
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <NavLink to="/" className="brand">
          <span className="brand-mark">
            <Activity size={23} />
          </span>{' '}
          SNK<span className="brand-sub">ONCHAIN</span>
        </NavLink>
        <nav aria-label={t('onchain.workspace')}>
          {links.map(({ path, key, icon: Icon }) => (
            <NavLink
              key={key}
              to={path}
              end={path === '/'}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            >
              <Icon size={18} />
              {t(key.startsWith('agent.') ? key : `onchain.${key}`)}
              <ArrowUpRight size={13} className="nav-arrow" />
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <span className="status-dot" />
          {t('onchain.readonly')}
          <span className="mono">v0.2</span>
        </div>
      </aside>
      <div className="main-area">
        <header className="topbar">
          <div className="workspace-profile">
            <span className="workspace-avatar">S</span>
            <strong>{t('design.workspace')}</strong>
            {title && <span className="topbar-current">{title}</span>}
            <span className="session-indicator" aria-label={t('onchain.delegated')} />
          </div>
          <div className="topbar-actions">
            <NavLink className="header-link" to="/sniper" aria-label={t('onchain.sniper')}>
              <Crosshair size={16} />
              <span>{t('onchain.sniper')}</span>
            </NavLink>
            <NavLink className="header-link" to="/activity" aria-label={t('design.activity')}>
              <ListChecks size={16} />
              <span>{t('design.activity')}</span>
            </NavLink>
            <AppControls />
            <NavLink className="header-link" to="/connections" aria-label={t('design.settings')}>
              <Settings2 size={16} />
            </NavLink>
          </div>
        </header>
        <main>
          <Suspense fallback={<LoadingState variant="page" />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  );
}
