-- AulaQuipu — schema completo (Postgres / Supabase)
-- Última corrección: 2026-10-18 (incluye migrations/001_web_app.sql en la sección 8, 002_more_skins.sql en la 9 y 003_admin.sql en la 10)
-- Ejecutar de una sola vez contra la base. Idempotente por sección (drop + create).
-- Orden en una base nueva: database.sql → demo_seed.sql.
-- Base ya creada con una versión anterior: correr las migraciones que falten (migrations/00N_*.sql).

-- ============================================================
-- 1. TABLAS
-- ============================================================

drop table if exists chat_reports cascade;
drop table if exists announcements cascade;
drop table if exists ai_promotions cascade;
drop table if exists ai_guides cascade;
drop table if exists admin_audit cascade;
drop table if exists admins cascade;
drop table if exists chat_reports cascade;
drop table if exists announcements cascade;
drop table if exists ai_promotions cascade;
drop table if exists ai_guides cascade;
drop table if exists admin_audit cascade;
drop table if exists admins cascade;
drop table if exists chat_reports cascade;
drop table if exists announcements cascade;
drop table if exists ai_promotions cascade;
drop table if exists ai_guides cascade;
drop table if exists admin_audit cascade;
drop table if exists admins cascade;
drop table if exists credentials cascade;
drop table if exists tutor_settings cascade;
drop table if exists session_events cascade;
drop table if exists profile_skins cascade;
drop table if exists skins cascade;
drop table if exists reviews cascade;
drop table if exists quipus_ledger cascade;
drop table if exists sessions cascade;
drop table if exists group_members cascade;
drop table if exists groups cascade;
drop table if exists ai_tutor_topics cascade;
drop table if exists ai_tutors cascade;
drop table if exists requests cascade;
drop table if exists tutor_topics cascade;
drop table if exists topics cascade;
drop table if exists profiles cascade;

-- Perfiles: usuarios hardcodeados para la demo (sin auth).
create table profiles (
  id uuid primary key default gen_random_uuid(),
  username text unique not null,
  display_name text not null,
  grade smallint not null check (grade between 1 and 5),
  school text,
  avatar_config jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- Temas: libres, propuestos por alumnos, solo secundaria (validado en producto).
create table topics (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  proposed_by uuid references profiles(id) on delete set null,
  status text not null default 'active' check (status in ('active','flagged')),
  created_at timestamptz not null default now()
);

create unique index ux_topics_name on topics (lower(name));

-- Capacidad declarada del tutor humano.
create table tutor_topics (
  tutor_id uuid not null references profiles(id) on delete cascade,
  topic_id uuid not null references topics(id) on delete cascade,
  level text not null default 'basico' check (level in ('basico','intermedio','avanzado')),
  primary key (tutor_id, topic_id)
);

-- Pedidos de aprendizaje (demanda).
create table requests (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references profiles(id) on delete cascade,
  topic_id uuid not null references topics(id),
  detail text,
  mode text not null default 'grupo' check (mode in ('grupo','individual')),
  status text not null default 'open' check (status in ('open','matched','fulfilled','cancelled')),
  created_at timestamptz not null default now()
);

-- Tutores de IA (personas premium).
create table ai_tutors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  persona jsonb not null default '{}',
  price_quipus int not null check (price_quipus > 0)
);

create table ai_tutor_topics (
  ai_tutor_id uuid not null references ai_tutors(id) on delete cascade,
  topic_id uuid not null references topics(id) on delete cascade,
  primary key (ai_tutor_id, topic_id)
);

-- Grupos formados por el matching (exige tutor humano O tutor IA, exactamente uno).
create table groups (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references topics(id),
  tutor_id uuid references profiles(id) on delete set null,
  ai_tutor_id uuid references ai_tutors(id) on delete set null,
  total_price_quipus int not null check (total_price_quipus > 0),
  scheduled_at timestamptz,
  status text not null default 'forming' check (status in ('forming','scheduled','live','completed','cancelled')),
  created_at timestamptz not null default now(),
  check ((tutor_id is null) <> (ai_tutor_id is null))
);

create table group_members (
  group_id uuid not null references groups(id) on delete cascade,
  student_id uuid not null references profiles(id) on delete cascade,
  share_quipus int not null check (share_quipus >= 0),
  status text not null default 'joined' check (status in ('joined','left','cancelled')),
  primary key (group_id, student_id)
);

-- Sesiones en vivo (clases).
create table sessions (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references groups(id) on delete set null,
  request_id uuid references requests(id) on delete set null,
  student_id uuid references profiles(id) on delete set null,
  tutor_kind text not null check (tutor_kind in ('human','ai')),
  tutor_id uuid references profiles(id) on delete set null,
  ai_tutor_id uuid references ai_tutors(id) on delete set null,
  room_name text not null,
  price_quipus int not null check (price_quipus > 0),
  status text not null default 'live' check (status in ('live','completed','cancelled')),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  check ((tutor_id is null) <> (ai_tutor_id is null)),
  check (tutor_kind = 'human' and tutor_id is not null
      or tutor_kind = 'ai' and ai_tutor_id is not null),
  check (group_id is not null or student_id is not null)
);

-- Ledger de quipus: única fuente de verdad del saldo.
create table quipus_ledger (
  id bigint generated always as identity primary key,
  session_id uuid references sessions(id) on delete set null,
  from_profile uuid references profiles(id) on delete set null,
  to_profile uuid references profiles(id) on delete set null,
  amount bigint not null check (amount > 0),
  kind text not null check (kind in ('mint','session_payment','ai_session','skin_purchase','refund')),
  created_at timestamptz not null default now(),
  check (not (from_profile is null and to_profile is null)),
  check (from_profile is distinct from to_profile)
);

