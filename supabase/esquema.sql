-- ============================================================
-- La Jamacasa · base de datos (Supabase)
-- Pégalo entero en SQL Editor → New query → Run.
-- Se puede volver a ejecutar sin romper nada.
--
-- Cómo funciona la seguridad:
--  · Cada móvil entra con el código de la casa y el PIN de su persona.
--  · Solo los móviles que han entrado así pueden leer o apuntar algo.
--  · Cada cosa que se apunta queda firmada por quien la apunta, con la hora
--    de la base de datos (nadie puede firmar por otro ni cambiar la hora).
--  · Nada se borra: si algo está mal, se anula con otro apunte.
-- ============================================================

create extension if not exists pgcrypto with schema extensions;

-- ——— Tablas ———

create table if not exists public.jc_casa (
  id int primary key default 1 check (id = 1),
  codigo_hash text not null,
  config jsonb not null,
  creada timestamptz not null default now()
);

create table if not exists public.jc_miembros (
  id text primary key,
  nombre text not null,
  color text not null,
  figura text,
  orden int not null default 0,
  pin_hash text,
  fallos int not null default 0,
  bloqueado_hasta timestamptz
);

create table if not exists public.jc_dispositivos (
  uid uuid primary key references auth.users (id) on delete cascade,
  miembro text not null references public.jc_miembros (id) on delete cascade,
  creado timestamptz not null default now()
);

create table if not exists public.jc_eventos (
  id uuid primary key default gen_random_uuid(),
  ts timestamptz not null default now(),
  autor text not null references public.jc_miembros (id),
  tipo text not null check (tipo ~ '^[a-z_]{2,40}$'),
  datos jsonb not null default '{}'::jsonb check (pg_column_size(datos) < 20000)
);
create index if not exists jc_eventos_ts on public.jc_eventos (ts);

-- ——— Quién es este móvil ———

create or replace function public.jc_yo() returns text
language sql stable security definer set search_path = public as $$
  select miembro from public.jc_dispositivos where uid = auth.uid()
$$;

-- Al apuntar algo, la base de datos pone el autor y la hora
create or replace function public.jc_sellar() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.autor := public.jc_yo();
  if new.autor is null then
    raise exception 'no_miembro';
  end if;
  new.ts := now();
  return new;
end
$$;

drop trigger if exists jc_sellar on public.jc_eventos;
create trigger jc_sellar before insert on public.jc_eventos
  for each row execute function public.jc_sellar();

-- ——— La puerta: código de la casa + PIN ———

-- Paso 1: con el código, quién vive en la casa
create or replace function public.jc_miembros(p_codigo text)
returns table (id text, nombre text, color text, figura text, orden int, tiene_pin boolean)
language plpgsql security definer set search_path = public, extensions as $$
#variable_conflict use_column
begin
  if auth.uid() is null then
    raise exception 'sesion';
  end if;
  if not exists (select 1 from public.jc_casa c where c.codigo_hash = extensions.crypt(p_codigo, c.codigo_hash)) then
    perform pg_sleep(0.6);
    raise exception 'codigo';
  end if;
  return query
    select m.id, m.nombre, m.color, m.figura, m.orden, (m.pin_hash is not null)
    from public.jc_miembros m
    order by m.orden;
end
$$;

-- Paso 2: elegir quién eres y poner el PIN (la primera vez se crea).
-- Devuelve 'ok' o el motivo: 'codigo', 'pin', 'bloqueado', 'pin_formato', 'miembro'.
-- Con 5 fallos seguidos, esa persona queda bloqueada 15 minutos.
create or replace function public.jc_unirse(p_codigo text, p_miembro text, p_pin text)
returns text
language plpgsql security definer set search_path = public, extensions as $$
declare
  m public.jc_miembros%rowtype;
