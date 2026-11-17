export interface PricedProduct {
  retail_price: number;
  wholesale_price: number | null;
  wholesale_min_qty: number | null;
}

export type PriceTier = 'retail' | 'wholesale';

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** El precio por mayor se aplica solo, apenas la cantidad llega al mínimo. */
export function priceFor(product: PricedProduct, qty: number): { unitPrice: number; tier: PriceTier } {
  const { wholesale_price: wp, wholesale_min_qty: min } = product;
  if (wp != null && min != null && min > 0 && qty >= min) {
    return { unitPrice: wp, tier: 'wholesale' };
  }
  return { unitPrice: product.retail_price, tier: 'retail' };
}

export function lineTotal(product: PricedProduct, qty: number): number {
  return round2(priceFor(product, qty).unitPrice * qty);
}
