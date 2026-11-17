import type { ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '@ui5/webcomponents-react';

interface Props {
  title: string;
  /** Ruta a la que vuelve la flecha. Sin esto no hay flecha. */
  back?: string;
  actions?: ReactNode;
}

export function PageHeader({ title, back, actions }: Props) {
  const navigate = useNavigate();
  return (
    <header className="page-header">
      {back && (
        <Button
          design="Transparent"
          icon="nav-back"
          accessibleName="Volver"
          tooltip="Volver"
          onClick={() => navigate(back)}
        />
      )}
      <h1>{title}</h1>
      {actions}
    </header>
  );
}
