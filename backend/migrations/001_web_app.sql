-- AulaQuipu — migración 001: conciliación con la web app (apps/web-app)
-- Fecha: 2026-10-17
--
-- Se aplica sobre una base creada con database.sql (+ demo_seed.sql). Es idempotente:
-- se puede ejecutar más de una vez sin efectos duplicados. Ya está incluida en
-- database.sql (sección 8), así que en una base nueva NO hace falta correrla aparte.
--
-- Cambios:
--   1. Login con DNI + contraseña (tabla credentials, hash bcrypt con pgcrypto).
--   2. Columnas que usa la app: requests.preferred_at, sessions.topic_id, sessions.doc_markdown.
--   3. tutor_settings: precio grupal y horarios del tutor.
--   4. Persona visual de los tutores IA (emoji, color, tagline).
--   5. RPCs atómicas para reservar, unirse a grupos, aceptar pedidos e iniciar clases.
--      Validan contra el saldo DISPONIBLE (saldo − lo ya comprometido en clases por cobrar).
--   6. Seguridad: el navegador ya no escribe directo en la base. Todas las escrituras pasan
--      por la API de Next.js (route handlers) con la secret key; se quitan las políticas
--      de escritura abiertas, la lectura pública de reviews (feedback privado) y el permiso
--      de anon para ejecutar las funciones que mueven quipus.

begin;

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

-- ============================================================
-- 1. CREDENCIALES (DNI + contraseña)
-- ============================================================

create table if not exists credentials (
  profile_id uuid primary key references profiles(id) on delete cascade,
  dni text not null unique check (dni ~ '^[0-9]{8}$'),
  password_hash text not null,
  is_test boolean not null default false,
  created_at timestamptz not null default now()
);

alter table credentials enable row level security;
-- Sin políticas: invisible para anon/authenticated. Solo la API (service role) la lee.
revoke all on credentials from anon, authenticated;

-- ============================================================
-- 2. COLUMNAS NUEVAS
-- ============================================================

alter table requests add column if not exists preferred_at timestamptz;
alter table sessions add column if not exists topic_id uuid references topics(id) on delete set null;
alter table sessions add column if not exists doc_markdown text not null default '';

create index if not exists ix_sessions_group on sessions (group_id);
create index if not exists ix_sessions_student on sessions (student_id);
create index if not exists ix_group_members_student on group_members (student_id);

-- Sesiones IA del demo sin pedido: según demo_seed.sql son de fracciones
update sessions set topic_id = (select id from topics where name = 'fracciones')
where id in ('40000000-0000-0000-0000-000000000004', '40000000-0000-0000-0000-000000000007')
  and topic_id is null;

-- Resto de sesiones existentes: el tema sale del grupo, del pedido o del primer tema del tutor IA
update sessions s
set topic_id = coalesce(
  (select g.topic_id from groups g where g.id = s.group_id),
  (select r.topic_id from requests r where r.id = s.request_id),
  (select att.topic_id from ai_tutor_topics att join topics t on t.id = att.topic_id
   where att.ai_tutor_id = s.ai_tutor_id order by t.created_at, t.name limit 1)
)
where s.topic_id is null;

-- ============================================================
-- 3. AJUSTES DEL TUTOR (precio grupal + horarios)
-- ============================================================

create table if not exists tutor_settings (
  tutor_id uuid primary key references profiles(id) on delete cascade,
  group_price_quipus int not null default 20 check (group_price_quipus between 1 and 500),
  availability text[] not null default '{}',
  updated_at timestamptz not null default now()
);

alter table tutor_settings enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'tutor_settings'
                 and policyname = 'p_select_tutor_settings') then
    create policy p_select_tutor_settings on tutor_settings for select using (true);
  end if;
end $$;
grant select on tutor_settings to anon, authenticated;

