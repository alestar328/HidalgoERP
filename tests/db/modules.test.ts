import { beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { BUSINESS_TYPE_IDS } from '../../src/modules/catalog';
import { asUser, createProduct, createShop, createTestDb, createUser, one } from './helpers';

let db: PGlite;
let a: Awaited<ReturnType<typeof createShop>>;
let b: Awaited<ReturnType<typeof createShop>>;

beforeAll(async () => {
  db = await createTestDb();
  a = await createShop(db, 'mod-a');
  b = await createShop(db, 'mod-b');
}, 60_000);

const modulesOf = (orgId: string) =>
  db
    .query<{ module_id: string; enabled: boolean }>(
      'select module_id, enabled from public.organization_modules where organization_id = $1 order by module_id',
      [orgId],
    )
    .then((r) => r.rows);

describe('rubro del negocio', () => {
  it('el enum de la base coincide con el catálogo del código', async () => {
    const res = await db.query<{ v: string }>(
      `select unnest(enum_range(null::public.business_type))::text as v`,
    );
    expect(res.rows.map((r) => r.v)).toEqual([...BUSINESS_TYPE_IDS]);
  });

  it('sin rubro queda "general"; con rubro se guarda al crear el negocio', async () => {
    const t = await one<{ business_type: string }>(db, 'select business_type from public.organizations where id = $1', [a.orgId]);
    expect(t.business_type).toBe('general');

    const owner = await createUser(db, 'dueno-ropa');
    const orgId = await asUser(db, owner, async (tx) =>
      (await one<{ id: string }>(tx, `select public.create_organization('Taller', null, null, 'ropa') as id`)).id,
    );
    const r = await one<{ business_type: string }>(db, 'select business_type from public.organizations where id = $1', [orgId]);
    expect(r.business_type).toBe('ropa');
  });

  it('el dueño cambia el rubro y se borran sus decisiones de módulos', async () => {
    await asUser(db, a.owner, (tx) => tx.query(`select public.set_modules($1, array['fiados'], false)`, [a.orgId]));
    expect(await modulesOf(a.orgId)).toHaveLength(1);
    await asUser(db, a.owner, (tx) => tx.query(`select public.set_business_type($1, 'bodega')`, [a.orgId]));
    const t = await one<{ business_type: string }>(db, 'select business_type from public.organizations where id = $1', [a.orgId]);
    expect(t.business_type).toBe('bodega');
    expect(await modulesOf(a.orgId)).toHaveLength(0);
  });

  it('un vendedor no puede cambiar el rubro', async () => {
    await expect(
      asUser(db, a.seller, (tx) => tx.query(`select public.set_business_type($1, 'ropa')`, [a.orgId])),
    ).rejects.toThrow(/Solo el dueño/);
  });
});

describe('módulos por negocio', () => {
  it('el dueño enciende y apaga varios módulos de una vez, y repetir no duplica', async () => {
    await asUser(db, a.owner, (tx) =>
      tx.query(`select public.set_modules($1, array['compras', 'produccion'], true)`, [a.orgId]),
    );
    await asUser(db, a.owner, (tx) => tx.query(`select public.set_modules($1, array['produccion'], false)`, [a.orgId]));
    expect(await modulesOf(a.orgId)).toEqual([
      { module_id: 'compras', enabled: true },
      { module_id: 'produccion', enabled: false },
    ]);
  });

  it('el vendedor ve los módulos de su negocio pero no puede cambiarlos', async () => {
    const seen = await asUser(db, a.seller, (tx) => tx.query('select module_id from public.organization_modules'));
    expect(seen.rows).toHaveLength(2);
    await expect(
      asUser(db, a.seller, (tx) => tx.query(`select public.set_modules($1, array['fiados'], true)`, [a.orgId])),
    ).rejects.toThrow(/Solo el dueño/);
  });

  it('no se escribe directo en la tabla, solo por la función', async () => {
    await expect(
      asUser(db, a.owner, (tx) =>
        tx.query(`insert into public.organization_modules (organization_id, module_id, enabled) values ($1, 'peso', true)`, [
          a.orgId,
        ]),
      ),
    ).rejects.toThrow(/permission denied/);
  });

  it('un negocio no ve ni cambia los módulos de otro', async () => {
    const seen = await asUser(db, b.owner, (tx) =>
      tx.query('select module_id from public.organization_modules where organization_id = $1', [a.orgId]),
    );
    expect(seen.rows).toHaveLength(0);
    await expect(
      asUser(db, b.owner, (tx) => tx.query(`select public.set_modules($1, array['fiados'], false)`, [a.orgId])),
    ).rejects.toThrow(/Solo el dueño/);
  });

  it('rechaza nombres de módulo con formato inválido', async () => {
    await expect(
      asUser(db, a.owner, (tx) => tx.query(`select public.set_modules($1, array['Malo; drop'], true)`, [a.orgId])),
    ).rejects.toThrow(/check constraint/);
  });
});

describe('origen del producto', () => {
  it('por defecto se compra; el dueño puede marcarlo como producción propia', async () => {
    const id = await createProduct(db, a, { name: 'Polo deportivo' });
    const before = await one<{ source: string }>(db, 'select source from public.products where id = $1', [id]);
    expect(before.source).toBe('purchase');
    await asUser(db, a.owner, (tx) => tx.query(`update public.products set source = 'production' where id = $1`, [id]));
    const after = await one<{ source: string }>(db, 'select source from public.products where id = $1', [id]);
    expect(after.source).toBe('production');
  });
});
