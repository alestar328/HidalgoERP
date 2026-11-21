import type { ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { Button } from '@ui5/webcomponents-react';

interface Props {
  title: string;
  /** Ruta a la que vuelve la flecha. Sin esto no hay flecha. */
  back?: string;
  actions?: ReactNode;
  /** Botón de ayuda (abre los tutoriales de esta pantalla). */
  help?: boolean;
}

/** Botón "?" que abre los tutoriales, con la pantalla actual para mostrar primero su guía. */
export function HelpButton() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  return (
    <Button
      design="Transparent"
      icon="sys-help"
      accessibleName="Ayuda y tutoriales"
      tooltip="Ayuda y tutoriales"
      data-tour="help"
      onClick={() => navigate(`/ayuda?desde=${encodeURIComponent(pathname)}`)}
    />
  );
}

export function PageHeader({ title, back, actions, help = true }: Props) {
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
      {help && <HelpButton />}
    </header>
  );
}
