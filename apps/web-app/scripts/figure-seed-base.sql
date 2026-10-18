-- Generado por scripts/normalize-figure-assets.mjs — re-ejecutable.
insert into skins (name, kind, price_quipus, meta)
select v.name, v.kind, v.price_quipus, v.meta::jsonb
from (values
  ('Hh Human Body', 'avatar', 15, '{"slot":"hh","item":"hh_human_body","sprite":true}'),
  ('Hh Human Glasses', 'avatar', 25, '{"slot":"fa","item":"hh_human_glasses","sprite":true}'),
  ('Hh Human Hair', 'avatar', 15, '{"slot":"hr","item":"hh_human_hair","sprite":true}'),
  ('Hh Human Hat', 'avatar', 25, '{"slot":"ha","item":"hh_human_hat","sprite":true}'),
  ('Hh Human Head', 'avatar', 15, '{"slot":"hd","item":"hh_human_head","sprite":true}'),
  ('Hh Human Legs', 'avatar', 15, '{"slot":"lg","item":"hh_human_legs","sprite":true}'),
  ('Hh Human Shirt', 'avatar', 15, '{"slot":"ch","item":"hh_human_shirt","sprite":true}'),
  ('Hh Human Shoe', 'avatar', 15, '{"slot":"sh","item":"hh_human_shoe","sprite":true}')
) as v(name, kind, price_quipus, meta)
where not exists (select 1 from skins s where s.name = v.name);
