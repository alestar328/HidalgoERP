import { useMemo } from 'react';
import { countAlerts } from '../../domain/stock';
import type { ModuleUI } from '../types';
import { lazyPage } from '../lazy';
import { useProducts } from '../productos/api';

const ReposicionPage = lazyPage(() => import('./ReposicionPage'), 'ReposicionPage');

export function useStockAlerts() {
  const products = useProducts();
  return useMemo(() => (products.data ? countAlerts(products.data) : null), [products.data]);
}

export const reposicionModule: ModuleUI = {
  id: 'reposicion',
  tiles: [
    {
      id: 'reposicion',
      title: 'Stock mínimo',
      subtitle: 'Aviso de reposición',
      icon: 'alert',
      to: '/reposicion',
      useKpi: () => {
        const alerts = useStockAlerts();
        if (!alerts) return null;
        const n = alerts.low + alerts.out;
        return { value: String(n), unit: n === 1 ? 'alerta' : 'alertas', tone: alerts.out > 0 ? 'negative' : n > 0 ? 'critical' : 'positive' };
      },
    },
  ],
  routes: [{ path: 'reposicion', element: <ReposicionPage /> }],
  nav: { to: '/reposicion', label: 'Reponer', icon: 'alert', order: 31 },
};
