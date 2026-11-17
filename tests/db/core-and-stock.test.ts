import { beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { asUser, createProduct, createShop, createTestDb, createUser, one } from './helpers';

let db: PGlite;
let a: Awaited<ReturnType<typeof createShop>>;
let b: Awaited<ReturnType<typeof createShop>>;

beforeAll(async () => {
  db = await createTestDb();
  a = await createShop(db, 'a');
  b = await createShop(db, 'b');
}, 60_000);

const stockOf = async (id: string) =>
  Number((await one<{ stock: string }>(db, 'select stock from public.products where id = $1', [id])).stock);

describe('negocios y roles', () => {
  it('crear negocio deja al usuario como dueño y es idempotente', async () => {
    const again = await asUser(db, a.owner, (tx) =>
      one<{ id: string }>(tx, 'select public.create_organization($1) as id', ['Otro nombre']),
    );
    expect(again.id).toBe(a.orgId);
    const m = await one<{ role: string }>(db, 'select role from public.memberships where user_id = $1', [a.owner.id]);
    expect(m.role).toBe('owner');
  });

  it('la invitación aceptada crea un vendedor', async () => {
    const m = await one<{ role: string; organization_id: string }>(
      db,
      'select role, organization_id from public.memberships where user_id = $1',
      [a.seller.id],
    );
    expect(m).toEqual({ role: 'seller', organization_id: a.orgId });
  });

  it('sin invitación no se obtiene acceso', async () => {
    const stranger = await createUser(db, 'extrano');
    const n = await asUser(db, stranger, (tx) => one<{ n: number }>(tx, 'select public.accept_invitations() as n'));
    expect(n.n).toBe(0);
    const orgs = await asUser(db, stranger, (tx) => tx.query('select id from public.organizations'));
    expect(orgs.rows).toHaveLength(0);
  });

  it('un vendedor no puede invitar ni ver invitaciones', async () => {
    await expect(
      asUser(db, a.seller, (tx) =>
        tx.query('insert into public.invitations (organization_id, email) values ($1, $2)', [a.orgId, 'x@example.com']),
      ),
    ).rejects.toThrow(/row-level security/);
    const inv = await asUser(db, a.seller, (tx) => tx.query('select id from public.invitations'));
    expect(inv.rows).toHaveLength(0);
  });
});

describe('aislamiento entre negocios', () => {
  it('un negocio no ve ni toca los productos de otro', async () => {
    const pid = await createProduct(db, a, { name: 'Cuaderno A' });
    await asUser(db, a.owner, (tx) => tx.query(`select public.adjust_stock($1, 'initial', 5)`, [pid]));

    const seen = await asUser(db, b.owner, (tx) => tx.query('select id from public.products where id = $1', [pid]));
    expect(seen.rows).toHaveLength(0);

    const upd = await asUser(db, b.owner, (tx) =>
      tx.query(`update public.products set name = 'hackeado' where id = $1`, [pid]),
    );
    expect(upd.affectedRows).toBe(0);

    await expect(
      asUser(db, b.owner, (tx) =>
        tx.query(`insert into public.products (organization_id, name) values ($1, 'intruso')`, [a.orgId]),
      ),
    ).rejects.toThrow(/row-level security/);

    await expect(
      asUser(db, b.owner, (tx) => tx.query(`select public.adjust_stock($1, 'purchase', 1)`, [pid])),
    ).rejects.toThrow(/Producto no encontrado/);

    const mov = await asUser(db, b.owner, (tx) => tx.query('select id from public.stock_movements'));
    expect(mov.rows).toHaveLength(0);
    expect(await stockOf(pid)).toBe(5);
  });

  it('no se puede colgar una variante de un producto de otro negocio', async () => {
    const parentA = await createProduct(db, a, { name: 'Camisa A' });
    await expect(createProduct(db, b, { name: 'Camisa B talla 8', parent_id: parentA })).rejects.toThrow();
  });
});

describe('stock', () => {
  it('el stock solo cambia por movimientos: el cliente no puede escribirlo', async () => {
    const pid = await createProduct(db, a, { name: 'Lapicero' });
    await expect(
      asUser(db, a.owner, (tx) => tx.query('update public.products set stock = 999 where id = $1', [pid])),
    ).rejects.toThrow(/permission denied/);
    await expect(
      asUser(db, a.owner, (tx) =>
        tx.query(`insert into public.products (organization_id, name, stock) values ($1, 'x', 50)`, [a.orgId]),
      ),
    ).rejects.toThrow(/permission denied/);
    await expect(
      asUser(db, a.owner, (tx) =>
        tx.query(
          `insert into public.stock_movements (organization_id, product_id, type, qty, stock_after)
           values ($1, $2, 'purchase', 10, 10)`,
          [a.orgId, pid],
        ),
      ),
    ).rejects.toThrow(/permission denied/);
    expect(await stockOf(pid)).toBe(0);
  });

  it('entradas y ajustes suman y restan, y guardan el saldo resultante', async () => {
    const pid = await createProduct(db, a, { name: 'Regla 30 cm' });
    const run = (type: string, qty: number, reason: string | null = null) =>
      asUser(db, a.owner, (tx) =>
        one<{ s: string }>(tx, 'select public.adjust_stock($1, $2::public.stock_movement_type, $3, $4) as s', [
          pid,
          type,
          qty,
          reason,
        ]),
      ).then((r) => Number(r.s));

    expect(await run('initial', 24)).toBe(24);
    expect(await run('purchase', 12)).toBe(36);
    expect(await run('adjustment', -3, 'Se rompieron')).toBe(33);
    expect(await stockOf(pid)).toBe(33);

    const movs = await db.query<{ type: string; qty: string; stock_after: string }>(
      'select type, qty, stock_after from public.stock_movements where product_id = $1 order by created_at, stock_after',
      [pid],
    );
    expect(movs.rows.map((m) => [m.type, Number(m.qty), Number(m.stock_after)])).toEqual(
      expect.arrayContaining([
        ['initial', 24, 24],
        ['purchase', 12, 36],
        ['adjustment', -3, 33],
      ]),
    );
  });

  it('reintentar el mismo movimiento no lo duplica', async () => {
    const pid = await createProduct(db, a, { name: 'Tijera' });
    const movementId = '11111111-1111-4111-8111-111111111111';
    for (let i = 0; i < 3; i += 1) {
      await asUser(db, a.owner, (tx) =>
        tx.query(`select public.adjust_stock($1, 'purchase', 10, null, $2)`, [pid, movementId]),
      );
    }
    expect(await stockOf(pid)).toBe(10);
  });

  it('valida cantidad, motivo y tipo', async () => {
    const pid = await createProduct(db, a, { name: 'Goma' });
    const call = (sql: string) => asUser(db, a.owner, (tx) => tx.query(sql, [pid]));
    await expect(call(`select public.adjust_stock($1, 'purchase', 0)`)).rejects.toThrow(/no puede ser cero/);
    await expect(call(`select public.adjust_stock($1, 'purchase', -2)`)).rejects.toThrow(/mayor que cero/);
    await expect(call(`select public.adjust_stock($1, 'adjustment', -2)`)).rejects.toThrow(/motivo/);
    await expect(call(`select public.adjust_stock($1, 'sale', -2)`)).rejects.toThrow(/no permitido/);
  });

  it('un producto con variantes no lleva stock propio', async () => {
    const parent = await createProduct(db, a, { name: 'Camisa blanca' });
    const child = await createProduct(db, a, { name: 'Camisa blanca', parent_id: parent });
    await expect(
      asUser(db, a.owner, (tx) => tx.query(`select public.adjust_stock($1, 'initial', 5)`, [parent])),
    ).rejects.toThrow(/tiene variantes/);
    await asUser(db, a.owner, (tx) => tx.query(`select public.adjust_stock($1, 'initial', 5)`, [child]));
    expect(await stockOf(child)).toBe(5);

    await expect(createProduct(db, a, { name: 'Nieta', parent_id: child })).rejects.toThrow(/sus propias variantes/);
  });

  it('no se agregan variantes a un producto que ya tiene stock', async () => {
    const pid = await createProduct(db, a, { name: 'Chompa azul' });
    await asUser(db, a.owner, (tx) => tx.query(`select public.adjust_stock($1, 'initial', 4)`, [pid]));
    await expect(createProduct(db, a, { name: 'Chompa azul', parent_id: pid })).rejects.toThrow(/Deja en 0/);
  });

  it('el código (SKU) no se repite dentro del negocio, pero sí entre negocios', async () => {
    await createProduct(db, a, { name: 'Mochila', sku: 'MOC-01' });
    await expect(createProduct(db, a, { name: 'Otra mochila', sku: 'moc-01' })).rejects.toThrow(/duplicate key/);
    await expect(createProduct(db, b, { name: 'Mochila', sku: 'MOC-01' })).resolves.toBeTruthy();
  });
});

describe('vendedor', () => {
  it('consulta productos y stock, pero no ve costos', async () => {
    const pid = await createProduct(db, a, { name: 'Plumones x12' });
    await asUser(db, a.owner, (tx) =>
      tx.query('insert into public.product_costs (product_id, organization_id, cost) values ($1, $2, 6.5)', [
        pid,
        a.orgId,
      ]),
    );
    const products = await asUser(db, a.seller, (tx) =>
      tx.query('select id from public.products where id = $1', [pid]),
    );
    expect(products.rows).toHaveLength(1);
    const costs = await asUser(db, a.seller, (tx) => tx.query('select cost from public.product_costs'));
    expect(costs.rows).toHaveLength(0);
    const ownerCosts = await asUser(db, a.owner, (tx) =>
      tx.query('select cost from public.product_costs where product_id = $1', [pid]),
    );
    expect(ownerCosts.rows).toHaveLength(1);
  });

  it('no crea ni edita productos, ni cambia el stock', async () => {
    const pid = await createProduct(db, a, { name: 'Folder' });
    await expect(
      asUser(db, a.seller, (tx) =>
        tx.query(`insert into public.products (organization_id, name) values ($1, 'x')`, [a.orgId]),
      ),
    ).rejects.toThrow(/row-level security/);
    const upd = await asUser(db, a.seller, (tx) =>
      tx.query('update public.products set retail_price = 0.1 where id = $1', [pid]),
    );
    expect(upd.affectedRows).toBe(0);
    await expect(
      asUser(db, a.seller, (tx) => tx.query(`select public.adjust_stock($1, 'purchase', 5)`, [pid])),
    ).rejects.toThrow(/Solo el dueño/);
  });
});

describe('sin sesión', () => {
  it('anon no puede leer ni llamar funciones', async () => {
    const asAnon = (sql: string) =>
      db.transaction(async (tx) => {
        await tx.exec('set local role anon');
        return tx.query(sql);
      });
    await expect(asAnon('select * from public.products')).rejects.toThrow(/permission denied/);
    await expect(asAnon(`select public.create_organization('x')`)).rejects.toThrow(/permission denied/);
  });
});
