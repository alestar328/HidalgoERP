import type { ReactNode } from 'react';
import type { ModuleId } from './catalog';

/** Indicador que muestra un tile (un número y su unidad, con color según el estado). */
export interface KpiValue {
  value: string;
  unit?: string;
  tone?: 'neutral' | 'positive' | 'critical' | 'negative' | 'brand';
}

export interface TileDef {
  id: string;
  title: string;
  subtitle?: string;
  /** Nombre de ícono de UI5 (registrado en src/icons.ts). */
  icon: string;
  to: string;
  /** Tile destacado (azul), p. ej. "Nueva venta". */
  primary?: boolean;
  ownerOnly?: boolean;
  /** La pantalla todavía no existe (además de los módulos marcados 'soon' en el catálogo). */
  soon?: boolean;
  /** Otros módulos que deben estar activos para mostrar el tile. */
  requires?: ModuleId[];
  /** Hook que calcula el indicador. Cada tile lo llama siempre (no cambia entre renders). */
  useKpi?: () => KpiValue | null;
}

export interface RouteDef {
  path: string;
  element: ReactNode;
  /** Otros módulos que deben estar activos para entrar a esta ruta. */
  requires?: ModuleId[];
}

export interface NavDef {
  to: string;
  label: string;
  icon: string;
  /** Posición en la barra inferior (menor = más a la izquierda). */
  order: number;
  /** El botón central destacado (Vender). */
  emphasized?: boolean;
}

/** Lo que un módulo aporta a la interfaz. Lo demás (nombre, dependencias) está en catalog.ts. */
export interface ModuleUI {
  id: ModuleId;
  tiles: TileDef[];
  routes: RouteDef[];
  nav?: NavDef;
}
