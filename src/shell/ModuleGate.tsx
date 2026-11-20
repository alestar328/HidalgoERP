import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { PageHeader } from '../components/PageHeader';
import { EmptyState } from '../components/Fields';
import { useShop } from '../features/auth/AuthProvider';
import { MODULES, type ModuleId } from '../modules/catalog';
import { useModules } from '../modules/ModulesProvider';

/** Deja entrar a la pantalla solo si sus módulos están activos para este negocio. */
export function ModuleGate({ modules, children }: { modules: ModuleId[]; children: ReactNode }) {
  const { active } = useModules();
  const { isOwner } = useShop();
  const missing = modules.filter((m) => !active.has(m));
  if (missing.length === 0) return <>{children}</>;

  const names = missing.map((m) => MODULES[m].title).join(', ');
  return (
    <div className="page">
      <PageHeader title={MODULES[missing[0]].title} back="/" />
      <EmptyState
        title="Módulo no activo"
        text={`${names} no está activo en tu negocio.${isOwner ? '' : ' Pídele al dueño que lo active.'}`}
      >
        {isOwner && <Link to="/modulos">Activar en Módulos</Link>}
      </EmptyState>
    </div>
  );
}
