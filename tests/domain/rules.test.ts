import { describe, expect, it } from 'vitest';
import { lineTotal, priceFor, round2 } from '../../src/domain/pricing';
import { countAlerts, groupProducts, stockStatus } from '../../src/domain/stock';
import { formatMoney, formatQty, parseNumber } from '../../src/lib/format';
import { matchesSearch, normalizeText } from '../../src/lib/normalize';

describe('precio por mayor', () => {
  const cuaderno = { retail_price: 6.5, wholesale_price: 5.8, wholesale_min_qty: 12 };

  it('usa precio por menor por debajo del mínimo', () => {
    expect(priceFor(cuaderno, 11)).toEqual({ unitPrice: 6.5, tier: 'retail' });
  });
  it('cambia a precio por mayor justo al llegar al mínimo', () => {
    expect(priceFor(cuaderno, 12)).toEqual({ unitPrice: 5.8, tier: 'wholesale' });
    expect(priceFor(cuaderno, 40).tier).toBe('wholesale');
  });
  it('sin precio por mayor siempre es por menor', () => {
    expect(priceFor({ retail_price: 3, wholesale_price: null, wholesale_min_qty: null }, 500).tier).toBe('retail');
  });
  it('calcula el total de la línea redondeado a céntimos', () => {
    expect(lineTotal(cuaderno, 12)).toBe(69.6);
    expect(lineTotal(cuaderno, 3)).toBe(19.5);
    expect(lineTotal({ retail_price: 0.1, wholesale_price: null, wholesale_min_qty: null }, 3)).toBe(0.3);
    expect(round2(1.005)).toBe(1.01);
  });
  it('funciona con cantidades decimales (kg)', () => {
    const arroz = { retail_price: 4.2, wholesale_price: 3.9, wholesale_min_qty: 5 };
    expect(lineTotal(arroz, 0.75)).toBe(3.15);
    expect(lineTotal(arroz, 5.5)).toBe(21.45);
  });
});

describe('estado del stock', () => {
  it('agotado, bajo y normal', () => {
    expect(stockStatus(0, 5)).toBe('out');
    expect(stockStatus(-2, 5)).toBe('out');
    expect(stockStatus(5, 5)).toBe('low');
    expect(stockStatus(6, 5)).toBe('ok');
    expect(stockStatus(1, 0)).toBe('ok');
  });

  const base = { min_stock: 2, active: true };
  const products = [
    { id: 'camisa', parent_id: null, stock: 0, ...base },
    { id: 'camisa-8', parent_id: 'camisa', stock: 6, ...base },
    { id: 'camisa-10', parent_id: 'camisa', stock: 0, ...base },
    { id: 'camisa-12', parent_id: 'camisa', stock: 2, ...base },
    { id: 'regla', parent_id: null, stock: 30, ...base },
  ];

  it('un producto con variantes suma su stock y muestra el peor estado', () => {
    const groups = groupProducts(products);
    expect(groups).toHaveLength(2);
    const camisa = groups.find((g) => g.product.id === 'camisa')!;
    expect(camisa.variants).toHaveLength(3);
    expect(camisa.totalStock).toBe(8);
    expect(camisa.status).toBe('out');
    expect(groups.find((g) => g.product.id === 'regla')!.status).toBe('ok');
  });

  it('las alertas cuentan cada variante y no el producto principal', () => {
    expect(countAlerts(products)).toEqual({ low: 1, out: 1 });
  });
});

describe('formato y búsqueda', () => {
  it('soles con coma de miles y dos decimales', () => {
    expect(formatMoney(1234.5)).toBe('S/ 1,234.50');
    expect(formatMoney(0)).toBe('S/ 0.00');
    expect(formatMoney(-15)).toBe('−S/ 15.00');
  });
  it('cantidades sin ceros de más', () => {
    expect(formatQty(12)).toBe('12');
    expect(formatQty(0.25)).toBe('0.25');
  });
  it('lee números con coma o punto', () => {
    expect(parseNumber('12,50')).toBe(12.5);
    expect(parseNumber(' 7.5 ')).toBe(7.5);
    expect(parseNumber('')).toBeNull();
    expect(parseNumber('abc')).toBeNull();
  });
  it('busca sin importar tildes, mayúsculas ni orden', () => {
    expect(normalizeText('  Lápiz   MONGOL ')).toBe('lapiz mongol');
    expect(matchesSearch('Lápiz Mongol 2B', 'mongol lapiz')).toBe(true);
    expect(matchesSearch('Lápiz Mongol 2B', 'lapicero')).toBe(false);
  });
});
