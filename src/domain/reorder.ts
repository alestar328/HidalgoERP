import { stockStatus, type StockStatus } from './stock';

export type ProductSource = 'purchase' | 'production';

export interface ReorderCandidate {
  id: string;
  parent_id: string | null;
  name: string;
  variant_label: string | null;
  stock: number;
  min_stock: number;
  active: boolean;
  source: ProductSource;
}

export interface ReorderItem<T extends ReorderCandidate = ReorderCandidate> {
  product: T;
  /** Nombre con la variante: "Buzo completo · Talla 12". */
  label: string;
  status: Exclude<StockStatus, 'ok'>;
  /** Cuánto pedir para volver al doble del mínimo. null si no hay mínimo definido. */
  suggested: number | null;
}

/** Cantidad sugerida: llegar al doble del mínimo. Sin mínimo no hay sugerencia. */
export function suggestedQty(stock: number, minStock: number): number | null {
  if (minStock <= 0) return null;
  return Math.max(1, Math.ceil(minStock * 2 - stock));
}

/**
 * Lo que hay que reponer: artículos vendibles y activos que están agotados o en su mínimo.
 * Un producto principal con variantes no se repone; se reponen sus variantes.
 * Primero los agotados, luego los más lejos de su mínimo.
 */
export function reorderList<T extends ReorderCandidate>(products: T[]): ReorderItem<T>[] {
  const parents = new Set(products.filter((p) => p.parent_id).map((p) => p.parent_id));
  const items: ReorderItem<T>[] = [];
  for (const p of products) {
    if (!p.active || parents.has(p.id)) continue;
    const status = stockStatus(p.stock, p.min_stock);
    if (status === 'ok') continue;
    items.push({
      product: p,
      label: p.variant_label ? `${p.name} · ${p.variant_label}` : p.name,
      status,
      suggested: suggestedQty(p.stock, p.min_stock),
    });
  }
  const gap = (i: ReorderItem<T>) => (i.product.min_stock > 0 ? i.product.stock / i.product.min_stock : 0);
  return items.sort(
    (a, b) =>
      Number(b.status === 'out') - Number(a.status === 'out') || gap(a) - gap(b) || a.label.localeCompare(b.label, 'es'),
  );
}

/** Separa la lista por origen. Si producción no está activa, todo se compra. */
export function splitBySource<T extends ReorderCandidate>(
  items: ReorderItem<T>[],
  productionEnabled: boolean,
): { purchase: ReorderItem<T>[]; production: ReorderItem<T>[] } {
  const production = productionEnabled ? items.filter((i) => i.product.source === 'production') : [];
  const purchase = productionEnabled ? items.filter((i) => i.product.source !== 'production') : items;
  return { purchase, production };
}

/** Texto para mandar por WhatsApp al proveedor o al taller. */
export function reorderMessage(
  title: string,
  items: { label: string; qty: number | null; unit: string }[],
  shopName: string,
): string {
  const lines = items.map((i) => `• ${i.label}: ${i.qty == null ? 'por definir' : `${i.qty} ${i.unit}`}`);
  return [`*${title}* — ${shopName}`, '', ...lines, '', 'Gracias.'].join('\n');
}

export function whatsappShareUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