-- Tutores del demo con el precio que ya cobraron en demo_seed.sql
insert into tutor_settings (tutor_id, group_price_quipus, availability)
select v.tutor_id, v.price, v.availability
from (values
  ('10000000-0000-0000-0000-000000000001'::uuid, 30, '{"Lun 16:00","Mié 16:00","Vie 15:00"}'::text[]),
  ('10000000-0000-0000-0000-000000000002'::uuid, 20, '{"Mar 17:00","Jue 17:00"}'::text[]),
  ('10000000-0000-0000-0000-000000000003'::uuid, 15, '{"Lun 18:00","Sáb 10:00"}'::text[]),
  ('10000000-0000-0000-0000-000000000009'::uuid, 24, '{"Mié 15:00","Vie 16:00"}'::text[])
) as v(tutor_id, price, availability)
where exists (select 1 from profiles p where p.id = v.tutor_id)
on conflict (tutor_id) do nothing;

insert into tutor_settings (tutor_id)
select distinct tutor_id from tutor_topics
on conflict (tutor_id) do nothing;

-- ============================================================
-- 4. PERSONA VISUAL DE LOS TUTORES IA
-- ============================================================

update ai_tutors set persona = persona || '{"emoji":"🪢","color":"#7C6BF2","tagline":"Matemática y física, paso a paso"}'::jsonb
where name = 'Quipu';
update ai_tutors set persona = persona || '{"emoji":"🤝","color":"#FF8A65","tagline":"Lectura, redacción, inglés e historia"}'::jsonb
where name = 'Ayni';
update ai_tutors set persona = persona || '{"emoji":"☀️","color":"#2FD3A3","tagline":"Ciencias y programación, muy visual"}'::jsonb
where name = 'Inti';

-- ============================================================
-- 5. FUNCIONES
-- ============================================================

-- Serializa operaciones de dinero de un mismo perfil dentro de la transacción.
create or replace function lock_wallet(p_profile_id uuid)
returns void language plpgsql as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('wallet:' || p_profile_id::text, 0));
end $$;

-- Saldo disponible = saldo del ledger − clases reservadas aún no cobradas.
create or replace function available_balance(p_profile_id uuid)
returns bigint language sql stable security definer set search_path = public as $$
  select get_balance(p_profile_id)
    - coalesce((select sum(s.price_quipus) from sessions s
                where s.student_id = p_profile_id and s.tutor_kind = 'ai' and s.status = 'live'), 0)
    - coalesce((select sum(gm.share_quipus) from group_members gm join groups g on g.id = gm.group_id
                where gm.student_id = p_profile_id and gm.status = 'joined'
                  and g.status in ('forming', 'scheduled', 'live')), 0);
$$;

-- Login: devuelve el profile_id si DNI y contraseña coinciden; null si no.
create or replace function login(p_dni text, p_password text)
returns uuid language sql stable security definer set search_path = public, extensions as $$
  select c.profile_id from credentials c
  where c.dni = p_dni and c.password_hash = extensions.crypt(p_password, c.password_hash);
$$;

