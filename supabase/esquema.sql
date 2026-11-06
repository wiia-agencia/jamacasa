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

-- ——— Avisos al móvil ———
-- Cada móvil que activa los avisos guarda aquí su dirección de avisos (la da el navegador).
-- Cuando alguien apunta algo, la base de datos llama a la app (jamacasa.vercel.app/api/avisos),
-- que mira a quién le toca enterarse y le manda el aviso. Cada hora, lo mismo para los
-- recordatorios (el lunes, el domingo por la noche, plazos que se acaban y el alquiler).
-- Las llaves no las ve nadie: la clave de la app la crea esta base de datos (en Vault) y la
-- llave que firma los avisos la crea la propia app la primera vez y la guarda aquí, en Vault.

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema pg_catalog;
grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;

create table if not exists public.jc_suscripciones (
  endpoint text primary key,
  miembro text not null references public.jc_miembros (id) on delete cascade,
  p256dh text not null,
  auth text not null,
  creada timestamptz not null default now(),
  usada timestamptz not null default now()
);
alter table public.jc_suscripciones enable row level security;
revoke all on public.jc_suscripciones from anon, authenticated;

-- La llave pública de los avisos (no es secreta: los móviles la usan para apuntarse)
create table if not exists public.jc_avisos_llave (
  id int primary key default 1 check (id = 1),
  vapid_publica text not null,
  creada timestamptz not null default now()
);
alter table public.jc_avisos_llave enable row level security;
revoke all on public.jc_avisos_llave from anon, authenticated;

-- La clave de la app: la crea la propia base de datos la primera vez (nadie la teclea ni la ve)
do $clave$
begin
  if not exists (select 1 from vault.secrets where name = 'jamacasa_avisos') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'jamacasa_avisos', 'Clave de los avisos de la Jamacasa (la crea la propia base de datos)');
  end if;
end
$clave$;

-- Este móvil se apunta a los avisos (o renueva su dirección)
create or replace function public.jc_suscribir(p_endpoint text, p_p256dh text, p_auth text) returns void
language plpgsql security definer set search_path = public as $$
declare
  yo text := public.jc_yo();
begin
  if yo is null then
    raise exception 'no_miembro';
  end if;
  if p_endpoint is null or p_endpoint !~ '^https://' or length(p_endpoint) > 1000
     or coalesce(length(p_p256dh), 0) not between 40 and 200
     or coalesce(length(p_auth), 0) not between 10 and 100 then
    raise exception 'suscripcion';
  end if;
  insert into public.jc_suscripciones (endpoint, miembro, p256dh, auth)
    values (p_endpoint, yo, p_p256dh, p_auth)
    on conflict (endpoint) do update
      set miembro = excluded.miembro, p256dh = excluded.p256dh, auth = excluded.auth, usada = now();
end
$$;

-- Este móvil deja de recibir avisos
create or replace function public.jc_desuscribir(p_endpoint text) returns void
language sql security definer set search_path = public as $$
  delete from public.jc_suscripciones where endpoint = p_endpoint and miembro = public.jc_yo()
$$;

-- La llave pública, para los móviles de la casa (null si aún no está)
create or replace function public.jc_vapid_publica() returns text
language sql stable security definer set search_path = public as $$
  select l.vapid_publica from public.jc_avisos_llave l where l.id = 1 and public.jc_yo() is not null
$$;

-- La clave de la app (en Vault). Sin ella, no sale ningún aviso.
create or replace function public.jc_clave_avisos() returns text
language sql stable security definer set search_path = public as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'jamacasa_avisos' limit 1
$$;