begin
  if auth.uid() is null then
    return 'sesion';
  end if;
  if not exists (select 1 from public.jc_casa c where c.codigo_hash = extensions.crypt(p_codigo, c.codigo_hash)) then
    perform pg_sleep(0.6);
    return 'codigo';
  end if;
  if p_pin is null or p_pin !~ '^[0-9]{4,8}$' then
    return 'pin_formato';
  end if;
  select * into m from public.jc_miembros where jc_miembros.id = p_miembro for update;
  if not found then
    return 'miembro';
  end if;
  if m.bloqueado_hasta is not null and m.bloqueado_hasta > now() then
    return 'bloqueado';
  end if;
  if m.pin_hash is null then
    update public.jc_miembros
      set pin_hash = extensions.crypt(p_pin, extensions.gen_salt('bf')), fallos = 0, bloqueado_hasta = null
      where jc_miembros.id = p_miembro;
  elsif m.pin_hash <> extensions.crypt(p_pin, m.pin_hash) then
    if m.fallos + 1 >= 5 then
      update public.jc_miembros set fallos = 0, bloqueado_hasta = now() + interval '15 minutes' where jc_miembros.id = p_miembro;
    else
      update public.jc_miembros set fallos = m.fallos + 1 where jc_miembros.id = p_miembro;
    end if;
    perform pg_sleep(0.4);
    return 'pin';
  else
    update public.jc_miembros set fallos = 0, bloqueado_hasta = null where jc_miembros.id = p_miembro;
  end if;
  insert into public.jc_dispositivos (uid, miembro) values (auth.uid(), p_miembro)
    on conflict (uid) do update set miembro = excluded.miembro, creado = now();
  return 'ok';
end
$$;

-- Salir de la casa en este móvil
create or replace function public.jc_salir() returns void
language sql security definer set search_path = public as $$
  delete from public.jc_dispositivos where uid = auth.uid()
$$;

-- ——— Permisos ———

alter table public.jc_casa enable row level security;
alter table public.jc_miembros enable row level security;
alter table public.jc_dispositivos enable row level security;
alter table public.jc_eventos enable row level security;

revoke all on public.jc_casa, public.jc_miembros, public.jc_dispositivos, public.jc_eventos from anon, authenticated;
-- Nadie puede ver el código de la casa ni los PIN (solo sus huellas cifradas, y ni eso)
grant select (id, config, creada) on public.jc_casa to authenticated;
grant select (id, nombre, color, figura, orden) on public.jc_miembros to authenticated;
grant select, insert on public.jc_eventos to authenticated;

drop policy if exists jc_casa_leer on public.jc_casa;
create policy jc_casa_leer on public.jc_casa for select to authenticated using (public.jc_yo() is not null);

drop policy if exists jc_miembros_leer on public.jc_miembros;
create policy jc_miembros_leer on public.jc_miembros for select to authenticated using (public.jc_yo() is not null);

drop policy if exists jc_eventos_leer on public.jc_eventos;
create policy jc_eventos_leer on public.jc_eventos for select to authenticated using (public.jc_yo() is not null);

drop policy if exists jc_eventos_apuntar on public.jc_eventos;
create policy jc_eventos_apuntar on public.jc_eventos for insert to authenticated with check (public.jc_yo() is not null);

revoke all on function public.jc_yo() from public, anon;
revoke all on function public.jc_miembros(text) from public, anon;
revoke all on function public.jc_unirse(text, text, text) from public, anon;
revoke all on function public.jc_salir() from public, anon;
grant execute on function public.jc_yo() to authenticated;
grant execute on function public.jc_miembros(text) to authenticated;
grant execute on function public.jc_unirse(text, text, text) to authenticated;
grant execute on function public.jc_salir() to authenticated;

-- ——— Fotos (privadas: solo las ven los de la casa) ———

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('jc-fotos', 'jc-fotos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists jc_fotos_leer on storage.objects;
create policy jc_fotos_leer on storage.objects for select to authenticated
  using (bucket_id = 'jc-fotos' and public.jc_yo() is not null);

drop policy if exists jc_fotos_subir on storage.objects;
create policy jc_fotos_subir on storage.objects for insert to authenticated
  with check (bucket_id = 'jc-fotos' and public.jc_yo() is not null);

-- ——— Que los cambios lleguen al momento a los otros móviles ———

do $$
begin
  alter publication supabase_realtime add table public.jc_eventos;
exception
  when duplicate_object then null;
end
$$;
