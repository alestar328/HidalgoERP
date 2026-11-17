import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { createShop, createTestDb, one } from './helpers';

it('el seed carga el puesto de uniformes y útiles, y se puede repetir sin duplicar', async () => {
  const db = await createTestDb();
  const shop = await createShop(db, 'seed');
  const seed = readFileSync(join(process.cwd(), 'supabase', 'seed.sql'), 'utf8');

  await db.exec(seed);
  await db.exec(seed);

  const counts = await one<{ principales: number; variantes: number; costos: number; categorias: number }>(
    db,
    `select
       (select count(*)::int from public.products where organization_id = $1 and parent_id is null) as principales,
       (select count(*)::int from public.products where organization_id = $1 and parent_id is not null) as variantes,
       (select count(*)::int from public.product_costs where organization_id = $1) as costos,
       (select count(*)::int from public.categories where organization_id = $1) as categorias`,
    [shop.orgId],
  );
  expect(counts).toEqual({ principales: 29, variantes: 25, costos: 54, categorias: 6 });

  // El stock de cada producto es exactamente la suma de sus movimientos.
  const mismatch = await one<{ n: number }>(
    db,
    `select count(*)::int as n from public.products p
     where p.organization_id = $1
       and p.stock <> coalesce((select sum(m.qty) from public.stock_movements m where m.product_id = p.id), 0)`,
    [shop.orgId],
  );
  expect(mismatch.n).toBe(0);

  // Hay ejemplos de agotado y de stock bajo para ver las alertas, y los principales con tallas quedan en 0.
  const alerts = await one<{ agotados: number; bajos: number; padres_con_stock: number }>(
    db,
    `select
       count(*) filter (where stock <= 0 and not exists (select 1 from public.products c where c.parent_id = p.id))::int as agotados,
       count(*) filter (where stock > 0 and min_stock > 0 and stock <= min_stock)::int as bajos,
       count(*) filter (where stock <> 0 and exists (select 1 from public.products c where c.parent_id = p.id))::int as padres_con_stock
     from public.products p where organization_id = $1`,
    [shop.orgId],
  );
  expect(alerts.agotados).toBeGreaterThan(0);
  expect(alerts.bajos).toBeGreaterThan(0);
  expect(alerts.padres_con_stock).toBe(0);
}, 60_000);
