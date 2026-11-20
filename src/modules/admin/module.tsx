import { SettingsPage } from '../../features/settings/SettingsPage';
import { ComingSoon } from '../../components/ComingSoon';
import { MODULE_IDS } from '../catalog';
import { useModules } from '../ModulesProvider';
import type { ModuleUI } from '../types';
import { lazyPage } from '../lazy';

const ModulesPage = lazyPage(() => import('./ModulesPage'), 'ModulesPage');

export const adminModule: ModuleUI = {
  id: 'admin',
  tiles: [
    {
      id: 'modulos',
      title: 'Módulos activos',
      subtitle: 'Elige qué apps usa tu negocio',
      icon: 'puzzle',
      to: '/modulos',
      ownerOnly: true,
      useKpi: () => {
        const { active } = useModules();
        return { value: String(active.size), unit: `de ${MODULE_IDS.length}` };
      },
    },
    {
      id: 'ajustes',
      title: 'Mi negocio',
      subtitle: 'Datos y vendedores',
      icon: 'action-settings',
      to: '/ajustes',
      ownerOnly: true,
    },
    {
      id: 'importar',
      title: 'Importar desde Excel',
      subtitle: 'Productos y clientes',
      icon: 'excel-attachment',
      to: '/importar',
      ownerOnly: true,
      soon: true,
    },
  ],
  routes: [
    { path: 'ajustes', element: <SettingsPage /> },
    { path: 'modulos', element: <ModulesPage /> },
    { path: 'importar', element: <ComingSoon title="Importar Excel" phase="la fase (f): importación" back="/" /> },
  ],
};
