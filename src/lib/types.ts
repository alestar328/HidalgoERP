import type { BusinessType } from '../modules/catalog';
import type { ProductSource } from '../domain/reorder';

export type Role = 'owner' | 'seller';
export type { BusinessType, ProductSource };

export const SOURCE_LABEL: Record<ProductSource, string> = {
  purchase: 'Compra a proveedor',
  production: 'Producción propia',
};

export const UNITS = ['unidad', 'docena', 'caja', 'kg', 'litro'] as const;
export type Unit = (typeof UNITS)[number];

export const UNIT_LABEL: Record<Unit, string> = {
  unidad: 'Unidad',
  docena: 'Docena',
  caja: 'Caja',
  kg: 'Kilo (kg)',
  litro: 'Litro',
};
export const UNIT_SHORT: Record<Unit, string> = {
  unidad: 'und',
  docena: 'doc',
  caja: 'caja',
  kg: 'kg',
  litro: 'L',
};

export type StockMovementType = 'initial' | 'purchase' | 'sale' | 'adjustment' | 'void' | 'import';

export const MOVEMENT_LABEL: Record<StockMovementType, string> = {
  initial: 'Stock inicial',
  purchase: 'Entrada por compra',
  sale: 'Venta',
  adjustment: 'Ajuste',
  void: 'Venta anulada',
  import: 'Importación',
};

export interface Organization {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  business_type: BusinessType;
}

export interface Category {
  id: string;
  name: string;
}

export interface Product {
  id: string;
  organization_id: string;
  parent_id: string | null;
  name: string;
  variant_label: string | null;
  sku: string | null;
  barcode: string | null;
  category_id: string | null;
  unit: Unit;
  retail_price: number;
  wholesale_price: number | null;
  wholesale_min_qty: number | null;
  stock: number;
  min_stock: number;
  active: boolean;
  /** De dónde sale al reponer: compra o producción propia. */
  source: ProductSource;
  /** Solo llega para el dueño (RLS). */
  cost: number | null;
}

export interface StockMovement {
  id: string;
  type: StockMovementType;
  qty: number;
  stock_after: number;
  reason: string | null;
  created_at: string;
}

export interface Member {
  id: string;
  user_id: string;
  role: Role;
  display_name: string | null;
  email: string | null;
}

export interface Invitation {
  id: string;
  email: string;
  accepted_at: string | null;
}
