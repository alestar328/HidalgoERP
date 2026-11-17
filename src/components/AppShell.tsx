import { NavLink, Outlet } from 'react-router';
import { Icon } from '@ui5/webcomponents-react';

const linkClass = ({ isActive }: { isActive: boolean }) => (isActive ? 'active' : undefined);

export function AppShell() {
  return (
    <div className="app">
      <Outlet />
      <nav className="bottom-nav" aria-label="Principal">
        <div className="bottom-nav__inner">
          <NavLink to="/" end className={linkClass}>
            <Icon name="home" aria-hidden="true" />
            Inicio
          </NavLink>
          <NavLink to="/productos" className={linkClass}>
            <Icon name="product" aria-hidden="true" />
            Productos
          </NavLink>
          <NavLink to="/vender" className="sell">
            <span className="sell__bubble">
              <Icon name="cart" aria-hidden="true" style={{ color: '#fff', width: '1.5rem', height: '1.5rem' }} />
            </span>
            Vender
          </NavLink>
          <NavLink to="/fiados" className={linkClass}>
            <Icon name="customer" aria-hidden="true" />
            Fiados
          </NavLink>
          <NavLink to="/mas" className={linkClass}>
            <Icon name="menu2" aria-hidden="true" />
            Más
          </NavLink>
        </div>
      </nav>
    </div>
  );
}
