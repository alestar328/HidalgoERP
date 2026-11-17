import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite, type Transaction } from '@electric-sql/pglite';
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm';

/**
 * Postgres embebido (PGlite) con lo mínimo de Supabase que usan las migraciones:
 * roles anon/authenticated, esquema auth con auth.uid() y auth.jwt().
 * Así se prueban RLS y RPC sin Docker ni proyecto en la nube.
 */
const SUPABASE_STUB = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  create schema auth;
  create schema extensions;
  create table auth.users (id uuid primary key, email text);
  create function auth.jwt() returns jsonb language sql stable as $$
    select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
  $$;
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(auth.jwt() ->> 'sub', '')::uuid
  $$;
  grant usage on schema public, auth, extensions to anon, authenticated, service_role;
  grant execute on all functions in schema auth to anon, authenticated, service_role;
`;

const MIGRATIONS_DIR = join(process.cwd(), 'supabase', 'migrations');

export interface TestUser {
  id: string;
  email: string;
}

export async function createTestDb(): Promise<PGlite> {
  const db = new PGlite({ extensions: { pg_trgm } });
  await db.exec(SUPABASE_STUB);
  for (const file of readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort()) {
    try {
      await db.exec(readFileSync(join(MIGRATIONS_DIR, file), 'utf8'));
    } catch (e) {
      throw new Error(`Migración ${file} falló: ${(e as Error).message}`);
    }
  }
  return db;
}

let userSeq = 0;
export async function createUser(db: PGlite, name: string): Promise<TestUser> {
  userSeq += 1;
  const id = `00000000-0000-4000-8000-${String(userSeq).padStart(12, '0')}`;
  const email = `${name}@example.com`;
  await db.query('insert into auth.users (id, email) values ($1, $2)', [id, email]);
  return { id, email };
}

/** Ejecuta fn como ese usuario (rol authenticated + JWT), igual que una llamada desde la app. */
export function asUser<T>(db: PGlite, user: TestUser, fn: (tx: Transaction) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.query(`select set_config('request.jwt.claims', $1, true)`, [
      JSON.stringify({ sub: user.id, email: user.email, role: 'authenticated' }),
    ]);
    await tx.exec('set local role authenticated');
    return fn(tx);
  }) as Promise<T>;
}

export async function one<T = Record<string, unknown>>(
  tx: Transaction | PGlite,
  sql: string,
  params: unknown[] = [],
): Promise<T> {
  const res = await tx.query<T>(sql, params);
  return res.rows[0] as T;
}

/** Negocio con dueño y vendedor listos para probar. */
export async function createShop(db: PGlite, label: string) {
  const owner = await createUser(db, `dueno-${label}`);
  const seller = await createUser(db, `vendedor-${label}`);
  const orgId = await asUser(db, owner, async (tx) => {
    const row = await one<{ id: string }>(tx, 'select public.create_organization($1) as id', [`Negocio ${label}`]);
    await tx.query('insert into public.invitations (organization_id, email) values ($1, $2)', [row.id, seller.email]);
    return row.id;
  });
  await asUser(db, seller, (tx) => tx.query('select public.accept_invitations()'));
  return { owner, seller, orgId };
}

export async function createProduct(
  db: PGlite,
  shop: { owner: TestUser; orgId: string },
  fields: { name: string; retail_price?: number; parent_id?: string | null; sku?: string | null },
): Promise<string> {
  return asUser(db, shop.owner, async (tx) => {
    const row = await one<{ id: string }>(
      tx,
      `insert into public.products (organization_id, name, retail_price, parent_id, sku)
       values ($1, $2, $3, $4, $5) returning id`,
      [shop.orgId, fields.name, fields.retail_price ?? 10, fields.parent_id ?? null, fields.sku ?? null],
    );
    return row.id;
  });
}