-- Un solo mint inicial por cuenta (idempotente).
create unique index ux_ledger_mint_per_profile on quipus_ledger (to_profile) where kind = 'mint';

-- Reviews: estrellas públicas; feedback privado. Sirve para humanos y para agentes IA.
create table reviews (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  reviewer_id uuid not null references profiles(id) on delete cascade,
  tutor_id uuid references profiles(id) on delete cascade,
  ai_tutor_id uuid references ai_tutors(id) on delete cascade,
  stars smallint not null check (stars between 1 and 5),
  feedback_private text,
  created_at timestamptz not null default now(),
  unique (session_id, reviewer_id),
  check ((tutor_id is null) <> (ai_tutor_id is null))
);

-- Catálogo de skins (avatar, marcos, decoración, insignias por compra).
create table skins (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind text not null check (kind in ('avatar','frame','badge','profile_deco')),
  price_quipus int not null check (price_quipus >= 0),
  meta jsonb not null default '{}'
);

create table profile_skins (
  profile_id uuid not null references profiles(id) on delete cascade,
  skin_id uuid not null references skins(id) on delete cascade,
  equipped boolean not null default false,
  primary key (profile_id, skin_id)
);

-- Log de la clase: evidencia para la demo y trazabilidad.
create table session_events (
  id bigint generated always as identity primary key,
  session_id uuid not null references sessions(id) on delete cascade,
  actor text not null,
  kind text not null check (kind in ('join','leave','message','tool_call','doc_update','error','completed')),
  payload jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- ============================================================
-- 2. ÍNDICES
-- ============================================================

create index ix_requests_open on requests (topic_id, status) where status = 'open';
create index ix_tutor_topics_topic on tutor_topics (topic_id);
create index ix_groups_topic_status on groups (topic_id, status);
create index ix_sessions_tutor on sessions (tutor_id);
create index ix_sessions_ai_tutor on sessions (ai_tutor_id);
create index ix_sessions_request on sessions (request_id);
create index ix_ledger_to on quipus_ledger (to_profile);
create index ix_ledger_from on quipus_ledger (from_profile);
create index ix_ledger_session on quipus_ledger (session_id);
create index ix_reviews_tutor on reviews (tutor_id);
create index ix_reviews_ai_tutor on reviews (ai_tutor_id);
create index ix_session_events_session on session_events (session_id);

-- ============================================================
-- 3. VISTAS
-- ============================================================

create or replace view balances as
select p.id as profile_id,
  coalesce(sum(case when l.to_profile = p.id then l.amount else 0 end), 0)
  - coalesce(sum(case when l.from_profile = p.id then l.amount else 0 end), 0) as quipus
from profiles p
left join quipus_ledger l on l.to_profile = p.id or l.from_profile = p.id
group by p.id;

create or replace view tutor_stats as
select t.id as tutor_id,
  coalesce(avg(r.stars), 0)::numeric(3,2) as estrellas_promedio,
  count(distinct s.id) filter (where s.status = 'completed') as sesiones_completadas
from profiles t
left join sessions s on s.tutor_id = t.id
left join reviews r on r.tutor_id = t.id
group by t.id;

-- ============================================================
-- 4. RLS
-- ============================================================

-- El navegador NO escribe en la base: todas las escrituras pasan por la API de
-- Next.js (route handlers) con la secret key (service role, que ignora RLS).
-- Con la clave pública solo se puede LEER el catálogo y el estado público.
-- Las reviews no se leen con la clave pública: su texto es feedback privado.

alter table profiles enable row level security;
alter table topics enable row level security;
alter table tutor_topics enable row level security;
alter table requests enable row level security;
alter table ai_tutors enable row level security;
alter table ai_tutor_topics enable row level security;
alter table groups enable row level security;
alter table group_members enable row level security;
alter table sessions enable row level security;
alter table quipus_ledger enable row level security;
alter table reviews enable row level security;
alter table skins enable row level security;
alter table profile_skins enable row level security;
alter table session_events enable row level security;

do $$
declare t text;
begin
  foreach t in array array['profiles','topics','tutor_topics','requests','ai_tutors',
    'ai_tutor_topics','groups','group_members','sessions','quipus_ledger',
    'skins','profile_skins','session_events']
  loop
    execute format('create policy p_select_%s on %s for select using (true)', t, t);
  end loop;
end $$;

grant usage on schema public to anon, authenticated;
grant select on all tables in schema public to anon, authenticated;
grant select on balances, tutor_stats to anon, authenticated;

-- ============================================================
-- 5. SEEDS (catálogo base del producto)
-- ============================================================

-- Tutores IA premium (30 quipus la sesión individual).
insert into ai_tutors (name, persona, price_quipus) values
  ('Quipu',  '{"voice":"warm","style":"paso a paso","focus":"matematica"}', 30),
  ('Ayni',   '{"voice":"bright","style":"conversacional","focus":"comunicacion"}', 30),
  ('Inti',   '{"voice":"calm","style":"visual","focus":"ciencias"}', 30);

-- Skins: algunas gratis, el resto se compran con quipus.
insert into skins (name, kind, price_quipus, meta) values
  ('Avatar clásico',      'avatar',      0,  '{}'),
  ('Marco simple',        'frame',       0,  '{}'),
  ('Avatar Sol',          'avatar',     20,  '{"palette":"sun"}'),
  ('Avatar Cóndor',       'avatar',     30,  '{"palette":"condor"}'),
  ('Avatar Quipu',        'avatar',     40,  '{"palette":"quipu"}'),
  ('Marco Dorado',        'frame',      25,  '{"border":"gold"}'),
  ('Marco Andes',         'frame',      35,  '{"border":"andes"}'),
  ('Insignia Primer Tutor','badge',     50,  '{"icon":"star"}'),
  ('Decoración Estrellas','profile_deco', 15, '{"bg":"stars"}'),
  ('Decoración Cordillera','profile_deco', 15, '{"bg":"mountains"}');

-- Temas iniciales de secundaria (libres después; los alumnos proponen más).
insert into topics (name) values
  ('fracciones'),
  ('ecuaciones de segundo grado'),
  ('proporcionalidad'),
  ('comprensión lectora'),
  ('redacción de textos'),
  ('gramática'),
  ('biología celular'),
  ('química orgánica'),
  ('cinemática'),
  ('historia del Perú'),
  ('inglés básico'),
  ('programación básica')
on conflict do nothing;

-- Vincular tutores IA con temas (todas las áreas que cubre cada persona).
insert into ai_tutor_topics (ai_tutor_id, topic_id)
select a.id, t.id from ai_tutors a, topics t where a.name = 'Quipu' and t.name in ('fracciones','ecuaciones de segundo grado','proporcionalidad','cinemática')
on conflict do nothing;
insert into ai_tutor_topics (ai_tutor_id, topic_id)
select a.id, t.id from ai_tutors a, topics t where a.name = 'Ayni' and t.name in ('comprensión lectora','redacción de textos','gramática','inglés básico','historia del Perú')
on conflict do nothing;
insert into ai_tutor_topics (ai_tutor_id, topic_id)
select a.id, t.id from ai_tutors a, topics t where a.name = 'Inti' and t.name in ('biología celular','química orgánica','programación básica')
on conflict do nothing;

-- ============================================================
-- 6. USUARIOS DE DEMO (ejemplo — crear a mano los que se necesiten)
-- ============================================================
-- Cada usuario hardcodeado necesita: fila en profiles + fila mint de 100 quipus.
--
-- insert into profiles (id, username, display_name, grade, school) values
--   ('00000000-0000-0000-0000-000000000001', 'mate123',  'Mateo',   3, 'I.E. José Faustino Sánchez Carrión');
-- insert into quipus_ledger (to_profile, amount, kind) values
--   ('00000000-0000-0000-0000-000000000001', 100, 'mint');

-- ============================================================
-- 7. FUNCIONES RPC (única vía de escritura del ledger de quipus)
-- ============================================================
-- La API de Next.js las llama vía supabase.rpc(...) con la secret key. SECURITY DEFINER =
-- esquivan RLS de forma controlada y garantizan los invariantes de forma atómica.
-- (buy_skin y end_session se redefinen en la sección 8.)

create or replace function get_balance(p_profile_id uuid)
returns bigint language sql stable security definer set search_path = public as $$
  select coalesce(sum(case when to_profile = p_profile_id then amount else -amount end), 0)
  from quipus_ledger
  where to_profile = p_profile_id or from_profile = p_profile_id;
$$;

-- Compra de skin: valida saldo, escribe ledger + profile_skins. Idempotente.
create or replace function buy_skin(p_profile_id uuid, p_skin_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_price int;
  v_bal bigint;
begin
  if exists (select 1 from profile_skins where profile_id = p_profile_id and skin_id = p_skin_id) then
    return;
  end if;
  select price_quipus into v_price from skins where id = p_skin_id;
  if v_price is null then
    raise exception 'skin_no_existe';
  end if;
  select get_balance(p_profile_id) into v_bal;
  if v_bal < v_price then
    raise exception 'saldo_insuficiente';
  end if;
  if v_price > 0 then
    insert into quipus_ledger (from_profile, to_profile, amount, kind)
    values (p_profile_id, null, v_price, 'skin_purchase');
  end if;
  insert into profile_skins (profile_id, skin_id) values (p_profile_id, p_skin_id);
end $$;

-- Creación de sesión: valida saldo del pagador y coherencia del tutor.
create or replace function create_session(
  p_student_id uuid,
  p_tutor_kind text,
  p_price_quipus int,
  p_request_id uuid default null,
  p_group_id uuid default null,
  p_tutor_id uuid default null,
  p_ai_tutor_id uuid default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_bal bigint;
begin
  if p_price_quipus <= 0 then
    raise exception 'precio_invalido';
  end if;
  if p_tutor_kind not in ('human', 'ai') then
    raise exception 'tutor_kind_invalido';
  end if;
  if (p_tutor_id is null) = (p_ai_tutor_id is null) then
    raise exception 'tutor_invalido';
  end if;
  select get_balance(p_student_id) into v_bal;
  if v_bal < p_price_quipus then
    raise exception 'saldo_insuficiente';
  end if;
  insert into sessions (group_id, request_id, student_id, tutor_kind, tutor_id, ai_tutor_id, room_name, price_quipus)
  values (p_group_id, p_request_id, p_student_id, p_tutor_kind, p_tutor_id, p_ai_tutor_id, 'pending', p_price_quipus)
  returning id into v_id;
  update sessions set room_name = 'session-' || v_id where id = v_id;
  if p_request_id is not null then
    update requests set status = 'matched' where id = p_request_id and status = 'open';
  end if;
  return v_id;
end $$;

-- Cierre de sesión: liquida el ledger. Idempotente (doble click no liquida dos veces).
-- Política de liquidación [MÍO]: la clase ya ocurrió, se cobra siempre; un saldo
-- puede quedar negativo solo por este asiento ("deuda"). Compras y reservas sí
-- exigen saldo antes.
create or replace function end_session(p_session_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v sessions%rowtype;
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
  elsif v.group_id is not null then
    insert into quipus_ledger (session_id, from_profile, to_profile, amount, kind)
    select v.id, gm.student_id, v.tutor_id, gm.share_quipus, 'session_payment'
    from group_members gm
    where gm.group_id = v.group_id and gm.status = 'joined' and gm.share_quipus > 0;
    update groups set status = 'completed' where id = v.group_id;
    update requests set status = 'fulfilled'
      where id in (select r.id from requests r
                   join group_members gm on gm.student_id = r.student_id
                   where gm.group_id = v.group_id and r.topic_id = (select topic_id from groups where id = v.group_id));
  else
    insert into quipus_ledger (session_id, from_profile, to_profile, amount, kind)
    values (v.id, coalesce(v.student_id, (select student_id from requests where id = v.request_id)),
            v.tutor_id, v.price_quipus, 'session_payment');
    update requests set status = 'fulfilled' where id = v.request_id;
  end if;
end $$;

-- Permisos de ejecución: ver sección 8 (solo service role).

-- ============================================================
-- 8. WEB APP (= migrations/001_web_app.sql)
-- ============================================================
-- Login con DNI, columnas y tablas que usa la app, RPCs de reserva y permisos.
-- Las partes que dependen de datos demo no hacen nada aquí; demo_seed.sql las completa.

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

-- ============================================================
-- 8.1 CREDENCIALES (DNI + contraseña)
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
-- 8.2 COLUMNAS NUEVAS
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
-- 8.3 AJUSTES DEL TUTOR (precio grupal + horarios)
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
-- 8.4 PERSONA VISUAL DE LOS TUTORES IA
-- ============================================================

update ai_tutors set persona = persona || '{"emoji":"🪢","color":"#7C6BF2","tagline":"Matemática y física, paso a paso"}'::jsonb
where name = 'Quipu';
update ai_tutors set persona = persona || '{"emoji":"🤝","color":"#FF8A65","tagline":"Lectura, redacción, inglés e historia"}'::jsonb
where name = 'Ayni';
update ai_tutors set persona = persona || '{"emoji":"☀️","color":"#2FD3A3","tagline":"Ciencias y programación, muy visual"}'::jsonb
where name = 'Inti';

-- ============================================================
-- 8.5 FUNCIONES
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
-- 8.6 SEGURIDAD: escrituras solo vía API (service role)
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
-- 8.7 CUENTAS DE PRUEBA (solo perfiles demo de demo_seed.sql)
-- ============================================================
-- DNI 700000NN (NN = últimos dígitos del perfil demo), contraseña de prueba: aula2026

insert into credentials (profile_id, dni, password_hash, is_test)
select p.id, '700000' || right(p.id::text, 2), extensions.crypt('aula2026', extensions.gen_salt('bf', 8)), true
from profiles p
where p.id::text like '10000000-0000-0000-0000-0000000000%'
on conflict (profile_id) do nothing;

-- ============================================================
-- 9. MÁS SKINS: COLORES Y DISEÑOS DE CABEZA (= migrations/002_more_skins.sql)
-- =====================================================
-- ============================================================

alter table skins drop constraint if exists skins_kind_check;
alter table skins add constraint skins_kind_check
  check (kind in ('avatar', 'head', 'frame', 'badge', 'profile_deco'));

insert into skins (name, kind, price_quipus, meta)
select v.name, v.kind, v.price, v.meta::jsonb
from (values
  -- Colores del cuerpo
  ('Rojo fuego',       'avatar', 10, '{"color":"#E5484D"}'),
  ('Mandarina',        'avatar', 10, '{"color":"#FF8A65"}'),
  ('Amarillo pollito', 'avatar', 10, '{"color":"#FFC94D"}'),
  ('Verde menta',      'avatar', 10, '{"color":"#2FD3A3"}'),
  ('Azul cielo',       'avatar', 10, '{"color":"#4FA3FF"}'),
  ('Morado galaxia',   'avatar', 15, '{"color":"#7C6BF2"}'),
  ('Rosa chicle',      'avatar', 15, '{"color":"#F06EAA"}'),
  ('Turquesa',         'avatar', 15, '{"color":"#14B8A6"}'),
  ('Gris lunar',       'avatar', 20, '{"color":"#9AA0B5"}'),
  ('Negro noche',      'avatar', 25, '{"color":"#3B3F5C"}'),
  -- Diseños de cabeza
  ('Lazo',             'head',   10, '{"accessory":"lazo"}'),
  ('Lentes de sol',    'head',   10, '{"accessory":"lentes"}'),
  ('Flor',             'head',   10, '{"accessory":"flor"}'),
  ('Gorra',            'head',   12, '{"accessory":"gorra"}'),
  ('Chullo andino',    'head',   15, '{"accessory":"chullo"}'),
  ('Orejas de gato',   'head',   15, '{"accessory":"gato"}'),
  ('Sombrero de paja', 'head',   15, '{"accessory":"sombrero"}'),
  ('Cresta punk',      'head',   18, '{"accessory":"cresta"}'),
  ('Rulos',            'head',   20, '{"accessory":"rulos"}'),
  ('Antenas',          'head',   20, '{"accessory":"antenas"}'),
  ('Audífonos',        'head',   20, '{"accessory":"audifonos"}'),
  ('Birrete',          'head',   25, '{"accessory":"birrete"}'),
  ('Corona inca',      'head',   45, '{"accessory":"corona"}')
) as v(name, kind, price, meta)
where not exists (select 1 from skins s where s.name = v.name);

-- ============================================================
-- 10. PANEL DE ADMINISTRACIÓN (= migrations/003_admin.sql)
-- ============================================================
-- Admins, auditoría, créditos (grant/adjust), promociones y precio efectivo de las clases IA,
-- guías IA, anuncios, reportes del chat, suspensión y métricas. Independiente de la migración 002.

-- ============================================================
-- 10.1 ADMINISTRADORES Y AUDITORÍA
-- ============================================================

create table if not exists admins (
  profile_id uuid primary key references profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists admin_audit (
  id bigint generated always as identity primary key,
  admin_id uuid references profiles(id) on delete set null,
  action text not null,
  target text,
  payload jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists ix_admin_audit_created on admin_audit (created_at desc);

-- ============================================================
-- 10.2 LEDGER: grant / adjust, nota y admin
-- ============================================================

-- La restricción de `kind` es un check en línea (nombre automático): se busca por definición.
do $$
declare c text;
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'quipus_ledger'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) like '%kind%' and pg_get_constraintdef(oid) like '%adjust%'
  ) then
    for c in
      select conname from pg_constraint
      where conrelid = 'quipus_ledger'::regclass and contype = 'c'
        and pg_get_constraintdef(oid) like '%kind%' and pg_get_constraintdef(oid) like '%session_payment%'
    loop
      execute format('alter table quipus_ledger drop constraint %I', c);
    end loop;
    alter table quipus_ledger add constraint quipus_ledger_kind_check
      check (kind in ('mint','session_payment','ai_session','skin_purchase','refund','grant','adjust'));
  end if;
end $$;

alter table quipus_ledger add column if not exists note text;
alter table quipus_ledger add column if not exists admin_id uuid references profiles(id) on delete set null;

-- ============================================================
-- 10.3 GUÍAS DE ENSEÑANZA IA (una por tema)
-- ============================================================

create table if not exists ai_guides (
  topic_id uuid primary key references topics(id) on delete cascade,
  objectives text not null default '',
  steps text not null default '',
  common_mistakes text not null default '',
  checks text not null default '',
  updated_by uuid references profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

-- ============================================================
-- 10.4 PROMOCIONES DE PRECIO IA
-- ============================================================

create table if not exists ai_promotions (
  id uuid primary key default gen_random_uuid(),
  ai_tutor_id uuid references ai_tutors(id) on delete cascade, -- null = todos los tutores IA
  percent_off int not null default 0 check (percent_off between 0 and 100),
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  first_class_free boolean not null default false,
  active boolean not null default true,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at),
  check (percent_off > 0 or first_class_free)
);

create index if not exists ix_ai_promotions_active on ai_promotions (active, starts_at, ends_at);

-- Una clase gratis se guarda con price_quipus = 0: se relaja el check de sessions (> 0 → >= 0).
do $$
declare c text;
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'sessions'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) like '%price_quipus%' and pg_get_constraintdef(oid) like '%>= 0%'
  ) then
    for c in
      select conname from pg_constraint
      where conrelid = 'sessions'::regclass and contype = 'c'
        and pg_get_constraintdef(oid) like '%price_quipus%' and pg_get_constraintdef(oid) like '%> 0%'
    loop
      execute format('alter table sessions drop constraint %I', c);
    end loop;
    alter table sessions add constraint sessions_price_quipus_check check (price_quipus >= 0);
  end if;
end $$;

-- ============================================================
-- 10.5 ANUNCIOS Y REPORTES DEL CHAT
-- ============================================================

create table if not exists announcements (
  id uuid primary key default gen_random_uuid(),
  text text not null check (length(text) between 1 and 280),
  active boolean not null default true,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists chat_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references profiles(id) on delete cascade,
  reported_id uuid not null references profiles(id) on delete cascade,
  text text not null default '',
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references profiles(id) on delete set null
);

create index if not exists ix_chat_reports_open on chat_reports (created_at desc) where resolved_at is null;

-- ============================================================
-- 10.6 SUSPENSIÓN Y PAUSA DE TUTORES IA
-- ============================================================

alter table profiles add column if not exists suspended_at timestamptz;
alter table profiles add column if not exists suspended_reason text;
alter table ai_tutors add column if not exists active boolean not null default true;
alter table skins add column if not exists active boolean not null default true;

-- ============================================================
-- 10.7 FUNCIONES
-- ============================================================
-- (créditos atómicos, precio efectivo de clases IA y métricas del panel)

-- Precio efectivo de una clase IA para un alumno: mejor promoción vigente (% de descuento)
-- o 0 si hay promoción de "primera clase gratis" y el alumno nunca tuvo una clase IA.
-- Cuenta sesiones (no asientos del ledger): una clase gratis no deja asiento.
create or replace function ai_price_for(p_student_id uuid, p_ai_tutor_id uuid)
returns int language plpgsql stable security definer set search_path = public as $$
declare
  v_base int;
  v_pct int;
  v_free boolean;
begin
  select price_quipus into v_base from ai_tutors where id = p_ai_tutor_id;
  if v_base is null then
    return null;
  end if;
  select coalesce(max(percent_off), 0), coalesce(bool_or(first_class_free), false)
    into v_pct, v_free
  from ai_promotions
  where active and starts_at <= now() and ends_at > now()
    and (ai_tutor_id is null or ai_tutor_id = p_ai_tutor_id);
  if v_free and not exists (
    select 1 from sessions where student_id = p_student_id and tutor_kind = 'ai' and status <> 'cancelled'
  ) then
    return 0;
  end if;
  if v_pct = 0 then
    return v_base;
  end if;
  return greatest(1, round(v_base::numeric * (100 - v_pct) / 100)::int);
end $$;

-- Clase 1:1 con tutor IA (igual que 001, con precio efectivo según promociones).
create or replace function book_ai(p_student_id uuid, p_ai_tutor_id uuid, p_request_id uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_price int;
  v_topic uuid;
  v_req requests%rowtype;
  v_id uuid;
begin
  perform lock_wallet(p_student_id);
  v_price := ai_price_for(p_student_id, p_ai_tutor_id);
  if v_price is null then
    raise exception 'tutor_no_existe';
  end if;
  if not (select active from ai_tutors where id = p_ai_tutor_id) then
    raise exception 'tutor_pausado';
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

-- Cierre de sesión (igual que 001; la clase IA gratis no escribe asiento de 0 quipus).
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
    if v.price_quipus > 0 then
      insert into quipus_ledger (session_id, from_profile, to_profile, amount, kind)
      values (v.id, coalesce(v.student_id, (select student_id from requests where id = v.request_id)),
              null, v.price_quipus, 'ai_session');
    end if;
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

-- Compra de skin (igual que 001, pero un artículo oculto por el admin ya no se vende;
-- quien ya lo tiene sigue conservándolo: el return idempotente va primero).
create or replace function buy_skin(p_profile_id uuid, p_skin_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_price int;
  v_active boolean;
begin
  perform lock_wallet(p_profile_id);
  if exists (select 1 from profile_skins where profile_id = p_profile_id and skin_id = p_skin_id) then
    return;
  end if;
  select price_quipus, active into v_price, v_active from skins where id = p_skin_id;
  if v_price is null or not v_active then
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

-- Une un tema duplicado (p_src) en otro (p_dst) de forma atómica: mueve pedidos, tutores humanos
-- y IA, grupos, clases y la guía (si el destino no tiene una) y borra el tema origen.
-- Escribe su propia fila de auditoría.
create or replace function admin_merge_topics(p_admin_id uuid, p_src uuid, p_dst uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_src topics%rowtype;
  v_dst topics%rowtype;
  v_req int; v_tt int; v_att int; v_grp int; v_ses int; v_guide int;
begin
  if p_src is null or p_dst is null or p_src = p_dst then
    raise exception 'tema_invalido';
  end if;
  -- Orden fijo de bloqueo: dos uniones cruzadas no se traban entre sí
  perform 1 from topics where id in (p_src, p_dst) order by id for update;
  select * into v_src from topics where id = p_src;
  select * into v_dst from topics where id = p_dst;
  if v_src.id is null or v_dst.id is null then
    raise exception 'tema_no_existe';
  end if;

  update requests set topic_id = p_dst where topic_id = p_src;
  get diagnostics v_req = row_count;
  update groups set topic_id = p_dst where topic_id = p_src;
  get diagnostics v_grp = row_count;
  update sessions set topic_id = p_dst where topic_id = p_src;
  get diagnostics v_ses = row_count;

  insert into tutor_topics (tutor_id, topic_id, level)
    select tutor_id, p_dst, level from tutor_topics where topic_id = p_src
    on conflict (tutor_id, topic_id) do nothing;
  get diagnostics v_tt = row_count;
  delete from tutor_topics where topic_id = p_src;

  insert into ai_tutor_topics (ai_tutor_id, topic_id)
    select ai_tutor_id, p_dst from ai_tutor_topics where topic_id = p_src
    on conflict (ai_tutor_id, topic_id) do nothing;
  get diagnostics v_att = row_count;
  delete from ai_tutor_topics where topic_id = p_src;

  update ai_guides set topic_id = p_dst
    where topic_id = p_src and not exists (select 1 from ai_guides where topic_id = p_dst);
  get diagnostics v_guide = row_count;

  delete from topics where id = p_src; -- lo que quede (p. ej. la guía duplicada) cae en cascada

  insert into admin_audit (admin_id, action, target, payload)
  values (p_admin_id, 'topic.merge', p_src::text, jsonb_build_object(
    'from', v_src.name, 'into', v_dst.name, 'into_id', p_dst,
    'requests', v_req, 'tutors', v_tt, 'ai_tutors', v_att, 'groups', v_grp, 'sessions', v_ses,
    'guide_moved', v_guide > 0));
  return jsonb_build_object('requests', v_req, 'tutors', v_tt, 'ai_tutors', v_att,
    'groups', v_grp, 'sessions', v_ses, 'guide_moved', v_guide > 0);
end $$;

-- Cierra una clase atascada (en vivo desde hace demasiado) SIN cobrar: el cobro de toda clase
-- se escribe recién en end_session, así que cancelar no deja asientos en el ledger y libera los
-- quipus retenidos (available_balance solo cuenta clases IA en vivo y grupos activos). Los
-- pedidos que quedaron "matched" vuelven a "open" para que el alumno pueda reservar de nuevo.
-- Devuelve la sala (para cerrarla en LiveKit) y cuánto se liberó. Escribe su propia auditoría.
create or replace function admin_cancel_session(p_admin_id uuid, p_session_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v sessions%rowtype;
  v_topic uuid;
  v_held bigint := 0;
begin
  update sessions
    set status = 'cancelled', ended_at = now()
    where id = p_session_id and status = 'live'
    returning * into v;
  if not found then
    if exists (select 1 from sessions where id = p_session_id) then
      raise exception 'clase_terminada';
    end if;
    raise exception 'clase_no_existe';
  end if;
  if v.group_id is not null then
    select coalesce(sum(share_quipus), 0) into v_held
      from group_members where group_id = v.group_id and status = 'joined';
    select topic_id into v_topic from groups where id = v.group_id;
    update groups set status = 'cancelled' where id = v.group_id;
    update requests set status = 'open'
      where status = 'matched' and topic_id = v_topic
        and student_id in (select student_id from group_members where group_id = v.group_id and status = 'joined');
  else
    if v.tutor_kind = 'ai' then
      v_held := v.price_quipus;
    end if;
    if v.request_id is not null then
      update requests set status = 'open' where id = v.request_id and status = 'matched';
    end if;
  end if;
  insert into admin_audit (admin_id, action, target, payload)
  values (p_admin_id, 'session.cancel', p_session_id::text, jsonb_build_object(
    'tutor_kind', v.tutor_kind, 'topic_id', v.topic_id, 'started_at', v.started_at, 'released', v_held));
  return jsonb_build_object('room_name', v.room_name, 'released', v_held);
end $$;

-- Créditos: p_amount > 0 regala quipus (grant), p_amount < 0 los descuenta (adjust).
-- p_scope: 'user' (p_value = id del perfil) | 'grade' (1..5) | 'school' (nombre exacto) | 'all'.
-- Todo ocurre en una sola transacción. Los descuentos que dejarían un saldo negativo se
-- omiten y se cuentan en `skipped`. Escribe su propia fila de auditoría.
create or replace function admin_grant(
  p_admin_id uuid, p_scope text, p_value text, p_amount bigint, p_reason text
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_ids uuid[];
  v_id uuid;
  v_abs bigint := abs(p_amount);
  v_note text := btrim(coalesce(p_reason, ''));
  v_affected int := 0;
  v_skipped int := 0;
begin
  if p_amount = 0 or v_abs > 10000 then
    raise exception 'credito_monto_invalido';
  end if;
  if length(v_note) < 3 or length(v_note) > 140 then
    raise exception 'credito_motivo_invalido';
  end if;

  if p_scope = 'user' then
    if p_value is null or p_value !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      raise exception 'perfil_no_existe';
    end if;
    select coalesce(array_agg(id), '{}') into v_ids from profiles where id = p_value::uuid;
    if cardinality(v_ids) = 0 then
      raise exception 'perfil_no_existe';
    end if;
  elsif p_scope = 'grade' then
    if p_value is null or p_value !~ '^[1-5]$' then
      raise exception 'credito_alcance_invalido';
    end if;
    select coalesce(array_agg(id order by id), '{}') into v_ids from profiles where grade = p_value::smallint;
  elsif p_scope = 'school' then
    if p_value is null or btrim(p_value) = '' then
      raise exception 'credito_alcance_invalido';
    end if;
    select coalesce(array_agg(id order by id), '{}') into v_ids from profiles where school = p_value;
  elsif p_scope = 'all' then
    select coalesce(array_agg(id order by id), '{}') into v_ids from profiles;
  else
    raise exception 'credito_alcance_invalido';
  end if;

  foreach v_id in array v_ids loop
    perform lock_wallet(v_id);
    if p_amount > 0 then
      insert into quipus_ledger (from_profile, to_profile, amount, kind, note, admin_id)
      values (null, v_id, v_abs, 'grant', v_note, p_admin_id);
      v_affected := v_affected + 1;
    elsif get_balance(v_id) >= v_abs then
      insert into quipus_ledger (from_profile, to_profile, amount, kind, note, admin_id)
      values (v_id, null, v_abs, 'adjust', v_note, p_admin_id);
      v_affected := v_affected + 1;
    else
      v_skipped := v_skipped + 1;
    end if;
  end loop;

  insert into admin_audit (admin_id, action, target, payload)
  values (
    p_admin_id,
    case when p_amount > 0 then 'credits.grant' else 'credits.adjust' end,
    p_scope || coalesce(':' || p_value, ''),
    jsonb_build_object('scope', p_scope, 'value', p_value, 'amount', p_amount, 'reason', v_note,
                       'affected', v_affected, 'skipped', v_skipped)
  );
  return jsonb_build_object('affected', v_affected, 'skipped', v_skipped);
end $$;


-- Métricas del panel en una sola llamada. "Hoy" = día calendario de Lima.
create or replace function admin_metrics()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_today timestamptz := date_trunc('day', now() at time zone 'America/Lima') at time zone 'America/Lima';
  v_out jsonb;
begin
  select jsonb_build_object(
    'generated_at', now(),
    'users', jsonb_build_object(
      'total', (select count(*) from profiles),
      'last24h', (select count(*) from profiles where created_at > now() - interval '24 hours')
    ),
    'active_today', (
      select count(distinct p) from (
        select from_profile as p from quipus_ledger where created_at >= v_today
        union all select to_profile from quipus_ledger where created_at >= v_today
        union all select student_id from sessions where started_at >= v_today
        union all select tutor_id from sessions where started_at >= v_today
        union all select student_id from requests where created_at >= v_today
        union all select reviewer_id from reviews where created_at >= v_today
      ) x where p is not null
    ),
    'classes', jsonb_build_object(
      'human_total', (select count(*) from sessions where status = 'completed' and tutor_kind = 'human'),
      'ai_total', (select count(*) from sessions where status = 'completed' and tutor_kind = 'ai'),
      'human_today', (select count(*) from sessions where status = 'completed' and tutor_kind = 'human' and ended_at >= v_today),
      'ai_today', (select count(*) from sessions where status = 'completed' and tutor_kind = 'ai' and ended_at >= v_today),
      'live_now', (select count(*) from sessions where status = 'live')
    ),
    'economy', (
      select jsonb_build_object(
        'circulation', coalesce(sum(amount) filter (where to_profile is not null), 0)
                       - coalesce(sum(amount) filter (where from_profile is not null), 0),
        'minted', coalesce(sum(amount) filter (where kind = 'mint'), 0),
        'granted', coalesce(sum(amount) filter (where kind = 'grant'), 0),
        'adjusted', coalesce(sum(amount) filter (where kind = 'adjust'), 0),
        'spent_sessions', coalesce(sum(amount) filter (where kind = 'session_payment'), 0),
        'spent_ai', coalesce(sum(amount) filter (where kind = 'ai_session'), 0),
        'spent_shop', coalesce(sum(amount) filter (where kind = 'skin_purchase'), 0),
        'zero_balance_users', (select count(*) from balances where quipus <= 0),
        'top_earners', coalesce((
          select jsonb_agg(e) from (
            select l.to_profile as profile_id, p.display_name, sum(l.amount) as earned
            from quipus_ledger l join profiles p on p.id = l.to_profile
            where l.kind = 'session_payment'
            group by l.to_profile, p.display_name
            order by earned desc limit 5
          ) e
        ), '[]'::jsonb)
      ) from quipus_ledger
    ),
    'top_topics', coalesce((
      select jsonb_agg(t) from (
        select tp.id as topic_id, tp.name, count(*) as requests
        from requests r join topics tp on tp.id = r.topic_id
        group by tp.id, tp.name order by count(*) desc, tp.name limit 10
      ) t
    ), '[]'::jsonb),
    'demand_gaps', coalesce((
      select jsonb_agg(g) from (
        select tp.id as topic_id, tp.name, count(*) as open_requests
        from requests r join topics tp on tp.id = r.topic_id
        where r.status = 'open'
          and not exists (select 1 from tutor_topics tt where tt.topic_id = tp.id)
        group by tp.id, tp.name order by count(*) desc, tp.name limit 10
      ) g
    ), '[]'::jsonb),
    'tutor_ranking', coalesce((
      select jsonb_agg(r) from (
        select rv.tutor_id, p.display_name, round(avg(rv.stars), 2) as avg_stars, count(*) as reviews,
          (select count(*) from sessions s where s.tutor_id = rv.tutor_id and s.status = 'completed') as sessions
        from reviews rv join profiles p on p.id = rv.tutor_id
        where rv.tutor_id is not null
        group by rv.tutor_id, p.display_name
        order by avg(rv.stars) desc, count(*) desc limit 10
      ) r
    ), '[]'::jsonb),
    'short_classes', jsonb_build_object(
      'count', (select count(*) from sessions where status = 'completed' and ended_at - started_at < interval '5 minutes'),
      'items', coalesce((
        select jsonb_agg(s) from (
          select se.id as session_id, tp.name as topic, se.tutor_kind,
            round(extract(epoch from (se.ended_at - se.started_at)) / 60, 1) as minutes, se.ended_at
          from sessions se left join topics tp on tp.id = se.topic_id
          where se.status = 'completed' and se.ended_at - se.started_at < interval '5 minutes'
          order by se.ended_at desc limit 10
        ) s
      ), '[]'::jsonb)
    ),
    'low_reviews', coalesce((
      select jsonb_agg(q) from (
        select rv.id, rv.stars, rv.feedback_private as feedback, rv.created_at,
          coalesce(tu.display_name, ai.name) as tutor_name, (rv.ai_tutor_id is not null) as is_ai,
          tp.name as topic
        from reviews rv
        left join profiles tu on tu.id = rv.tutor_id
        left join ai_tutors ai on ai.id = rv.ai_tutor_id
        left join sessions se on se.id = rv.session_id
        left join topics tp on tp.id = se.topic_id
        where rv.stars <= 2
        order by rv.created_at desc limit 10
      ) q
    ), '[]'::jsonb)
  ) into v_out;
  return v_out;
end $$;

-- ============================================================
-- 10.8 SEGURIDAD: solo vía API (service role)
-- ============================================================

alter table admins enable row level security;
alter table admin_audit enable row level security;
alter table ai_guides enable row level security;
alter table ai_promotions enable row level security;
alter table announcements enable row level security;
alter table chat_reports enable row level security;
-- Sin políticas: invisibles para anon/authenticated.
revoke all on admins, admin_audit, ai_guides, ai_promotions, announcements, chat_reports from anon, authenticated;

-- Suspensión (con motivo) es privada: la clave pública solo lee las columnas de siempre.
revoke select on profiles from anon, authenticated;
grant select (id, username, display_name, grade, school, avatar_config, created_at) on profiles to anon, authenticated;

revoke execute on function admin_metrics() from public, anon, authenticated;
grant execute on function admin_metrics() to service_role;
revoke execute on function admin_merge_topics(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function admin_merge_topics(uuid, uuid, uuid) to service_role;
revoke execute on function admin_cancel_session(uuid, uuid) from public, anon, authenticated;
grant execute on function admin_cancel_session(uuid, uuid) to service_role;

revoke execute on function
  ai_price_for(uuid, uuid), admin_grant(uuid, text, text, bigint, text),
  book_ai(uuid, uuid, uuid), end_session(uuid), buy_skin(uuid, uuid)
from public, anon, authenticated;

grant execute on function
  ai_price_for(uuid, uuid), admin_grant(uuid, text, text, bigint, text),
  book_ai(uuid, uuid, uuid), end_session(uuid), buy_skin(uuid, uuid)
to service_role;

-- ============================================================
-- 10.9 ADMINISTRADOR DEMO
-- ============================================================
-- valentina5 (DNI 70000001, contraseña de prueba aula2026).

insert into admins (profile_id)
select p.id from profiles p where p.id = '10000000-0000-0000-0000-000000000001'
on conflict (profile_id) do nothing;

-- ============================================================
-- 11. BANCO DE IMÁGENES POR TEMA (migración 004)
-- ============================================================
-- Imágenes educativas (URLs https) que el administrador asocia a un tema; el tutor IA las
-- muestra con la herramienta showImage. Solo vía API / agente (service role).

create table if not exists topic_images (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references topics(id) on delete cascade,
  url text not null check (url ~ '^https://'),
  caption text not null default '' check (char_length(caption) <= 140),
  credit text not null default '' check (char_length(credit) <= 200),
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists ix_topic_images_topic on topic_images (topic_id, created_at);

alter table topic_images enable row level security;
revoke all on topic_images from anon, authenticated;
grant select, insert, update, delete on topic_images to service_role;
