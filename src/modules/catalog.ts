/**
 * Catálogo de módulos: qué existe, de qué depende cada uno y qué trae cada paquete por rubro.
 * Es la fuente de verdad del producto estándar. Sin React, para poder probarlo.
 *
 * Agregar un módulo = una entrada aquí + su carpeta en src/modules/<id> con tiles y rutas.
 * Agregar un rubro = una entrada en BUSINESS_TYPES (y el valor en el enum de la migración).
 */

export const MODULE_IDS = [
  // núcleo
  'productos',
  'ventas',
  'caja',
  'dashboard',
  'admin',
  // opcionales
  'pedidos',
  'fiados',
  'precios',
  'variantes',
  'reposicion',
  'compras',
  'produccion',
  'escaneo',
  'peso',
] as const;
export type ModuleId = (typeof MODULE_IDS)[number];

/** Espacios del launchpad (pestañas en escritorio, secciones en el celular). */
export const SPACES = [
  { id: 'vender', title: 'Vender' },
  { id: 'inventario', title: 'Inventario' },
  { id: 'abastecimiento', title: 'Abastecimiento' },
  { id: 'clientes', title: 'Clientes y cobros' },
  { id: 'analisis', title: 'Análisis' },
  { id: 'admin', title: 'Administración' },
] as const;
export type SpaceId = (typeof SPACES)[number]['id'];

export interface ModuleInfo {
  id: ModuleId;
  title: string;
  description: string;
  /** El núcleo está siempre encendido y no se puede apagar. */
  core: boolean;
  /** Módulos que tienen que estar encendidos para que este funcione. */
  requires: ModuleId[];
  space: SpaceId;
  /** 'soon': ya aparece en el launchpad y en ajustes, pero su pantalla llega en una fase posterior. */
  status: 'ready' | 'soon';
  /** Fase del plan en la que llega (para los que están en 'soon'). */
  phase?: string;
}

export const MODULES: Record<ModuleId, ModuleInfo> = {
  productos: {
    id: 'productos',
    title: 'Productos y stock',
    description: 'Catálogo, unidades, movimientos de stock y ajustes con motivo.',
    core: true,
    requires: [],
    space: 'inventario',
    status: 'ready',
  },
  ventas: {
    id: 'ventas',
    title: 'Ventas y notas de venta',
    description: 'Carrito rápido, pago con efectivo, Yape, Plin o tarjeta y nota por WhatsApp.',
    core: true,
    requires: ['productos'],
    space: 'vender',
    status: 'soon',
    phase: 'la fase (b): ventas y pedidos',
  },
  caja: {
    id: 'caja',
    title: 'Caja diaria',
    description: 'Apertura, ingresos y egresos, cierre con diferencia.',
    core: true,
    requires: ['ventas'],
    space: 'vender',
    status: 'soon',
    phase: 'la fase (c): caja diaria',
  },
  dashboard: {
    id: 'dashboard',
    title: 'Dashboard',
    description: 'Ventas, stock real y alertas en un vistazo.',
    core: true,
    requires: ['productos'],
    space: 'analisis',
    status: 'soon',
    phase: 'la fase (e): dashboard',
  },
  admin: {
    id: 'admin',
    title: 'Administración',
    description: 'Datos del negocio, vendedores, módulos e importación de Excel.',
    core: true,
    requires: [],
    space: 'admin',
    status: 'ready',
  },
  pedidos: {
    id: 'pedidos',
    title: 'Pedidos',
    description: 'Ventas pendientes de entrega, por ejemplo las que llegan por WhatsApp.',
    core: false,
    requires: ['ventas'],
    space: 'vender',
    status: 'soon',
    phase: 'la fase (b): ventas y pedidos',
  },
  fiados: {
    id: 'fiados',
    title: 'Fiados y cobros',
    description: 'Saldo por cliente, abonos y recordatorio por WhatsApp.',
    core: false,
    requires: ['ventas'],
    space: 'clientes',
    status: 'soon',
    phase: 'la fase (d): fiados y cobros',
  },
  precios: {
    id: 'precios',
    title: 'Precio por mayor',
    description: 'Precio especial desde cierta cantidad. Más adelante, listas como “colegio”.',
    core: false,
    requires: ['productos'],
    space: 'clientes',
    status: 'ready',
  },
  variantes: {
    id: 'variantes',
    title: 'Variantes',
    description: 'Talla, color o modelo, cada una con su propio stock.',
    core: false,
    requires: ['productos'],
    space: 'inventario',
    status: 'ready',
  },
  reposicion: {
    id: 'reposicion',
    title: 'Stock mínimo y reposición',
    description: 'Lista de lo que bajó de su mínimo, con cantidad sugerida, lista para pedir.',
    core: false,
    requires: ['productos'],
    space: 'inventario',
    status: 'ready',
  },
  compras: {
    id: 'compras',
    title: 'Proveedores y compras',
    description: 'Órdenes de compra; al recibirlas, entra el stock.',
    core: false,
    requires: ['productos'],
    space: 'abastecimiento',
    status: 'soon',
    phase: 'la fase (h): proveedores y compras',
  },
  produccion: {
    id: 'produccion',
    title: 'Producción y confección',
    description: 'Órdenes de taller o bordado; al terminar, las prendas entran al stock.',
    core: false,
    requires: ['compras'],
    space: 'abastecimiento',
    status: 'soon',
    phase: 'la fase (i): producción y confección',
  },
  escaneo: {
    id: 'escaneo',
    title: 'Escaneo de código de barras',
    description: 'Agregar productos a la venta con la cámara del celular.',
    core: false,
    requires: ['ventas'],
    space: 'vender',
    status: 'soon',
    phase: 'la fase (b): ventas y pedidos',
  },
  peso: {
    id: 'peso',
    title: 'Venta por peso',
    description: 'Precio por kilo y cantidades con decimales, para fruterías y bodegas.',
    core: false,
    requires: ['ventas'],
    space: 'vender',
    status: 'soon',
    phase: 'la fase (b): ventas y pedidos',
  },
};

