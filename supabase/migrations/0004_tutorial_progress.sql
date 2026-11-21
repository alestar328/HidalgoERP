-- 0004_tutorial_progress: historial de tutoriales por usuario, para que el progreso siga a la
-- cuenta (no al equipo) y el dueño vea qué guías hizo cada vendedor.
--
-- Las guías (textos, pasos) viven en el código (src/tutorial/guides.ts); aquí solo se guarda
-- quién terminó qué guía y cuándo. Cada usuario escribe lo suyo con las RPC de abajo.

create table public.tutorial_progress (
  organization_id    uuid not null references public.organizations (id) on delete cascade,
  user_id            uuid not null references auth.users (id) on delete cascade,
  guide_id           text not null check (guide_id ~ '^[a-z][a-z0-9-]{1,39}$'),
  first_completed_at timestamptz not null default now(),
  last_completed_at  timestamptz not null default now(),
  times_completed    integer not null default 1 check (times_completed > 0),
  primary key (organization_id, user_id, guide_id)
);

-- Cuándo se ofreció la bienvenida (la vio o dijo "ahora no"). Null = se le vuelve a ofrecer.
alter table public.memberships
  add column tutorial_welcome_at timestamptz;

-- ---------------------------------------------------------------- RPC

-- Registra que el usuario terminó una guía (si la repite, suma una vez más).
create function public.complete_guide(p_org uuid, p_guide text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null or not public.is_member(p_org) then
    raise exception 'No perteneces a este negocio' using errcode = '42501';
  end if;
  insert into public.tutorial_progress (organization_id, user_id, guide_id)
  values (p_org, v_user, p_guide)
  on conflict (organization_id, user_id, guide_id) do update
    set last_completed_at = now(),
        times_completed = public.tutorial_progress.times_completed + 1;
  update public.memberships set tutorial_welcome_at = coalesce(tutorial_welcome_at, now())
  where organization_id = p_org and user_id = v_user;
end $$;

-- Sube lo que el equipo tenía guardado sin conexión (o de antes de esta migración).
-- No cuenta repeticiones: solo agrega las guías que faltan.
create function public.sync_tutorial_progress(p_org uuid, p_guides text[], p_welcome boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null or not public.is_member(p_org) then
    raise exception 'No perteneces a este negocio' using errcode = '42501';
  end if;
  if coalesce(array_length(p_guides, 1), 0) > 100 then
    raise exception 'Demasiadas guías' using errcode = '22023';
  end if;
  insert into public.tutorial_progress (organization_id, user_id, guide_id)
  select distinct p_org, v_user, g from unnest(coalesce(p_guides, '{}')) as g
  on conflict (organization_id, user_id, guide_id) do nothing;
  if p_welcome or coalesce(array_length(p_guides, 1), 0) > 0 then
    update public.memberships set tutorial_welcome_at = coalesce(tutorial_welcome_at, now())
    where organization_id = p_org and user_id = v_user;
  end if;
end $$;

-- Marca la bienvenida como ofrecida (p_seen) o la vuelve a ofrecer. El historial no se borra.
create function public.set_tutorial_welcome(p_org uuid, p_seen boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null or not public.is_member(p_org) then
    raise exception 'No perteneces a este negocio' using errcode = '42501';
  end if;
  update public.memberships
  set tutorial_welcome_at = case when p_seen then coalesce(tutorial_welcome_at, now()) end
  where organization_id = p_org and user_id = v_user;
end $$;

-- ---------------------------------------------------------------- RLS

alter table public.tutorial_progress enable row level security;

-- Cada uno ve lo suyo; el dueño ve el de todo su negocio.
create policy tutorial_progress_select on public.tutorial_progress
  for select to authenticated
  using (user_id = (select auth.uid()) or public.is_owner(organization_id));

-- ---------------------------------------------------------------- permisos

-- Solo lectura directa; se escribe con las RPC.
revoke all on public.tutorial_progress from anon, authenticated;
grant select on public.tutorial_progress to authenticated;

revoke execute on function public.complete_guide(uuid, text),
  public.sync_tutorial_progress(uuid, text[], boolean),
  public.set_tutorial_welcome(uuid, boolean) from public, anon;
grant execute on function public.complete_guide(uuid, text),
  public.sync_tutorial_progress(uuid, text[], boolean),
  public.set_tutorial_welcome(uuid, boolean) to authenticated;
