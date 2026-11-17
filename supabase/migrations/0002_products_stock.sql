-- 0002_products_stock: categorías, productos (con variantes), costos y movimientos de stock.
-- Regla central: products.stock SOLO cambia por el trigger de stock_movements.

create type public.product_unit as enum ('unidad', 'docena', 'caja', 'kg', 'litro');
create type public.stock_movement_type as enum ('initial', 'purchase', 'sale', 'adjustment', 'void', 'import');

-- ---------------------------------------------------------------- tablas

create table public.categories (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name            text not null check (length(trim(name)) > 0),
  created_at      timestamptz not null default now(),
  unique (id, organization_id)
);
create unique index categories_org_name_key on public.categories (organization_id, lower(name));

create table public.products (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references public.organizations (id) on delete cascade,
  parent_id         uuid,
  name              text not null check (length(trim(name)) > 0),
  variant_label     text,
  sku               text,
  barcode           text,
  category_id       uuid,
  unit              public.product_unit not null default 'unidad',
  retail_price      numeric(12,2) not null default 0 check (retail_price >= 0),
  wholesale_price   numeric(12,2) check (wholesale_price >= 0),
  wholesale_min_qty numeric(12,3) check (wholesale_min_qty > 0),
  stock             numeric(14,3) not null default 0,
  min_stock         numeric(14,3) not null default 0 check (min_stock >= 0),
  active            boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (id, organization_id),
  -- Las FK compuestas impiden apuntar a un padre o categoría de otro negocio.
  foreign key (parent_id, organization_id)
    references public.products (id, organization_id) on delete cascade,
  foreign key (category_id, organization_id)
    references public.categories (id, organization_id) on delete set null (category_id),
  check (parent_id is null or parent_id <> id),
  check ((wholesale_price is null) = (wholesale_min_qty is null))
);
create unique index products_org_sku_key on public.products (organization_id, lower(sku)) where sku is not null;
create index products_org_name_idx    on public.products (organization_id, active, name);
create index products_org_barcode_idx on public.products (organization_id, barcode) where barcode is not null;
create index products_parent_idx      on public.products (parent_id) where parent_id is not null;
create index products_category_idx    on public.products (category_id) where category_id is not null;
create index products_name_trgm_idx   on public.products using gin (name extensions.gin_trgm_ops);

create trigger products_set_updated_at before update on public.products
  for each row execute function public.set_updated_at();

-- El costo vive aparte porque RLS filtra filas, no columnas: aquí solo entra el dueño.
create table public.product_costs (
  product_id      uuid primary key,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  cost            numeric(12,2) not null check (cost >= 0),
  updated_at      timestamptz not null default now(),
  foreign key (product_id, organization_id)
    references public.products (id, organization_id) on delete cascade
);
create index product_costs_org_idx on public.product_costs (organization_id);

create trigger product_costs_set_updated_at before update on public.product_costs
  for each row execute function public.set_updated_at();

create table public.stock_movements (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  product_id      uuid not null,
  type            public.stock_movement_type not null,
  qty             numeric(14,3) not null check (qty <> 0),   -- + entra, − sale
  stock_after     numeric(14,3) not null,
  reason          text,
  sale_id         uuid,                                       -- FK se agrega en la migración de ventas
  created_by      uuid references auth.users (id) on delete set null default auth.uid(),
  created_at      timestamptz not null default now(),
  foreign key (product_id, organization_id)
    references public.products (id, organization_id) on delete restrict
);
create index stock_movements_product_idx on public.stock_movements (organization_id, product_id, created_at desc);
create index stock_movements_sale_idx    on public.stock_movements (sale_id) where sale_id is not null;

-- ---------------------------------------------------------------- triggers

-- Aplica el movimiento al stock en la misma transacción y guarda el saldo resultante.
create function public.apply_stock_movement() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.products c where c.parent_id = new.product_id) then
    raise exception 'Este producto tiene variantes: el stock se lleva en cada variante'
      using errcode = 'P0001';
  end if;

  update public.products p
     set stock = p.stock + new.qty
   where p.id = new.product_id and p.organization_id = new.organization_id
  returning p.stock into new.stock_after;

  if not found then
    raise exception 'Producto no encontrado' using errcode = 'P0002';
  end if;
  return new;
end $$;

create trigger stock_movements_apply before insert on public.stock_movements
  for each row execute function public.apply_stock_movement();

-- Variantes de un solo nivel; el producto principal no lleva stock propio.
create function public.check_product_variant() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_parent_parent uuid;
  v_parent_stock  numeric;
