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
--   6. Suspensión de cuentas (profiles.suspended_*) y pausa de tutores IA (ai_tutors.active).
--   7. Funciones: admin_grant (créditos atómicos) y admin_metrics (métricas en una llamada).
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

-- ============================================================
-- 7. FUNCIONES
-- ============================================================
-- (créditos atómicos, precio efectivo de clases IA y métricas del panel)


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


-- ============================================================
-- 9. ADMINISTRADOR DEMO
-- ============================================================
-- valentina5 (DNI 70000001, contraseña de prueba aula2026).

insert into admins (profile_id)
select p.id from profiles p where p.id = '10000000-0000-0000-0000-000000000001'
on conflict (profile_id) do nothing;

commit;
