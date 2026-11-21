import { Link } from 'react-router';
import { Button, Icon } from '@ui5/webcomponents-react';
import { PageHeader } from '../../components/PageHeader';
import { useAuth, useShop } from '../auth/AuthProvider';

interface Item {
  to: string;
  icon: string;
  label: string;
  ownerOnly?: boolean;
  soon?: boolean;
}

// Las apps de cada módulo están en Inicio; aquí solo lo de la cuenta y el negocio.
const ITEMS: Item[] = [
  { to: '/', icon: 'home', label: 'Todas las apps' },
  { to: '/ayuda', icon: 'sys-help', label: 'Tutoriales y ayuda' },
  { to: '/modulos', icon: 'puzzle', label: 'Módulos activos', ownerOnly: true },
  { to: '/ajustes', icon: 'action-settings', label: 'Mi negocio y vendedores', ownerOnly: true },
  { to: '/importar', icon: 'excel-attachment', label: 'Importar Excel', ownerOnly: true, soon: true },
];

export function MorePage() {
  const { isOwner, organization, user } = useShop();
  const { signOut } = useAuth();

  return (
    <div className="page">
      <PageHeader title="Más" />
      <div className="content">
        <div className="card card--flush">
          <ul className="list">
            {ITEMS.filter((i) => !i.ownerOnly || isOwner).map((i) => (
              <li key={i.to}>
                <Link className="list-item" to={i.to}>
                  <Icon name={i.icon} aria-hidden="true" />
                  <span className="list-item__main">
                    <span className="list-item__title">{i.label}</span>
                  </span>
                  {i.soon && <span className="muted">Pronto</span>}
                  <Icon name="slim-arrow-right" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <p className="muted center">
          {organization.name} · {isOwner ? 'Dueño' : 'Vendedor'}
          <br />
          {user.email}
        </p>
        <Button className="btn-block" icon="log" onClick={() => void signOut()}>
          Cerrar sesión
        </Button>
      </div>
    </div>
  );
}
