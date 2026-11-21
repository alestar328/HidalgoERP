import { Suspense } from 'react';
import { NavLink, Outlet } from 'react-router';
import { BusyIndicator, Icon } from '@ui5/webcomponents-react';
import { useModules } from '../modules/ModulesProvider';
import { bottomNav } from '../modules/registry';

const linkClass = ({ isActive }: { isActive: boolean }) => (isActive ? 'active' : undefined);

const loading = (
  <div className="page" aria-busy="true">
    <BusyIndicator active delay={300} size="L" style={{ margin: '3rem auto' }} />
  </div>
);

export function AppShell() {
  const { active, loading: modulesLoading } = useModules();
  const items = bottomNav(active);

  return (
    <div className="app">
      {modulesLoading ? loading : <Suspense fallback={loading}><Outlet /></Suspense>}
      <nav className="bottom-nav" aria-label="Principal" data-tour="nav">
        <div className="bottom-nav__inner" style={{ gridTemplateColumns: `repeat(${items.length}, 1fr)` }}>
          {items.map((item) =>
            item.emphasized ? (
              <NavLink key={item.to} to={item.to} className="sell">
                <span className="sell__bubble">
                  <Icon name={item.icon} aria-hidden="true" style={{ color: '#fff', width: '1.5rem', height: '1.5rem' }} />
                </span>
                {item.label}
              </NavLink>
            ) : (
              <NavLink key={item.to} to={item.to} end={item.to === '/'} className={linkClass}>
                <Icon name={item.icon} aria-hidden="true" />
                {item.label}
              </NavLink>
            ),
          )}
        </div>
      </nav>
    </div>
  );
}
