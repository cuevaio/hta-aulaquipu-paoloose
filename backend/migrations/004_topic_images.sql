-- AulaQuipu — migración 004: banco de imágenes por tema
-- Fecha: 2026-10-18
--
-- Se aplica sobre una base con database.sql (o hasta 003_admin.sql). Es idempotente.
-- Ya está incluida en database.sql (sección 11), así que en una base nueva NO hace falta
-- correrla aparte.
--
-- Cambios:
--   1. topic_images: imágenes educativas que el administrador carga por tema (solo URLs https).
--      El tutor IA las usa primero (herramienta showImage) y, si el tema no tiene,
--      busca en Wikimedia Commons.
--   2. Seguridad: solo vía API / agente (service role).

begin;

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

commit;
