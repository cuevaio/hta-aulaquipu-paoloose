-- AulaQuipu — migración 005: clases con tutor IA compartidas (lobby con anfitrión)
-- Fecha: 2026-10-18
--
-- Se aplica sobre una base con database.sql + 001…004. Es idempotente: se puede volver a correr.
-- En una base nueva, córrela después de database.sql.
--
-- Cambios:
--   1. groups.host_id: quien abrió el lobby de una clase IA compartida (decide cuándo empieza).
--      groups.detail: el tema tal como lo escribió el anfitrión ("la mitosis paso a paso").
--   2. create_ai_lobby: abre el lobby (grupo 'forming' con tutor IA) con el anfitrión como primer
--      miembro. Unirse usa join_group (ya reparte el precio entre todos, máx. 5).
--   3. leave_ai_lobby: salir del lobby; si sale el anfitrión, el lobby se cancela.
--   4. start_ai_lobby: el anfitrión inicia la clase. Quien ya no tenga saldo para su parte queda
--      fuera y el precio se reparte de nuevo entre los que quedan.
--   5. end_session: en una clase IA de grupo cada miembro paga su parte (antes no se cobraba a nadie).

begin;

alter table groups add column if not exists host_id uuid references profiles(id) on delete set null;
alter table groups add column if not exists detail text;
alter table groups drop constraint if exists groups_detail_check;
alter table groups add constraint groups_detail_check check (detail is null or char_length(detail) <= 280);

-- Reparte el precio total entre los miembros activos (entero, el residuo no se cobra).
create or replace function _ai_group_reshare(p_group_id uuid)
returns int language plpgsql security definer set search_path = public as $$
declare
  v_total int;
  v_n int;
  v_share int;
begin
  select total_price_quipus into v_total from groups where id = p_group_id;
  select count(*) into v_n from group_members where group_id = p_group_id and status = 'joined';
  if v_n = 0 then
    return 0;
  end if;
  v_share := floor(v_total::numeric / v_n);
  update group_members set share_quipus = v_share where group_id = p_group_id and status = 'joined';
  return v_share;
end $$;

create or replace function create_ai_lobby(p_host_id uuid, p_ai_tutor_id uuid, p_topic_id uuid, p_detail text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_price int;
  v_gid uuid;
begin
  perform lock_wallet(p_host_id);
  -- Precio de lista del tutor (sin promociones personales: el precio se reparte entre todos)
  select price_quipus into v_price from ai_tutors where id = p_ai_tutor_id and active;
  if v_price is null then
    raise exception 'tutor_no_disponible';
  end if;
  if not exists (select 1 from topics where id = p_topic_id) then
    raise exception 'tema_no_existe';
  end if;
  -- Un anfitrión no abre dos lobbies a la vez con el mismo tutor: se devuelve el que ya tiene
  select g.id into v_gid from groups g
  where g.host_id = p_host_id and g.ai_tutor_id = p_ai_tutor_id and g.status = 'forming'
  limit 1;
  if v_gid is not null then
    return v_gid;
  end if;
  if available_balance(p_host_id) < v_price then
    raise exception 'saldo_insuficiente';
  end if;
  insert into groups (topic_id, ai_tutor_id, total_price_quipus, scheduled_at, status, host_id, detail)
  values (p_topic_id, p_ai_tutor_id, v_price, now(), 'forming', p_host_id, nullif(left(trim(coalesce(p_detail, '')), 280), ''))
  returning id into v_gid;
  insert into group_members (group_id, student_id, share_quipus) values (v_gid, p_host_id, v_price);
  return v_gid;
end $$;

create or replace function leave_ai_lobby(p_student_id uuid, p_group_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_g groups%rowtype;
begin
  select * into v_g from groups where id = p_group_id for update;
  if not found or v_g.ai_tutor_id is null then
    raise exception 'grupo_no_existe';
  end if;
  if v_g.status <> 'forming' then
    raise exception 'grupo_no_disponible';
  end if;
  if v_g.host_id = p_student_id then
    -- Sin anfitrión no hay clase: se cancela para todos (nadie había pagado nada)
    update group_members set status = 'left' where group_id = p_group_id and status = 'joined';
    update groups set status = 'cancelled' where id = p_group_id;
    return;
  end if;
  update group_members set status = 'left' where group_id = p_group_id and student_id = p_student_id and status = 'joined';
  perform _ai_group_reshare(p_group_id);
end $$;

create or replace function start_ai_lobby(p_host_id uuid, p_group_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_g groups%rowtype;
  v_id uuid;
  r record;
begin
  select * into v_g from groups where id = p_group_id for update;
  if not found or v_g.ai_tutor_id is null then
    raise exception 'grupo_no_existe';
  end if;
  if v_g.host_id is distinct from p_host_id then
    raise exception 'no_eres_anfitrion';
  end if;
  -- Doble clic o dos pestañas: si ya empezó, se devuelve la misma clase
  select id into v_id from sessions where group_id = p_group_id and status = 'live' limit 1;
  if v_id is not null then
    return v_id;
  end if;
  if v_g.status <> 'forming' then
    raise exception 'clase_terminada';
  end if;
  -- Quien ya no alcanza a pagar su parte queda fuera (dos pasadas: la parte sube si alguien sale)
  for i in 1..2 loop
    for r in select student_id from group_members where group_id = p_group_id and status = 'joined' loop
      perform lock_wallet(r.student_id);
      if available_balance(r.student_id) < 0 and r.student_id <> p_host_id then
        update group_members set status = 'left' where group_id = p_group_id and student_id = r.student_id;
      end if;
    end loop;
    perform _ai_group_reshare(p_group_id);
  end loop;
  if available_balance(p_host_id) < 0 then
    raise exception 'saldo_insuficiente';
  end if;
  v_id := gen_random_uuid();
  insert into sessions (id, group_id, tutor_kind, ai_tutor_id, room_name, price_quipus, topic_id)
  values (v_id, p_group_id, 'ai', v_g.ai_tutor_id, 'session-' || v_id, v_g.total_price_quipus, v_g.topic_id);
  update groups set status = 'live' where id = p_group_id;
  return v_id;
end $$;

-- Cierre de sesión: igual que antes, más el cobro por partes de las clases IA de grupo.
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
  if v.tutor_kind = 'ai' and v.group_id is not null then
    -- Clase IA compartida: cada miembro paga su parte a la plataforma
    insert into quipus_ledger (session_id, from_profile, to_profile, amount, kind)
    select v.id, gm.student_id, null, gm.share_quipus, 'ai_session'
    from group_members gm
    where gm.group_id = v.group_id and gm.status = 'joined' and gm.share_quipus > 0;
    select topic_id into v_topic from groups where id = v.group_id;
    update groups set status = 'completed' where id = v.group_id;
    update requests set status = 'fulfilled'
      where status in ('open', 'matched') and topic_id = v_topic
        and student_id in (select student_id from group_members where group_id = v.group_id and status = 'joined');
  elsif v.tutor_kind = 'ai' then
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

-- Escrituras solo vía API (service role), como el resto de funciones
revoke execute on function
  _ai_group_reshare(uuid), create_ai_lobby(uuid, uuid, uuid, text), leave_ai_lobby(uuid, uuid),
  start_ai_lobby(uuid, uuid), end_session(uuid)
from public, anon, authenticated;
grant execute on function
  _ai_group_reshare(uuid), create_ai_lobby(uuid, uuid, uuid, text), leave_ai_lobby(uuid, uuid),
  start_ai_lobby(uuid, uuid), end_session(uuid)
to service_role;

commit;
