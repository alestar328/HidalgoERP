import { MODULE_IDS, type ModuleId } from './catalog';
import type { ModuleUI, NavDef, TileDef } from './types';
import { adminModule } from './admin/module';
import { productosModule } from './productos/module';
import { reposicionModule } from './reposicion/module';
import {
  cajaModule,
  comprasModule,
  dashboardModule,
  escaneoModule,
  fiadosModule,
  pedidosModule,
  pesoModule,
  preciosModule,
  produccionModule,
  variantesModule,
  ventasModule,
} from './placeholders';

/** La interfaz de cada módulo. El tipo obliga a que todos los del catálogo estén aquí. */
export const MODULE_UI: Record<ModuleId, ModuleUI> = {
  productos: productosModule,
  ventas: ventasModule,
  caja: cajaModule,
  dashboard: dashboardModule,
  admin: adminModule,
  pedidos: pedidosModule,
  fiados: fiadosModule,
  precios: preciosModule,
  variantes: variantesModule,
  reposicion: reposicionModule,
  compras: comprasModule,
  produccion: produccionModule,
  escaneo: escaneoModule,
  peso: pesoModule,
};

export interface VisibleTile extends TileDef {
  module: ModuleId;
}

/** Tiles que ve este usuario: módulo activo, dependencias activas y rol permitido. */
export function visibleTiles(active: Set<ModuleId>, isOwner: boolean): VisibleTile[] {
  return MODULE_IDS.filter((id) => active.has(id)).flatMap((id) =>
    MODULE_UI[id].tiles
      .filter((t) => (!t.ownerOnly || isOwner) && (t.requires ?? []).every((r) => active.has(r)))
      .map((t) => ({ ...t, module: id })),
  );
}

/** Barra inferior: Inicio + hasta 3 accesos de módulos activos + Más. */
export function bottomNav(active: Set<ModuleId>): NavDef[] {
  const fromModules = MODULE_IDS.filter((id) => active.has(id))
    .map((id) => MODULE_UI[id].nav)
    .filter((n): n is NavDef => Boolean(n))
    .sort((a, b) => a.order - b.order)
    .slice(0, 3);
  return [
    { to: '/', label: 'Inicio', icon: 'home', order: 0 },
    ...fromModules,
    { to: '/mas', label: 'Más', icon: 'menu2', order: 100 },
  ];
}
