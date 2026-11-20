import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { uuid } from '../../lib/uuid';
import { normalizeText } from '../../lib/normalize';
import type { Category, Product, ProductSource, StockMovement, StockMovementType, Unit } from '../../lib/types';
import { useShop } from '../../features/auth/AuthProvider';

const PAGE = 1000;

type ProductRow = Omit<Product, 'cost'> & {
  product_costs: { cost: number } | { cost: number }[] | null;
};

function toProduct(row: ProductRow): Product {
  const { product_costs: pc, ...rest } = row;
  const costRow = Array.isArray(pc) ? pc[0] : pc;
  return {
    ...rest,
    retail_price: Number(rest.retail_price),
    wholesale_price: rest.wholesale_price == null ? null : Number(rest.wholesale_price),
    wholesale_min_qty: rest.wholesale_min_qty == null ? null : Number(rest.wholesale_min_qty),
    stock: Number(rest.stock),
    min_stock: Number(rest.min_stock),
    cost: costRow ? Number(costRow.cost) : null,
  };
}

/** Todos los productos del negocio (paginado: la API devuelve máx. 1000 filas por pedido). */
export async function fetchProducts(orgId: string): Promise<Product[]> {
  const all: Product[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('products')
      .select('*, product_costs(cost)')
      .eq('organization_id', orgId)
      .order('name')
      .order('id')
      .range(from, from + PAGE - 1);
    if (error) throw error;
    all.push(...(data as ProductRow[]).map(toProduct));
    if (data.length < PAGE) break;
  }
  return all;
}

export function useProducts() {
  const { orgId } = useShop();
  return useQuery({ queryKey: ['products', orgId], queryFn: () => fetchProducts(orgId) });
}

export function useCategories() {
  const { orgId } = useShop();
  return useQuery({
    queryKey: ['categories', orgId],
    queryFn: async (): Promise<Category[]> => {
      const { data, error } = await supabase
        .from('categories')
        .select('id, name')
        .eq('organization_id', orgId)
        .order('name');
      if (error) throw error;
      return data;
    },
  });
}

export function useMovements(productId: string | undefined) {
  const { orgId } = useShop();
  return useQuery({
    queryKey: ['movements', orgId, productId],
    enabled: Boolean(productId),
    queryFn: async (): Promise<StockMovement[]> => {
      const { data, error } = await supabase
        .from('stock_movements')
        .select('id, type, qty, stock_after, reason, created_at')
        .eq('organization_id', orgId)
        .eq('product_id', productId!)
        .order('created_at', { ascending: false })
        .limit(30);
      if (error) throw error;
      return data.map((m) => ({ ...m, qty: Number(m.qty), stock_after: Number(m.stock_after) })) as StockMovement[];
    },
  });
}

export function useInvalidateProducts() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['products'] }),
      queryClient.invalidateQueries({ queryKey: ['categories'] }),
      queryClient.invalidateQueries({ queryKey: ['movements'] }),
    ]);
}

export interface ProductInput {
  name: string;
  variant_label?: string | null;
  parent_id?: string | null;
  sku: string | null;
  barcode: string | null;
  category_id: string | null;
  unit: Unit;
  retail_price: number;
  wholesale_price: number | null;
  wholesale_min_qty: number | null;
  min_stock: number;
  active: boolean;
  source: ProductSource;
  cost: number | null;
}

async function saveCost(orgId: string, productId: string, cost: number | null) {
  if (cost == null) {
    const { error } = await supabase.from('product_costs').delete().eq('product_id', productId);
    if (error) throw error;
    return;
  }
  const { error } = await supabase
    .from('product_costs')
    .upsert({ product_id: productId, organization_id: orgId, cost }, { onConflict: 'product_id' });
  if (error) throw error;
}

/** Crea el producto y, si se indicó, registra su stock inicial como movimiento. */
export async function createProduct(orgId: string, input: ProductInput, initialStock: number): Promise<string> {
  const id = uuid();
  const { cost, ...fields } = input;
  const { error } = await supabase.from('products').insert({ id, organization_id: orgId, ...fields });
  if (error) throw error;
  if (cost != null) await saveCost(orgId, id, cost);
  if (initialStock > 0) await adjustStock(id, 'initial', initialStock, null);
  return id;
}

export async function updateProduct(orgId: string, id: string, input: ProductInput): Promise<void> {
  const { cost, parent_id: _parent, ...fields } = input;
  const { error } = await supabase.from('products').update(fields).eq('id', id);
  if (error) throw error;
  await saveCost(orgId, id, cost);
}

/** Las variantes comparten nombre, categoría, unidad y origen con su producto principal. */
export async function syncVariants(
  parentId: string,
  fields: Pick<ProductInput, 'name' | 'category_id' | 'unit' | 'source'>,
): Promise<void> {
  const { error } = await supabase.from('products').update(fields).eq('parent_id', parentId);
  if (error) throw error;
}

export async function setProductActive(id: string, active: boolean): Promise<void> {
  const { error } = await supabase.from('products').update({ active }).eq('id', id);
  if (error) throw error;
}

/** qty: variación (+ entra, − sale). El id lo genera el cliente para que reintentar no duplique. */
export async function adjustStock(
  productId: string,
  type: Extract<StockMovementType, 'initial' | 'purchase' | 'adjustment'>,
  qty: number,
  reason: string | null,
): Promise<number> {
  const { data, error } = await supabase.rpc('adjust_stock', {
    p_product_id: productId,
    p_type: type,
    p_qty: qty,
    p_reason: reason,
    p_movement_id: uuid(),
  });
  if (error) throw error;
  return Number(data);
}

/** Devuelve el id de la categoría con ese nombre; la crea si no existe. */
export async function ensureCategory(orgId: string, name: string, existing: Category[]): Promise<string> {
  const clean = name.trim().replace(/\s+/g, ' ');
  const found = existing.find((c) => normalizeText(c.name) === normalizeText(clean));
  if (found) return found.id;
  const { data, error } = await supabase
    .from('categories')
    .insert({ organization_id: orgId, name: clean })
    .select('id')
    .single();
  if (error) throw error;
  return data.id as string;
}