export const BUSINESS_TYPE_IDS = ['general', 'bodega', 'limpieza', 'fruteria', 'iluminacion', 'ropa'] as const;
export type BusinessType = (typeof BUSINESS_TYPE_IDS)[number];

export interface BusinessTypeInfo {
  id: BusinessType;
  title: string;
  /** Nombre corto para tablas. */
  short: string;
  example: string;
  /** Módulos opcionales que vienen encendidos. El núcleo siempre está. */
  modules: ModuleId[];
}

export const BUSINESS_TYPES: Record<BusinessType, BusinessTypeInfo> = {
  general: {
    id: 'general',
    short: 'Otro',
    title: 'Otro tipo de negocio',
    example: 'Lo básico; activas lo demás cuando lo necesites',
    modules: ['pedidos', 'fiados', 'reposicion'],
  },
  bodega: {
    id: 'bodega',
    short: 'Bodega',
    title: 'Bodega',
    example: 'Abarrotes, bebidas, golosinas',
    modules: ['pedidos', 'fiados', 'reposicion', 'compras', 'escaneo', 'peso'],
  },
  limpieza: {
    id: 'limpieza',
    short: 'Limpieza',
    title: 'Limpieza y ferretería',
    example: 'Venta por menor y por mayor',
    modules: ['pedidos', 'fiados', 'precios', 'reposicion', 'compras', 'escaneo'],
  },
  fruteria: {
    id: 'fruteria',
    short: 'Frutería',
    title: 'Frutería',
    example: 'Venta por kilo',
    modules: ['pedidos', 'fiados', 'precios', 'reposicion', 'compras', 'peso'],
  },
  iluminacion: {
    id: 'iluminacion',
    short: 'Ilumin.',
    title: 'Iluminación y electricidad',
    example: 'Puestos de galería, modelos y potencias',
    modules: ['pedidos', 'precios', 'variantes', 'reposicion', 'compras', 'escaneo'],
  },
  ropa: {
    id: 'ropa',
    short: 'Ropa',
    title: 'Ropa y confección',
    example: 'Uniformes, tallas, taller propio',
    modules: ['pedidos', 'fiados', 'precios', 'variantes', 'reposicion', 'compras', 'produccion'],
  },
};

export const CORE_MODULES: ModuleId[] = MODULE_IDS.filter((id) => MODULES[id].core);
export const OPTIONAL_MODULES: ModuleId[] = MODULE_IDS.filter((id) => !MODULES[id].core);

export function isModuleId(value: string): value is ModuleId {
  return (MODULE_IDS as readonly string[]).includes(value);
}

export function isBusinessType(value: string): value is BusinessType {
  return (BUSINESS_TYPE_IDS as readonly string[]).includes(value);
}
