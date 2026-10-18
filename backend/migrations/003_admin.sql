-- AulaQuipu — migración 003: panel de administración
-- Fecha: 2026-10-18
--
-- Se aplica sobre una base con database.sql (o 001_web_app.sql) + demo_seed.sql.
-- Es idempotente y NO depende de la migración 002. Ya está incluida en database.sql
-- (sección 9), así que en una base nueva NO hace falta correrla aparte.
--
-- Cambios:
--   1. Administradores (admins) y registro de auditoría (admin_audit).
--   2. Ledger: tipos 'grant' y 'adjust', nota y admin que los originó.
--   3. Guías de enseñanza por tema para los tutores IA (ai_guides).
--   4. Promociones de precio de los tutores IA (ai_promotions) aplicadas en book_ai.
--      Clase gratis: sessions.price_quipus admite 0 y end_session no escribe asiento de 0.
--   5. Anuncios (announcements), reportes del chat (chat_reports).
--   6. Suspensión de cuentas (profiles.suspended_*), pausa de tutores IA (ai_tutors.active)
--      y artículos de la tienda ocultos (skins.active).
--   7. Funciones: admin_grant (créditos atómicos), admin_metrics (métricas en una llamada),
--      admin_merge_topics (unir temas duplicados), admin_cancel_session (cerrar una clase
--      atascada sin cobrar) y buy_skin / book_ai que respetan active.
--   8. Seguridad: todo solo vía API (service role). Las columnas de suspensión no se leen
--      con la clave pública.
--   9. Administrador demo: valentina5 (profile 10000000-0000-0000-0000-000000000001).

begin;

-- ============================================================
-- 1. ADMINISTRADORES Y AUDITORÍA
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
-- 2. LEDGER: grant / adjust, nota y admin
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
-- 3. GUÍAS DE ENSEÑANZA IA (una por tema)
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
-- 4. PROMOCIONES DE PRECIO IA
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
-- 5. ANUNCIOS Y REPORTES DEL CHAT
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
-- 6. SUSPENSIÓN Y PAUSA DE TUTORES IA
-- ============================================================

alter table profiles add column if not exists suspended_at timestamptz;
alter table profiles add column if not exists suspended_reason text;
alter table ai_tutors add column if not exists active boolean not null default true;
alter table skins add column if not exists active boolean not null default true;

-- ============================================================
-- 7. FUNCIONES
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
-- 8. SEGURIDAD: solo vía API (service role)
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
-- 9. ADMINISTRADOR DEMO
-- ============================================================
-- valentina5 (DNI 70000001, contraseña de prueba aula2026).

insert into admins (profile_id)
select p.id from profiles p where p.id = '10000000-0000-0000-0000-000000000001'
on conflict (profile_id) do nothing;

commit;