-- Compra de skin: idempotente, valida saldo disponible y serializa por billetera.
create or replace function buy_skin(p_profile_id uuid, p_skin_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_price int;
begin
  perform lock_wallet(p_profile_id);
  if exists (select 1 from profile_skins where profile_id = p_profile_id and skin_id = p_skin_id) then
    return;
  end if;
  select price_quipus into v_price from skins where id = p_skin_id;
  if v_price is null then
    raise exception 'skin_no_existe';
  end if;
  if v_price > 0 then
    if available_balance(p_profile_id) < v_price then
      raise exception 'saldo_insuficiente';
    end if;
    insert into quipus_ledger (from_profile, to_profile, amount, kind)
    values (p_profile_id, null, v_price, 'skin_purchase');
  end if;
  insert into profile_skins (profile_id, skin_id) values (p_profile_id, p_skin_id);
end $$;

-- Clase 1:1 con tutor IA. Si ya hay una en vivo con el mismo tutor y tema, la reutiliza.
create or replace function book_ai(p_student_id uuid, p_ai_tutor_id uuid, p_request_id uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_price int;
  v_topic uuid;
  v_req requests%rowtype;
  v_id uuid;
begin
  perform lock_wallet(p_student_id);
  select price_quipus into v_price from ai_tutors where id = p_ai_tutor_id;
  if v_price is null then
    raise exception 'tutor_no_existe';
  end if;
  if p_request_id is not null then
    select * into v_req from requests where id = p_request_id;
    if not found or v_req.student_id <> p_student_id then
      raise exception 'pedido_no_existe';
    end if;
    v_topic := v_req.topic_id;
  else
    select att.topic_id into v_topic from ai_tutor_topics att join topics t on t.id = att.topic_id
    where att.ai_tutor_id = p_ai_tutor_id order by t.created_at, t.name limit 1;
  end if;

  select id into v_id from sessions
  where student_id = p_student_id and ai_tutor_id = p_ai_tutor_id and status = 'live'
    and topic_id is not distinct from v_topic
  limit 1;
  if v_id is not null then
    return v_id;
  end if;

  if available_balance(p_student_id) < v_price then
    raise exception 'saldo_insuficiente';
  end if;
  v_id := gen_random_uuid();
  insert into sessions (id, request_id, student_id, tutor_kind, ai_tutor_id, room_name, price_quipus, topic_id)
  values (v_id, p_request_id, p_student_id, 'ai', p_ai_tutor_id, 'session-' || v_id, v_price, v_topic);
  if p_request_id is not null then
    update requests set status = 'matched' where id = p_request_id and status = 'open';
  end if;
  return v_id;
end $$;

-- Clase individual con tutor humano: un grupo de 1 alumno, agendado.
create or replace function book_human(p_student_id uuid, p_tutor_id uuid, p_request_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_req requests%rowtype;
  v_price int;
  v_gid uuid;
begin
  perform lock_wallet(p_student_id);
  if p_student_id = p_tutor_id then
    raise exception 'no_puedes_contratarte';
  end if;
  select * into v_req from requests where id = p_request_id for update;
  if not found or v_req.student_id <> p_student_id then
    raise exception 'pedido_no_existe';
  end if;
  if v_req.status <> 'open' then
    raise exception 'pedido_no_disponible';
  end if;
  if not exists (select 1 from tutor_topics where tutor_id = p_tutor_id and topic_id = v_req.topic_id) then
    raise exception 'tutor_no_ensena_tema';
  end if;
  v_price := coalesce((select group_price_quipus from tutor_settings where tutor_id = p_tutor_id), 20);
  if available_balance(p_student_id) < v_price then
    raise exception 'saldo_insuficiente';
  end if;
  insert into groups (topic_id, tutor_id, total_price_quipus, scheduled_at, status)
  values (v_req.topic_id, p_tutor_id, v_price, coalesce(v_req.preferred_at, now() + interval '1 day'), 'scheduled')
  returning id into v_gid;
  insert into group_members (group_id, student_id, share_quipus) values (v_gid, p_student_id, v_price);
  update requests set status = 'matched' where id = p_request_id;
  return v_gid;
end $$;

-- Unirse a un grupo que se está formando. Reparte P/N entre todos (§11.1).
create or replace function join_group(p_student_id uuid, p_group_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_g groups%rowtype;
  v_n int;
  v_share int;
begin
  perform lock_wallet(p_student_id);
  select * into v_g from groups where id = p_group_id for update;
  if not found then
    raise exception 'grupo_no_existe';
  end if;
  if exists (select 1 from group_members where group_id = p_group_id and student_id = p_student_id and status = 'joined') then
    return p_group_id;
  end if;
  if v_g.status <> 'forming' then
    raise exception 'grupo_no_disponible';
  end if;
  if v_g.tutor_id = p_student_id then
    raise exception 'no_puedes_unirte_a_tu_clase';
  end if;
  select count(*) + 1 into v_n from group_members where group_id = p_group_id and status = 'joined';
  if v_n > 5 then
    raise exception 'grupo_lleno';
  end if;
  v_share := floor(v_g.total_price_quipus::numeric / v_n);
  if available_balance(p_student_id) < v_share then
    raise exception 'saldo_insuficiente';
  end if;
  insert into group_members (group_id, student_id, share_quipus, status)
  values (p_group_id, p_student_id, v_share, 'joined')
  on conflict (group_id, student_id) do update set status = 'joined', share_quipus = excluded.share_quipus;
  update group_members set share_quipus = v_share where group_id = p_group_id and status = 'joined';
  update requests set status = 'matched'
  where student_id = p_student_id and topic_id = v_g.topic_id and status = 'open';
  if v_g.tutor_id is not null and v_n >= 3 then
    update groups set status = 'scheduled' where id = p_group_id;
  end if;
  return p_group_id;
end $$;

-- El tutor acepta un pedido. Si es grupal, suma otros pedidos grupales abiertos del mismo
-- tema (máx. 5 alumnos) y reparte el precio; quien no tenga saldo disponible queda fuera.
create or replace function accept_request(p_tutor_id uuid, p_request_id uuid, p_scheduled_at timestamptz default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_req requests%rowtype;
  v_price int;
  v_ids uuid[];
  v_students uuid[];
  v_share int;
  v_gid uuid;
  r record;
begin
  select * into v_req from requests where id = p_request_id for update;
  if not found or v_req.status <> 'open' then
    raise exception 'pedido_no_disponible';
  end if;
  if v_req.student_id = p_tutor_id then
    raise exception 'no_puedes_ensenarte';
  end if;
  if not exists (select 1 from tutor_topics where tutor_id = p_tutor_id and topic_id = v_req.topic_id) then
    raise exception 'tutor_no_ensena_tema';
  end if;
  v_price := coalesce((select group_price_quipus from tutor_settings where tutor_id = p_tutor_id), 20);

  v_ids := array[v_req.id];
  v_students := array[v_req.student_id];
  if v_req.mode = 'grupo' then
    for r in
      select id, student_id from requests
      where status = 'open' and mode = 'grupo' and topic_id = v_req.topic_id
        and id <> v_req.id and student_id <> p_tutor_id
      order by created_at
      for update
    loop
      exit when array_length(v_ids, 1) >= 5;
      if not (r.student_id = any(v_students)) then
        v_ids := v_ids || r.id;
        v_students := v_students || r.student_id;
      end if;
    end loop;
  end if;

  -- Dos pasadas: quitar a quien no alcance y recalcular la cuota con el grupo final
  for i in 1..2 loop
    v_share := floor(v_price::numeric / array_length(v_ids, 1));
    select coalesce(array_agg(q.id order by q.ord), '{}'), coalesce(array_agg(q.student_id order by q.ord), '{}')
      into v_ids, v_students
    from (
      select x.id, x.student_id, x.ord
      from unnest(v_ids, v_students) with ordinality as x(id, student_id, ord)
      where x.id = v_req.id or available_balance(x.student_id) >= v_share
    ) q;
  end loop;
  v_share := floor(v_price::numeric / array_length(v_ids, 1));
  if available_balance(v_req.student_id) < v_share then
    raise exception 'alumno_sin_saldo';
  end if;

  insert into groups (topic_id, tutor_id, total_price_quipus, scheduled_at, status)
  values (v_req.topic_id, p_tutor_id, v_price, coalesce(p_scheduled_at, v_req.preferred_at, now() + interval '1 day'), 'scheduled')
  returning id into v_gid;
  insert into group_members (group_id, student_id, share_quipus)
  select v_gid, s, v_share from unnest(v_students) as s;
  update requests set status = 'matched' where id = any(v_ids);
  return v_gid;
end $$;

-- Abrir el aula de un grupo (tutor o alumno del grupo). Reutiliza la sesión en vivo si existe.
create or replace function start_group_session(p_profile_id uuid, p_group_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_g groups%rowtype;
  v_id uuid;
begin
  select * into v_g from groups where id = p_group_id for update;
  if not found then
    raise exception 'grupo_no_existe';
  end if;
  if v_g.tutor_id is distinct from p_profile_id
     and not exists (select 1 from group_members where group_id = p_group_id and student_id = p_profile_id and status = 'joined') then
    raise exception 'no_eres_parte';
  end if;
  if v_g.status in ('completed', 'cancelled') then
    raise exception 'clase_terminada';
  end if;
  if v_g.tutor_id is null then
    raise exception 'grupo_sin_tutor';
  end if;
  if not exists (select 1 from group_members where group_id = p_group_id and status = 'joined') then
    raise exception 'grupo_vacio';
  end if;
  select id into v_id from sessions where group_id = p_group_id and status = 'live' limit 1;
  if v_id is not null then
    return v_id;
  end if;
  v_id := gen_random_uuid();
  insert into sessions (id, group_id, tutor_kind, tutor_id, room_name, price_quipus, topic_id)
  values (v_id, p_group_id, 'human', v_g.tutor_id, 'session-' || v_id, v_g.total_price_quipus, v_g.topic_id);
  update groups set status = 'live' where id = p_group_id;
  return v_id;
end $$;

-- Cierre de sesión (misma política que antes: la clase ocurrió, se cobra siempre).
-- Correcciones: marca como 'fulfilled' el pedido de las sesiones IA y, en grupos,
-- solo los pedidos 'matched' del tema (antes también tocaba pedidos abiertos o cancelados).
create or replace function end_session(p_session_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v sessions%rowtype;
  v_topic uuid;
begin
  update sessions
    set status = 'completed', ended_at = now()
    where id = p_session_id and status = 'live'
    returning * into v;
  if not found then
    return;
  end if;
  if v.tutor_kind = 'ai' then
    insert into quipus_ledger (session_id, from_profile, to_profile, amount, kind)
    values (v.id, coalesce(v.student_id, (select student_id from requests where id = v.request_id)),
            null, v.price_quipus, 'ai_session');
    if v.request_id is not null then
      update requests set status = 'fulfilled' where id = v.request_id and status in ('open', 'matched');
    end if;
  elsif v.group_id is not null then
    insert into quipus_ledger (session_id, from_profile, to_profile, amount, kind)
    select v.id, gm.student_id, v.tutor_id, gm.share_quipus, 'session_payment'
    from group_members gm
    where gm.group_id = v.group_id and gm.status = 'joined' and gm.share_quipus > 0
      and gm.student_id is distinct from v.tutor_id;
    select topic_id into v_topic from groups where id = v.group_id;
    update groups set status = 'completed' where id = v.group_id;
    update requests set status = 'fulfilled'
      where status = 'matched' and topic_id = v_topic
        and student_id in (select student_id from group_members where group_id = v.group_id and status = 'joined');
  else
    insert into quipus_ledger (session_id, from_profile, to_profile, amount, kind)
    values (v.id, coalesce(v.student_id, (select student_id from requests where id = v.request_id)),
            v.tutor_id, v.price_quipus, 'session_payment');
    update requests set status = 'fulfilled' where id = v.request_id;
  end if;
end $$;

-- ============================================================
-- 6. SEGURIDAD: escrituras solo vía API (service role)
-- ============================================================

do $$
declare t text;
begin
  foreach t in array array['profiles','topics','tutor_topics','requests','groups',
    'group_members','reviews','profile_skins','session_events']
  loop
    execute format('drop policy if exists p_write_%1$s on %1$s', t);
  end loop;
end $$;

-- El texto de las reviews es privado: ya no se lee con la clave pública.
drop policy if exists p_select_reviews on reviews;

revoke insert, update, delete, truncate on all tables in schema public from anon, authenticated;

revoke execute on function
  lock_wallet(uuid), available_balance(uuid), login(text, text), buy_skin(uuid, uuid),
  book_ai(uuid, uuid, uuid), book_human(uuid, uuid, uuid), join_group(uuid, uuid),
  accept_request(uuid, uuid, timestamptz), start_group_session(uuid, uuid),
  create_session(uuid, text, int, uuid, uuid, uuid, uuid), end_session(uuid), get_balance(uuid)
from public, anon, authenticated;

grant execute on function
  lock_wallet(uuid), available_balance(uuid), login(text, text), buy_skin(uuid, uuid),
  book_ai(uuid, uuid, uuid), book_human(uuid, uuid, uuid), join_group(uuid, uuid),
  accept_request(uuid, uuid, timestamptz), start_group_session(uuid, uuid),
  create_session(uuid, text, int, uuid, uuid, uuid, uuid), end_session(uuid), get_balance(uuid)
to service_role;

-- ============================================================
-- 7. CUENTAS DE PRUEBA (solo perfiles demo de demo_seed.sql)
-- ============================================================
-- DNI 700000NN (NN = últimos dígitos del perfil demo), contraseña de prueba: aula2026

insert into credentials (profile_id, dni, password_hash, is_test)
select p.id, '700000' || right(p.id::text, 2), extensions.crypt('aula2026', extensions.gen_salt('bf', 8)), true
from profiles p
where p.id::text like '10000000-0000-0000-0000-0000000000%'
on conflict (profile_id) do nothing;

commit;
