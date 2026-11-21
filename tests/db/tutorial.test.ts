import { beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { GUIDES } from '../../src/tutorial/guides';
import { asUser, createShop, createTestDb, createUser, one } from './helpers';

let db: PGlite;
let a: Awaited<ReturnType<typeof createShop>>;
let b: Awaited<ReturnType<typeof createShop>>;

beforeAll(async () => {
  db = await createTestDb();
  a = await createShop(db, 'tut-a');
  b = await createShop(db, 'tut-b');
}, 60_000);

const welcomeOf = (orgId: string, userId: string) =>
  one<{ tutorial_welcome_at: string | null }>(
    db,
    'select tutorial_welcome_at from public.memberships where organization_id = $1 and user_id = $2',
    [orgId, userId],
  ).then((r) => r.tutorial_welcome_at);

describe('historial de tutoriales', () => {
  it('los ids de las guías del código cumplen el formato de la base', () => {
    for (const g of GUIDES) expect(g.id).toMatch(/^[a-z][a-z0-9-]{1,39}$/);
  });

  it('el vendedor termina una guía: queda con fecha y marca la bienvenida', async () => {
    expect(await welcomeOf(a.orgId, a.seller.id)).toBeNull();
    await asUser(db, a.seller, (tx) => tx.query(`select public.complete_guide($1, 'productos-buscar')`, [a.orgId]));
    const row = await asUser(db, a.seller, (tx) =>
      one<{ times_completed: number; first_completed_at: string }>(
        tx,
        `select times_completed, first_completed_at from public.tutorial_progress where guide_id = 'productos-buscar'`,
      ),
    );
    expect(row.times_completed).toBe(1);
    expect(row.first_completed_at).toBeTruthy();
    expect(await welcomeOf(a.orgId, a.seller.id)).not.toBeNull();
  });

  it('repetir una guía suma una vez más; sincronizar no cuenta repeticiones', async () => {
    await asUser(db, a.seller, (tx) => tx.query(`select public.complete_guide($1, 'productos-buscar')`, [a.orgId]));
    await asUser(db, a.seller, (tx) =>
      tx.query(`select public.sync_tutorial_progress($1, array['productos-buscar', 'reposicion'], true)`, [a.orgId]),
    );
    const rows = await asUser(db, a.seller, (tx) =>
      tx.query<{ guide_id: string; times_completed: number }>(
        'select guide_id, times_completed from public.tutorial_progress order by guide_id',
      ),
    );
    expect(rows.rows).toEqual([
      { guide_id: 'productos-buscar', times_completed: 2 },
      { guide_id: 'reposicion', times_completed: 1 },
    ]);
  });

  it('el dueño ve el historial de su vendedor; nadie ve el de otro negocio', async () => {
    const own = await asUser(db, a.owner, (tx) =>
      tx.query('select 1 from public.tutorial_progress where user_id = $1', [a.seller.id]),
    );
    expect(own.rows.length).toBe(2);
    const other = await asUser(db, b.owner, (tx) => tx.query('select 1 from public.tutorial_progress'));
    expect(other.rows.length).toBe(0);
  });

  it('un vendedor no ve el historial de otro vendedor', async () => {
    const peer = await createUser(db, 'vendedor-tut-a2');
    await asUser(db, a.owner, (tx) =>
      tx.query('insert into public.invitations (organization_id, email) values ($1, $2)', [a.orgId, peer.email]),
    );
    await asUser(db, peer, (tx) => tx.query('select public.accept_invitations()'));
    const res = await asUser(db, peer, (tx) => tx.query('select 1 from public.tutorial_progress'));
    expect(res.rows.length).toBe(0);
  });

  it('no se puede escribir directo ni en un negocio ajeno', async () => {
    await expect(
      asUser(db, a.seller, (tx) =>
        tx.query(`insert into public.tutorial_progress (organization_id, user_id, guide_id) values ($1, $2, 'x-y')`, [
          a.orgId,
          a.seller.id,
        ]),
      ),
    ).rejects.toThrow();
    await expect(
      asUser(db, a.seller, (tx) => tx.query(`select public.complete_guide($1, 'reposicion')`, [b.orgId])),
    ).rejects.toThrow(/No perteneces/);
  });

  it('rechaza ids de guía raros', async () => {
    await expect(
      asUser(db, a.seller, (tx) => tx.query(`select public.complete_guide($1, 'DROP TABLE')`, [a.orgId])),
    ).rejects.toThrow();
  });

  it('volver a ofrecer la bienvenida no borra el historial', async () => {
    await asUser(db, a.seller, (tx) => tx.query('select public.set_tutorial_welcome($1, false)', [a.orgId]));
    expect(await welcomeOf(a.orgId, a.seller.id)).toBeNull();
    const res = await asUser(db, a.seller, (tx) => tx.query('select 1 from public.tutorial_progress'));
    expect(res.rows.length).toBe(2);
    await asUser(db, a.seller, (tx) => tx.query('select public.set_tutorial_welcome($1, true)', [a.orgId]));
    expect(await welcomeOf(a.orgId, a.seller.id)).not.toBeNull();
  });
});
