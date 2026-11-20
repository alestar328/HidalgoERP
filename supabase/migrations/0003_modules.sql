-- 0003_modules: rubro del negocio, módulos activos por negocio y origen de reposición del producto.
--
-- El catálogo de módulos (nombres, dependencias, paquetes por rubro) vive en el código
-- (src/modules/catalog.ts). La base solo guarda el rubro y las decisiones del dueño:
-- un módulo sin fila en organization_modules usa lo que trae el paquete de su rubro.
-- Así, un módulo nuevo llega encendido o apagado según el rubro sin migrar datos.

create type public.business_type as enum ('general', 'bodega', 'limpieza', 'fruteria', 'iluminacion', 'ropa');
create type public.product_source as enum ('purchase', 'production');

alter table public.organizations
  add column business_type public.business_type not null default 'general';

-- Origen al reponer: compra a proveedor o producción propia (taller, confección).
alter table public.products
  add column source public.product_source not null default 'purchase';

create table public.organization_modules (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  module_id       text not null check (module_id ~ '^[a-z][a-z0-9-]{1,39}$'),
  enabled         boolean not null,
  config          jsonb not null default '{}'::jsonb,
  updated_at      timestamptz not null default now(),
  primary key (organization_id, module_id)
);

create trigger organization_modules_set_updated_at before update on public.organization_modules
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------- RPC

-- Igual que en 0001, ahora con el rubro. Idempotente: si ya tiene negocio, lo devuelve sin cambiarlo.
drop function public.create_organization(text, text, text);

create function public.create_organization(
  p_name          text,
  p_phone         text default null,
  p_display_name  text default null,
  p_business_type public.business_type default 'general'
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_org  uuid;
begin
  if v_user is null then
    raise exception 'Debes iniciar sesión' using errcode = '28000';
  end if;
  if coalesce(trim(p_name), '') = '' then
    raise exception 'Escribe el nombre de tu negocio' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_user::text, 0));

  select m.organization_id into v_org
  from public.memberships m where m.user_id = v_user
  order by m.created_at limit 1;
  if v_org is not null then
    return v_org;
  end if;

  insert into public.organizations (name, phone, created_by, business_type)
  values (trim(p_name), nullif(trim(p_phone), ''), v_user, coalesce(p_business_type, 'general'))
  returning id into v_org;

  insert into public.memberships (organization_id, user_id, role, display_name, email)
  values (v_org, v_user, 'owner', nullif(trim(p_display_name), ''), lower(auth.jwt() ->> 'email'));

  return v_org;
end $$;

-- Cambia el rubro y vuelve a su paquete de módulos (borra las decisiones anteriores). Solo dueño.
create function public.set_business_type(p_org uuid, p_business_type public.business_type) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_owner(p_org) then
    raise exception 'Solo el dueño puede cambiar el rubro' using errcode = '42501';
  end if;
  update public.organizations set business_type = p_business_type where id = p_org;
  delete from public.organization_modules where organization_id = p_org;
end $$;

-- Enciende o apaga varios módulos de una vez (p. ej. un módulo y sus dependencias). Solo dueño.
-- Las dependencias entre módulos las resuelve la app con el catálogo; aquí solo se guardan.
create function public.set_modules(p_org uuid, p_modules text[], p_enabled boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_owner(p_org) then
    raise exception 'Solo el dueño puede cambiar los módulos' using errcode = '42501';
  end if;
  if p_enabled is null or p_modules is null then
    raise exception 'Faltan datos' using errcode = '22023';
  end if;
  insert into public.organization_modules (organization_id, module_id, enabled)
  select p_org, m, p_enabled from unnest(p_modules) as m
  on conflict (organization_id, module_id) do update set enabled = excluded.enabled;
end $$;

-- ---------------------------------------------------------------- RLS

alter table public.organization_modules enable row level security;

create policy organization_modules_select on public.organization_modules
  for select to authenticated using (public.is_member(organization_id));

-- ---------------------------------------------------------------- permisos

-- Módulos: solo lectura directa; se escriben con set_modules y set_business_type.
revoke all on public.organization_modules from anon, authenticated;
grant select on public.organization_modules to authenticated;

grant insert (source) on public.products to authenticated;
grant update (source) on public.products to authenticated;

revoke execute on function public.create_organization(text, text, text, public.business_type),
  public.set_business_type(uuid, public.business_type),
  public.set_modules(uuid, text[], boolean) from public, anon;
grant execute on function public.create_organization(text, text, text, public.business_type),
  public.set_business_type(uuid, public.business_type),
  public.set_modules(uuid, text[], boolean) to authenticated;
