-- 0001_core: negocios (organizations), miembros, invitaciones y helpers de RLS.
-- Multi-tenant: todo cuelga de organization_id y nadie ve datos de otro negocio.

create schema if not exists extensions;
create extension if not exists pg_trgm with schema extensions;

create type public.member_role as enum ('owner', 'seller');

-- ---------------------------------------------------------------- tablas

create table public.organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(trim(name)) > 0),
  phone       text,
  address     text,
  settings    jsonb not null default '{}'::jsonb,
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now()
);

create table public.memberships (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id         uuid not null references auth.users (id) on delete cascade,
  role            public.member_role not null default 'seller',
  display_name    text,
  email           text,
  created_at      timestamptz not null default now(),
  unique (organization_id, user_id)
);
create index memberships_user_idx on public.memberships (user_id);

create table public.invitations (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  email           text not null check (email = lower(trim(email)) and position('@' in email) > 1),
  role            public.member_role not null default 'seller',
  invited_by      uuid references auth.users (id) on delete set null default auth.uid(),
  accepted_at     timestamptz,
  created_at      timestamptz not null default now(),
  unique (organization_id, email)
);
create index invitations_email_idx on public.invitations (email) where accepted_at is null;

-- ---------------------------------------------------------------- helpers

-- SECURITY DEFINER: leen memberships sin pasar por RLS (evita recursión en las políticas).
create function public.is_member(p_org uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.memberships m
    where m.organization_id = p_org and m.user_id = (select auth.uid())
  );
$$;

create function public.is_owner(p_org uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.memberships m
    where m.organization_id = p_org and m.user_id = (select auth.uid()) and m.role = 'owner'
  );
$$;

create function public.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------------------------------------------------------------- RPC

-- Crea el negocio y deja al usuario como dueño. Idempotente: si ya tiene negocio, lo devuelve.
create function public.create_organization(
  p_name text,
  p_phone text default null,
  p_display_name text default null
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

  insert into public.organizations (name, phone, created_by)
  values (trim(p_name), nullif(trim(p_phone), ''), v_user)
  returning id into v_org;

  insert into public.memberships (organization_id, user_id, role, display_name, email)
  values (v_org, v_user, 'owner', nullif(trim(p_display_name), ''), lower(auth.jwt() ->> 'email'));

  return v_org;
end $$;

-- Convierte en membresías las invitaciones pendientes del correo con el que se inició sesión.
create function public.accept_invitations() returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_user  uuid := auth.uid();
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_count integer := 0;
  r record;
begin
  if v_user is null or v_email = '' then
    return 0;
  end if;
  for r in
    select i.id, i.organization_id, i.role
    from public.invitations i
    where i.email = v_email and i.accepted_at is null
    for update
  loop
    insert into public.memberships (organization_id, user_id, role, email)
    values (r.organization_id, v_user, r.role, v_email)
    on conflict (organization_id, user_id) do nothing;
    update public.invitations set accepted_at = now() where id = r.id;
    v_count := v_count + 1;
  end loop;
  return v_count;
end $$;

-- ---------------------------------------------------------------- RLS

alter table public.organizations enable row level security;
alter table public.memberships   enable row level security;
alter table public.invitations   enable row level security;

create policy organizations_select on public.organizations
  for select to authenticated using (public.is_member(id));
create policy organizations_update on public.organizations
  for update to authenticated using (public.is_owner(id)) with check (public.is_owner(id));

create policy memberships_select on public.memberships
  for select to authenticated
  using (user_id = (select auth.uid()) or public.is_owner(organization_id));
-- El dueño puede quitar vendedores, nunca a un dueño.
create policy memberships_delete on public.memberships
  for delete to authenticated
  using (public.is_owner(organization_id) and role <> 'owner');

create policy invitations_select on public.invitations
  for select to authenticated using (public.is_owner(organization_id));
create policy invitations_insert on public.invitations
  for insert to authenticated with check (public.is_owner(organization_id) and role = 'seller');
create policy invitations_delete on public.invitations
  for delete to authenticated using (public.is_owner(organization_id));

-- ---------------------------------------------------------------- permisos
-- Explícitos: no dependemos de los privilegios por defecto del proyecto.

revoke all on public.organizations, public.memberships, public.invitations from anon, authenticated;
grant select on public.organizations to authenticated;
grant update (name, phone, address, settings) on public.organizations to authenticated;
grant select, delete on public.memberships to authenticated;
grant select, delete on public.invitations to authenticated;
grant insert (organization_id, email, role) on public.invitations to authenticated;

revoke execute on function public.is_member(uuid), public.is_owner(uuid),
  public.create_organization(text, text, text), public.accept_invitations() from public, anon;
grant execute on function public.is_member(uuid), public.is_owner(uuid),
  public.create_organization(text, text, text), public.accept_invitations() to authenticated;
