-- AulaQuipu — schema completo (Postgres / Supabase)
-- Última corrección: 2026-10-17
-- Ejecutar de una sola vez contra la base. Idempotente por sección (drop + create).

-- ============================================================
-- 1. TABLAS
-- ============================================================

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

-- El frontend habla con Supabase directo (publishable key) para todo el CRUD.
-- Las políticas de abajo lo permiten. El ledger de quipus NO admite escritura
-- directa: solo las funciones SECURITY DEFINER (sección 7) lo escriben.

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

-- Lectura: todo el producto (demo sin auth real; producción acotaría por usuario).
do $$
declare t text;
begin
  foreach t in array array['profiles','topics','tutor_topics','requests','ai_tutors',
    'ai_tutor_topics','groups','group_members','sessions','quipus_ledger','reviews',
    'skins','profile_skins','session_events']
  loop
    execute format('create policy p_select_%s on %s for select using (true)', t, t);
  end loop;
end $$;

-- Escritura directa: todo salvo quipus_ledger, skins y sessions (esas por RPC).
do $$
declare t text;
begin
  foreach t in array array['profiles','topics','tutor_topics','requests','groups',
    'group_members','reviews','profile_skins','session_events']
  loop
    execute format('create policy p_write_%1$s on %1$s for all using (true) with check (true)', t);
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
-- El frontend las llama via supabase.rpc(...). SECURITY DEFINER = esquivan RLS
-- de forma controlada y garantizan los invariantes de forma atómica.

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

grant execute on function get_balance(uuid), buy_skin(uuid, uuid),
  create_session(uuid, text, int, uuid, uuid, uuid, uuid), end_session(uuid)
  to anon, authenticated;
