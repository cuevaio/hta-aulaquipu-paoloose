-- AulaQuipu — migración 002: más skins (colores y diseños de cabeza)
-- Fecha: 2026-10-18
--
-- Idempotente. Ya está incluida en database.sql (sección 9).
--
-- Nueva categoría "head" (diseño de cabeza: gorra, peinado, orejas…) que se equipa a la vez
-- que el color del cuerpo ("avatar"). La API equipa una skin por tipo, así que no cambia nada más.
-- Las skins "avatar" con meta.color pintan el cuerpo; las "head" usan meta.accessory.

begin;

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

commit;
