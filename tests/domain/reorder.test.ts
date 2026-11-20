import { describe, expect, it } from 'vitest';
import {
  reorderList,
  reorderMessage,
  splitBySource,
  suggestedQty,
  whatsappShareUrl,
  type ReorderCandidate,
} from '../../src/domain/reorder';

const p = (over: Partial<ReorderCandidate> & { id: string }): ReorderCandidate => ({
  parent_id: null,
  name: over.id,
  variant_label: null,
  stock: 10,
  min_stock: 5,
  active: true,
  source: 'purchase',
  ...over,
});

describe('cantidad sugerida', () => {
  it('pide lo que falta para llegar al doble del mínimo', () => {
    expect(suggestedQty(6, 8)).toBe(10);
    expect(suggestedQty(0, 6)).toBe(12);
  });
  it('si el stock es negativo, también lo cubre', () => {
    expect(suggestedQty(-2, 5)).toBe(12);
  });
  it('redondea hacia arriba (kg) y nunca sugiere menos de 1', () => {
    expect(suggestedQty(1.5, 2)).toBe(3);
    expect(suggestedQty(9.5, 5)).toBe(1);
  });
  it('sin mínimo no hay sugerencia', () => {
    expect(suggestedQty(0, 0)).toBeNull();
  });
});

describe('lista de reposición', () => {
  const products = [
    p({ id: 'ok', stock: 20, min_stock: 5 }),
    p({ id: 'bajo', stock: 4, min_stock: 6 }),
    p({ id: 'justo', stock: 5, min_stock: 5 }),
    p({ id: 'agotado', stock: 0, min_stock: 4, source: 'production' }),
    p({ id: 'archivado', stock: 0, min_stock: 4, active: false }),
    p({ id: 'buzo', stock: 0, min_stock: 0 }),
    p({ id: 'buzo-12', parent_id: 'buzo', name: 'Buzo', variant_label: 'Talla 12', stock: 2, min_stock: 8, source: 'production' }),
  ];

  it('incluye agotados y en su mínimo; no los que están bien, archivados ni principales con variantes', () => {
    const ids = reorderList(products).map((i) => i.product.id);
    expect(ids).toEqual(['agotado', 'buzo-12', 'bajo', 'justo']);
  });

  it('nombra la variante y calcula la sugerencia', () => {
    const item = reorderList(products).find((i) => i.product.id === 'buzo-12')!;
    expect(item.label).toBe('Buzo · Talla 12');
    expect(item.suggested).toBe(14);
    expect(item.status).toBe('low');
  });

  it('separa por origen solo si producción está activa', () => {
    const items = reorderList(products);
    const withProduction = splitBySource(items, true);
    expect(withProduction.production.map((i) => i.product.id)).toEqual(['agotado', 'buzo-12']);
    expect(withProduction.purchase.map((i) => i.product.id)).toEqual(['bajo', 'justo']);
    const without = splitBySource(items, false);
    expect(without.production).toEqual([]);
    expect(without.purchase).toHaveLength(4);
  });

  it('arma el mensaje y el enlace de WhatsApp', () => {
    const text = reorderMessage(
      'Pedido de reposición',
      [
        { label: 'Polo · Talla 10', qty: 12, unit: 'und' },
        { label: 'Hilo', qty: null, unit: 'und' },
      ],
      'Uniformes Rosita',
    );
    expect(text).toBe('*Pedido de reposición* — Uniformes Rosita\n\n• Polo · Talla 10: 12 und\n• Hilo: por definir\n\nGracias.');
    expect(whatsappShareUrl('a b')).toBe('https://wa.me/?text=a%20b');
  });
});