-- Lo que la app necesita para avisar (solo con la clave)
create or replace function public.jc_avisos_datos(p_clave text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  buena text := public.jc_clave_avisos();
begin
  if buena is null or p_clave is null or p_clave <> buena then
    perform pg_sleep(0.5);
    raise exception 'clave';
  end if;
  return jsonb_build_object(
    'config', (select c.config from public.jc_casa c where c.id = 1),
    'miembros', (select coalesce(jsonb_agg(jsonb_build_object('id', m.id, 'nombre', m.nombre, 'color', m.color, 'figura', m.figura) order by m.orden), '[]'::jsonb)
                 from public.jc_miembros m),
    'eventos', (select coalesce(jsonb_agg(jsonb_build_object('id', e.id, 'ts', floor(extract(epoch from e.ts) * 1000), 'autor', e.autor, 'tipo', e.tipo, 'datos', e.datos) order by e.ts), '[]'::jsonb)
                from public.jc_eventos e),
    'suscripciones', (select coalesce(jsonb_agg(jsonb_build_object('endpoint', s.endpoint, 'miembro', s.miembro, 'p256dh', s.p256dh, 'auth', s.auth)), '[]'::jsonb)
                      from public.jc_suscripciones s),
    'vapid', (select v.decrypted_secret from vault.decrypted_secrets v where v.name = 'jamacasa_vapid' limit 1),
    'vapid_publica', (select l.vapid_publica from public.jc_avisos_llave l where l.id = 1)
  );
end
$$;

-- La app guarda la llave que firma los avisos la primera vez (si ya hay una, se queda la que hay).
-- Devuelve la llave pública que vale.
create or replace function public.jc_avisos_poner_vapid(p_clave text, p_publica text, p_privada text) returns text
language plpgsql security definer set search_path = public as $$
declare
  buena text := public.jc_clave_avisos();
begin
  if buena is null or p_clave is null or p_clave <> buena then
    raise exception 'clave';
  end if;
  if coalesce(length(p_publica), 0) not between 80 and 100 or coalesce(length(p_privada), 0) not between 40 and 50 then
    raise exception 'llave';
  end if;
  perform pg_advisory_xact_lock(hashtext('jamacasa_vapid'));
  if not exists (select 1 from vault.secrets where name = 'jamacasa_vapid') then
    perform vault.create_secret(p_privada, 'jamacasa_vapid', 'Llave que firma los avisos de la Jamacasa (la creó la propia app)');
    delete from public.jc_avisos_llave;
    insert into public.jc_avisos_llave (id, vapid_publica) values (1, p_publica);
  else
    insert into public.jc_avisos_llave (id, vapid_publica) values (1, p_publica) on conflict (id) do nothing;
  end if;
  return (select l.vapid_publica from public.jc_avisos_llave l where l.id = 1);
end
$$;

-- Quita las direcciones de avisos que ya no existen (app desinstalada, móvil nuevo…)
create or replace function public.jc_avisos_quitar(p_clave text, p_endpoints text[]) returns void
language plpgsql security definer set search_path = public as $$
declare
  buena text := public.jc_clave_avisos();
begin
  if buena is null or p_clave is null or p_clave <> buena then
    raise exception 'clave';
  end if;
  delete from public.jc_suscripciones where endpoint = any (p_endpoints);
end
$$;

-- Llama a la app para que avise
create or replace function public.jc_llamar_avisos(p_cuerpo jsonb) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare
  clave text := public.jc_clave_avisos();
begin
  if clave is null then
    return;
  end if;
  perform net.http_post(
    url := 'https://jamacasa.vercel.app/api/avisos',
    body := p_cuerpo,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-clave', clave),
    timeout_milliseconds := 20000
  );
end
$$;

-- Cada vez que alguien apunta algo
create or replace function public.jc_avisar() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  begin
    perform public.jc_llamar_avisos(jsonb_build_object('tipo', 'evento', 'id', new.id));
  exception when others then
    null; -- si el aviso falla, lo apuntado se guarda igual
  end;
  return null;
end
$$;

drop trigger if exists jc_avisar on public.jc_eventos;
create trigger jc_avisar after insert on public.jc_eventos
  for each row execute function public.jc_avisar();

-- Cada hora, a los cinco minutos: los recordatorios
select cron.schedule('jamacasa-avisos', '5 * * * *', $cron$select public.jc_llamar_avisos('{"tipo":"reloj"}'::jsonb)$cron$);

revoke all on function public.jc_suscribir(text, text, text) from public, anon;
revoke all on function public.jc_desuscribir(text) from public, anon;
revoke all on function public.jc_vapid_publica() from public, anon;
revoke all on function public.jc_clave_avisos() from public, anon, authenticated;
revoke all on function public.jc_avisos_datos(text) from public, authenticated;
revoke all on function public.jc_avisos_poner_vapid(text, text, text) from public, authenticated;
revoke all on function public.jc_avisos_quitar(text, text[]) from public, authenticated;
revoke all on function public.jc_llamar_avisos(jsonb) from public, anon, authenticated;
revoke all on function public.jc_avisar() from public, anon, authenticated;
grant execute on function public.jc_suscribir(text, text, text) to authenticated;
grant execute on function public.jc_desuscribir(text) to authenticated;
grant execute on function public.jc_vapid_publica() to authenticated;
-- La app (sin sesión) solo puede usar estas tres, y solo con la clave
grant execute on function public.jc_avisos_datos(text) to anon;
grant execute on function public.jc_avisos_poner_vapid(text, text, text) to anon;
grant execute on function public.jc_avisos_quitar(text, text[]) to anon;

-- Que la app prepare ya su llave de firmar (tarda unos segundos)
select public.jc_llamar_avisos('{"tipo":"preparar"}'::jsonb);
