export type StockStatus = 'out' | 'low' | 'ok';

/** Agotado: 0 o menos. Bajo: en el mínimo o por debajo (si hay mínimo definido). */
export function stockStatus(stock: number, minStock: number): StockStatus {
  if (stock <= 0) return 'out';
  if (minStock > 0 && stock <= minStock) return 'low';
  return 'ok';
}

const SEVERITY: Record<StockStatus, number> = { ok: 0, low: 1, out: 2 };

export function worstStatus(statuses: StockStatus[]): StockStatus {
  return statuses.reduce<StockStatus>((worst, s) => (SEVERITY[s] > SEVERITY[worst] ? s : worst), 'ok');
}

interface Groupable {
  id: string;
  parent_id: string | null;
  stock: number;
  min_stock: number;
  active: boolean;
}

export interface ProductGroup<T> {
  product: T;
  /** Variantes activas (vacío si el producto no tiene). */
  variants: T[];
  /** Stock propio, o la suma de las variantes. */
  totalStock: number;
  /** El peor estado entre las variantes: basta una talla agotada para avisar. */
  status: StockStatus;
}

/** Agrupa variantes bajo su producto principal. El principal con variantes no lleva stock propio. */
export function groupProducts<T extends Groupable>(products: T[]): ProductGroup<T>[] {
  const children = new Map<string, T[]>();
  for (const p of products) {
    if (p.parent_id) {
      const list = children.get(p.parent_id) ?? [];
      list.push(p);
      children.set(p.parent_id, list);
    }
  }
  return products
    .filter((p) => !p.parent_id)
    .map((product) => {
      const all = children.get(product.id) ?? [];
      const variants = all.filter((v) => v.active);
      if (all.length === 0) {
        return { product, variants, totalStock: product.stock, status: stockStatus(product.stock, product.min_stock) };
      }
      return {
        product,
        variants,
        totalStock: variants.reduce((sum, v) => sum + v.stock, 0),
        status: worstStatus(variants.map((v) => stockStatus(v.stock, v.min_stock))),
      };
    });
}

/** Cuántos artículos vendibles están bajos o agotados (cada variante cuenta por separado). */
export function countAlerts<T extends Groupable>(products: T[]): { low: number; out: number } {
  const parents = new Set(products.filter((p) => p.parent_id).map((p) => p.parent_id));
  let low = 0;
  let out = 0;
  for (const p of products) {
    if (!p.active || parents.has(p.id)) continue;
    const s = stockStatus(p.stock, p.min_stock);
    if (s === 'low') low += 1;
    if (s === 'out') out += 1;
  }
  return { low, out };
}