begin
  if new.parent_id is null then
    return new;
  end if;

  select p.parent_id, p.stock into v_parent_parent, v_parent_stock
  from public.products p
  where p.id = new.parent_id and p.organization_id = new.organization_id
  for update;

  if not found then
    raise exception 'Producto principal no encontrado' using errcode = 'P0002';
  end if;
  if v_parent_parent is not null then
    raise exception 'Una variante no puede tener sus propias variantes' using errcode = 'P0001';
  end if;
  if v_parent_stock <> 0 then
    raise exception 'Deja en 0 el stock del producto antes de agregarle variantes' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.products c where c.parent_id = new.id) then
    raise exception 'Un producto con variantes no puede ser variante de otro' using errcode = 'P0001';
  end if;
  return new;
end $$;

create trigger products_check_variant before insert or update of parent_id on public.products
  for each row execute function public.check_product_variant();

-- ---------------------------------------------------------------- RPC

-- Entrada por compra, stock inicial o ajuste manual (solo dueño).
-- p_qty es la variación (+ entra, − sale). p_movement_id lo genera el cliente: reintentar no duplica.
create function public.adjust_stock(
  p_product_id  uuid,
  p_type        public.stock_movement_type,
  p_qty         numeric,
  p_reason      text default null,
  p_movement_id uuid default null
) returns numeric
language plpgsql security definer set search_path = '' as $$
declare
  v_org   uuid;
  v_stock numeric;
  v_id    uuid := coalesce(p_movement_id, gen_random_uuid());
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesión' using errcode = '28000';
  end if;

  select p.organization_id into v_org from public.products p where p.id = p_product_id;
  if v_org is null or not public.is_member(v_org) then
    raise exception 'Producto no encontrado' using errcode = 'P0002';
  end if;
  if not public.is_owner(v_org) then
    raise exception 'Solo el dueño puede cambiar el stock' using errcode = '42501';
  end if;
  if p_type not in ('initial', 'purchase', 'adjustment') then
    raise exception 'Tipo de movimiento no permitido' using errcode = '22023';
  end if;
  if p_qty is null or p_qty = 0 then
    raise exception 'La cantidad no puede ser cero' using errcode = '22023';
  end if;
  if p_type in ('initial', 'purchase') and p_qty < 0 then
    raise exception 'La cantidad de una entrada debe ser mayor que cero' using errcode = '22023';
  end if;
  if p_type = 'adjustment' and coalesce(trim(p_reason), '') = '' then
    raise exception 'Escribe el motivo del ajuste' using errcode = '22023';
  end if;

  select m.stock_after into v_stock
  from public.stock_movements m where m.id = v_id and m.organization_id = v_org;
  if found then
    return v_stock;
  end if;

  insert into public.stock_movements (id, organization_id, product_id, type, qty, reason, created_by)
  values (v_id, v_org, p_product_id, p_type, p_qty, nullif(trim(p_reason), ''), auth.uid())
  returning stock_after into v_stock;

  return v_stock;
end $$;

-- ---------------------------------------------------------------- RLS

alter table public.categories      enable row level security;
alter table public.products        enable row level security;
alter table public.product_costs   enable row level security;
alter table public.stock_movements enable row level security;

create policy categories_select on public.categories
  for select to authenticated using (public.is_member(organization_id));
create policy categories_insert on public.categories
  for insert to authenticated with check (public.is_owner(organization_id));
create policy categories_update on public.categories
  for update to authenticated using (public.is_owner(organization_id)) with check (public.is_owner(organization_id));
create policy categories_delete on public.categories
  for delete to authenticated using (public.is_owner(organization_id));

create policy products_select on public.products
  for select to authenticated using (public.is_member(organization_id));
create policy products_insert on public.products
  for insert to authenticated with check (public.is_owner(organization_id));
create policy products_update on public.products
  for update to authenticated using (public.is_owner(organization_id)) with check (public.is_owner(organization_id));

create policy product_costs_owner on public.product_costs
  for all to authenticated using (public.is_owner(organization_id)) with check (public.is_owner(organization_id));

create policy stock_movements_select on public.stock_movements
  for select to authenticated using (public.is_member(organization_id));

-- ---------------------------------------------------------------- permisos

revoke all on public.categories, public.products, public.product_costs, public.stock_movements
  from anon, authenticated;

grant select, insert, update, delete on public.categories to authenticated;

-- Productos: sin permiso sobre la columna stock (ni organization_id al actualizar).
grant select on public.products to authenticated;
grant insert (id, organization_id, parent_id, name, variant_label, sku, barcode, category_id, unit,
              retail_price, wholesale_price, wholesale_min_qty, min_stock, active)
  on public.products to authenticated;
grant update (parent_id, name, variant_label, sku, barcode, category_id, unit,
              retail_price, wholesale_price, wholesale_min_qty, min_stock, active)
  on public.products to authenticated;

grant select, insert, update, delete on public.product_costs to authenticated;

-- Movimientos: solo lectura; se escriben únicamente desde funciones.
grant select on public.stock_movements to authenticated;

revoke execute on function public.adjust_stock(uuid, public.stock_movement_type, numeric, text, uuid)
  from public, anon;
grant execute on function public.adjust_stock(uuid, public.stock_movement_type, numeric, text, uuid)
  to authenticated;
