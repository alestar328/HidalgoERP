import { ComingSoon } from '../components/ComingSoon';
import { MODULES, type ModuleId } from './catalog';
import type { ModuleUI, NavDef, RouteDef, TileDef } from './types';

/** Rutas "Pronto" para cada tile de un módulo que llega en una fase posterior. */
function soonRoutes(id: ModuleId, tiles: TileDef[]): RouteDef[] {
  const phase = MODULES[id].phase ?? 'una próxima versión';
  const seen = new Set<string>();
  return tiles
    .filter((t) => !seen.has(t.to) && seen.add(t.to))
    .map((t) => ({ path: t.to.replace(/^\//, ''), element: <ComingSoon title={t.title} phase={phase} back="/" /> }));
}

function soonModule(id: ModuleId, tiles: TileDef[], nav?: NavDef): ModuleUI {
  return { id, tiles, routes: soonRoutes(id, tiles), nav };
}

export const ventasModule = soonModule(
  'ventas',
  [
    { id: 'vender', title: 'Nueva venta', subtitle: 'Carrito rápido', icon: 'cart', to: '/vender', primary: true },
    { id: 'ventas', title: 'Ventas del día', subtitle: 'Notas de venta', icon: 'receipt', to: '/ventas' },
  ],
  { to: '/vender', label: 'Vender', icon: 'cart', order: 20, emphasized: true },
);

export const pedidosModule = soonModule('pedidos', [
  { id: 'pedidos', title: 'Pedidos pendientes', subtitle: 'WhatsApp y encargos', icon: 'sales-order', to: '/pedidos' },
]);

export const cajaModule = soonModule('caja', [
  { id: 'caja', title: 'Caja diaria', subtitle: 'Abrir, movimientos, cierre', icon: 'money-bills', to: '/caja' },
]);

export const fiadosModule = soonModule(
  'fiados',
  [{ id: 'fiados', title: 'Fiados por cobrar', subtitle: 'Saldos y abonos', icon: 'customer', to: '/fiados' }],
  { to: '/fiados', label: 'Fiados', icon: 'customer', order: 30 },
);

export const dashboardModule = soonModule('dashboard', [
  { id: 'dashboard', title: 'Dashboard', subtitle: 'Ventas y stock real', icon: 'bar-chart', to: '/dashboard' },
]);

export const comprasModule = soonModule('compras', [
  { id: 'proveedores', title: 'Proveedores', subtitle: 'Contactos y precios', icon: 'shipping-status', to: '/proveedores' },
  { id: 'compras', title: 'Órdenes de compra', subtitle: 'Materia prima y mercadería', icon: 'request', to: '/compras' },
]);

export const produccionModule = soonModule('produccion', [
  { id: 'produccion', title: 'Órdenes de producción', subtitle: 'Taller, confección, bordado', icon: 'factory', to: '/produccion' },
]);

/** Módulos que no tienen pantalla propia: cambian lo que muestran otras (formularios, venta). */
export const preciosModule: ModuleUI = { id: 'precios', tiles: [], routes: [] };
export const variantesModule: ModuleUI = { id: 'variantes', tiles: [], routes: [] };
export const escaneoModule: ModuleUI = { id: 'escaneo', tiles: [], routes: [] };
export const pesoModule: ModuleUI = { id: 'peso', tiles: [], routes: [] };
