-- AulaQuipu — data demo (re-ejecutable: cada insert es idempotente)
-- Historia: un marketplace vivo con tutores, alumnos, grupos, sesiones IA/humanas,
-- quipus en movimiento, reviews y skins.

begin;

-- ============================================================
-- PERFILES (todos inician con 100 quipus vía mint)
-- ============================================================
insert into profiles (id, username, display_name, grade, school, avatar_config) values
  ('10000000-0000-0000-0000-000000000001','valentina5','Valentina Quispe',5,'I.E. José Faustino Sánchez Carrión','{"palette":"sun"}'),
  ('10000000-0000-0000-0000-000000000002','diego5','Diego Ramos',5,'I.E. Santa María','{"palette":"condor"}'),
  ('10000000-0000-0000-0000-000000000003','camila4','Camila Torres',4,'I.E. Nuestra Señora de Guadalupe','{"palette":"andes"}'),
  ('10000000-0000-0000-0000-000000000004','mateo4','Mateo Chávez',4,'I.E. José Faustino Sánchez Carrión','{"palette":"sun"}'),
  ('10000000-0000-0000-0000-000000000005','luciana3','Luciana Fernández',3,'I.E. Santa María','{"palette":"condor"}'),
  ('10000000-0000-0000-0000-000000000006','sebastian2','Sebastián López',2,'I.E. Nuestra Señora de Guadalupe','{"palette":"andes"}'),
  ('10000000-0000-0000-0000-000000000007','ana1','Ana Villanueva',1,'I.E. José Faustino Sánchez Carrión','{"palette":"sun"}'),
  ('10000000-0000-0000-0000-000000000008','joaquin3','Joaquín Medina',3,'I.E. Santa María','{"palette":"condor"}'),
  ('10000000-0000-0000-0000-000000000009','renata4','Renata Salazar',4,'I.E. Santa María','{"palette":"andes"}'),
  ('10000000-0000-0000-0000-000000000010','lucas5','Lucas Paredes',5,'I.E. Nuestra Señora de Guadalupe','{"palette":"sun"}')
on conflict (id) do nothing;

insert into quipus_ledger (to_profile, amount, kind)
select p.id, 100, 'mint' from profiles p
where p.id::text like '10000000-%'
on conflict (to_profile) where kind = 'mint' do nothing;

-- ============================================================
-- TEMAS extra propuestos por alumnos
-- ============================================================
insert into topics (name, proposed_by) values
  ('probabilidad', '10000000-0000-0000-0000-000000000008'),
  ('ensayo argumentativo', '10000000-0000-0000-0000-000000000009'),
  ('derivadas', '10000000-0000-0000-0000-000000000010')
on conflict do nothing;

-- ============================================================
-- CAPACIDAD DECLARADA DE TUTORES
-- ============================================================
insert into tutor_topics (tutor_id, topic_id, level) values
  ('10000000-0000-0000-0000-000000000001', (select id from topics where name='fracciones'), 'avanzado'),
  ('10000000-0000-0000-0000-000000000001', (select id from topics where name='ecuaciones de segundo grado'), 'avanzado'),
  ('10000000-0000-0000-0000-000000000001', (select id from topics where name='proporcionalidad'), 'intermedio'),
  ('10000000-0000-0000-0000-000000000002', (select id from topics where name='cinemática'), 'avanzado'),
  ('10000000-0000-0000-0000-000000000002', (select id from topics where name='ecuaciones de segundo grado'), 'intermedio'),
  ('10000000-0000-0000-0000-000000000003', (select id from topics where name='inglés básico'), 'intermedio'),
  ('10000000-0000-0000-0000-000000000003', (select id from topics where name='gramática'), 'intermedio'),
  ('10000000-0000-0000-0000-000000000004', (select id from topics where name='química orgánica'), 'intermedio'),
  ('10000000-0000-0000-0000-000000000004', (select id from topics where name='biología celular'), 'basico'),
  ('10000000-0000-0000-0000-000000000009', (select id from topics where name='comprensión lectora'), 'avanzado'),
  ('10000000-0000-0000-0000-000000000009', (select id from topics where name='redacción de textos'), 'avanzado'),
  ('10000000-0000-0000-0000-000000000009', (select id from topics where name='ensayo argumentativo'), 'intermedio'),
  ('10000000-0000-0000-0000-000000000010', (select id from topics where name='historia del Perú'), 'avanzado'),
  ('10000000-0000-0000-0000-000000000010', (select id from topics where name='programación básica'), 'basico')
on conflict do nothing;

-- ============================================================
-- PEDIDOS DE APRENDIZAJE
-- ============================================================
insert into requests (id, student_id, topic_id, detail, mode, status) values
  ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000007',(select id from topics where name='redacción de textos'),'No entiendo cómo estructurar mi texto argumentativo','grupo','fulfilled'),
  ('20000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000006',(select id from topics where name='fracciones'),'Me cuesta sumar fracciones con distinto denominador','grupo','fulfilled'),
  ('20000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000005',(select id from topics where name='fracciones'),'Quiero repasar fracciones para el examen del viernes','grupo','fulfilled'),
  ('20000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000008',(select id from topics where name='cinemática'),'No entiendo el MRU y el MRUA','individual','fulfilled'),
  ('20000000-0000-0000-0000-000000000005','10000000-0000-0000-0000-000000000006',(select id from topics where name='ensayo argumentativo'),'Necesito ayuda con el ensayo argumentativo del curso','grupo','matched'),
  ('20000000-0000-0000-0000-000000000006','10000000-0000-0000-0000-000000000007',(select id from topics where name='ensayo argumentativo'),'El ensayo argumentativo me confunde','grupo','matched'),
  ('20000000-0000-0000-0000-000000000007','10000000-0000-0000-0000-000000000010',(select id from topics where name='inglés básico'),'Quiero mejorar mi inglés para la pre','individual','fulfilled'),
  ('20000000-0000-0000-0000-000000000008','10000000-0000-0000-0000-000000000004',(select id from topics where name='redacción de textos'),'Quiero mejorar la conclusión de mis textos','individual','fulfilled'),
  ('20000000-0000-0000-0000-000000000009','10000000-0000-0000-0000-000000000005',(select id from topics where name='probabilidad'),'Quiero aprender probabilidad desde cero','grupo','open'),
  ('20000000-0000-0000-0000-000000000010','10000000-0000-0000-0000-000000000008',(select id from topics where name='derivadas'),'Me trabo con derivadas','individual','open')
on conflict (id) do nothing;

-- ============================================================
-- GRUPOS
-- ============================================================
insert into groups (id, topic_id, tutor_id, total_price_quipus, scheduled_at, status) values
  ('30000000-0000-0000-0000-000000000001',(select id from topics where name='fracciones'),'10000000-0000-0000-0000-000000000001',30, now() - interval '2 days','completed'),
  ('30000000-0000-0000-0000-000000000002',(select id from topics where name='ensayo argumentativo'),'10000000-0000-0000-0000-000000000009',24, now() + interval '1 day','forming')
on conflict (id) do nothing;

insert into group_members (group_id, student_id, share_quipus, status) values
  ('30000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000005',15,'joined'),
  ('30000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000006',15,'joined'),
  ('30000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000006',12,'joined'),
  ('30000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000007',12,'joined')
on conflict do nothing;

-- ============================================================
-- SESIONES (room_name sigue el patrón session-<uuid> que espera el agente)
-- ============================================================
insert into sessions (id, group_id, request_id, student_id, tutor_kind, tutor_id, ai_tutor_id, room_name, price_quipus, status, started_at, ended_at) values
  -- clase grupal humana de fracciones (Valentina)
  ('40000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001',null,null,'human','10000000-0000-0000-0000-000000000001',null,'session-40000000-0000-0000-0000-000000000001',30,'completed', now() - interval '2 days', now() - interval '2 days' + interval '55 min'),
  -- clase individual humana de cinemática (Diego → Joaquín)
  ('40000000-0000-0000-0000-000000000002',null,'20000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000008','human','10000000-0000-0000-0000-000000000002',null,'session-40000000-0000-0000-0000-000000000002',20,'completed', now() - interval '1 day', now() - interval '1 day' + interval '40 min'),
  -- sesión IA con Ayni (Ana → comprensión lectora)
  ('40000000-0000-0000-0000-000000000003',null,'20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000007','ai',null,(select id from ai_tutors where name='Ayni'),'session-40000000-0000-0000-0000-000000000003',30,'completed', now() - interval '18 hours', now() - interval '18 hours' + interval '35 min'),
  -- sesión IA con Quipu (Sebastián → fracciones)
  ('40000000-0000-0000-0000-000000000004',null,null,'10000000-0000-0000-0000-000000000006','ai',null,(select id from ai_tutors where name='Quipu'),'session-40000000-0000-0000-0000-000000000004',30,'completed', now() - interval '12 hours', now() - interval '12 hours' + interval '30 min'),
  -- clase individual humana de inglés (Camila → Lucas)
  ('40000000-0000-0000-0000-000000000005',null,'20000000-0000-0000-0000-000000000007','10000000-0000-0000-0000-000000000010','human','10000000-0000-0000-0000-000000000003',null,'session-40000000-0000-0000-0000-000000000005',15,'completed', now() - interval '8 hours', now() - interval '8 hours' + interval '45 min'),
  -- clase individual humana de redacción (Renata → Mateo)
  ('40000000-0000-0000-0000-000000000006',null,'20000000-0000-0000-0000-000000000008','10000000-0000-0000-0000-000000000004','human','10000000-0000-0000-0000-000000000009',null,'session-40000000-0000-0000-0000-000000000006',10,'completed', now() - interval '5 hours', now() - interval '5 hours' + interval '35 min'),
  -- sesión IA en vivo ahora mismo (Luciana → Quipu)
  ('40000000-0000-0000-0000-000000000007',null,null,'10000000-0000-0000-0000-000000000005','ai',null,(select id from ai_tutors where name='Quipu'),'session-40000000-0000-0000-0000-000000000007',30,'live', now() - interval '3 min', null)
on conflict (id) do nothing;

-- ============================================================
-- LEDGER (todo cuadrado con las sesiones y compras)
-- ============================================================
insert into quipus_ledger (session_id, from_profile, to_profile, amount, kind)
select * from (values
  ('40000000-0000-0000-0000-000000000001'::uuid,'10000000-0000-0000-0000-000000000005'::uuid,'10000000-0000-0000-0000-000000000001'::uuid,15::bigint,'session_payment'::text),
  ('40000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000006','10000000-0000-0000-0000-000000000001',15,'session_payment'),
  ('40000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000008','10000000-0000-0000-0000-000000000002',20,'session_payment'),
  ('40000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000007',null,30,'ai_session'),
  ('40000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000006',null,30,'ai_session'),
  ('40000000-0000-0000-0000-000000000005','10000000-0000-0000-0000-000000000010','10000000-0000-0000-0000-000000000003',15,'session_payment'),
  ('40000000-0000-0000-0000-000000000006','10000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000009',10,'session_payment'),
  (null,'10000000-0000-0000-0000-000000000005',null,20,'skin_purchase'),
  (null,'10000000-0000-0000-0000-000000000002',null,25,'skin_purchase'),
  (null,'10000000-0000-0000-0000-000000000003',null,15,'skin_purchase'),
  (null,'10000000-0000-0000-0000-000000000001',null,50,'skin_purchase')
) as v(session_id, from_profile, to_profile, amount, kind)
where not exists (
  select 1 from quipus_ledger l
  where l.session_id is not distinct from v.session_id
    and l.from_profile is not distinct from v.from_profile
    and l.to_profile is not distinct from v.to_profile
    and l.kind = v.kind
    and l.amount = v.amount
    and (v.session_id is not null or l.created_at < now())
);

-- ============================================================
-- REVIEWS (estrellas públicas + feedback privado)
-- ============================================================
insert into reviews (id, session_id, reviewer_id, tutor_id, ai_tutor_id, stars, feedback_private) values
  ('50000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000005','10000000-0000-0000-0000-000000000001',null,5,'Me encantó cómo usó ejemplos de la vida real para explicar el mínimo común. Tal vez podría dejar más tiempo para practicar.'),
  ('50000000-0000-0000-0000-000000000002','40000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000006','10000000-0000-0000-0000-000000000001',null,4,'Buena clase, aunque iba un poco rápido al final. Con los ejemplos del pizarrón me quedó claro.'),
  ('50000000-0000-0000-0000-000000000003','40000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000008','10000000-0000-0000-0000-000000000002',null,5,'Diego dibujó las gráficas de velocidad y por fin entendí el MRUA. Muy claro.'),
  ('50000000-0000-0000-0000-000000000004','40000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000007',null,(select id from ai_tutors where name='Ayni'),5,'Ayni me hizo preguntas fáciles primero y luego las difíciles. El documento con la tabla de ideas me ayudó a organizar mi texto.'),
  ('50000000-0000-0000-0000-000000000005','40000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000006',null,(select id from ai_tutors where name='Quipu'),4,'La explicación con fracciones en el graficador estuvo genial. A veces hablaba mucho de corrido.'),
  ('50000000-0000-0000-0000-000000000006','40000000-0000-0000-0000-000000000005','10000000-0000-0000-0000-000000000010','10000000-0000-0000-0000-000000000003',null,5,'Camila corrigió mi pronunciación sin hacerme sentir mal. Ya me atrevo a hablar en voz alta.'),
  ('50000000-0000-0000-0000-000000000007','40000000-0000-0000-0000-000000000006','10000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000009',null,5,'Renata revisó mi conclusión palabra por palabra. Ahora sé cerrar un texto.')
on conflict (id) do nothing;

-- ============================================================
-- SKINS compradas y equipadas
-- ============================================================
insert into profile_skins (profile_id, skin_id, equipped) values
  ('10000000-0000-0000-0000-000000000005', (select id from skins where name='Avatar Sol'), true),
  ('10000000-0000-0000-0000-000000000002', (select id from skins where name='Marco Dorado'), true),
  ('10000000-0000-0000-0000-000000000003', (select id from skins where name='Decoración Estrellas'), false),
  ('10000000-0000-0000-0000-000000000001', (select id from skins where name='Insignia Primer Tutor'), true)
on conflict do nothing;

-- ============================================================
-- SESSION_EVENTS (evidencia de las clases)
-- ============================================================
insert into session_events (session_id, actor, kind, payload) values
  ('40000000-0000-0000-0000-000000000001','profile:10000000-0000-0000-0000-000000000001','join','{"name":"Valentina"}'),
  ('40000000-0000-0000-0000-000000000001','profile:10000000-0000-0000-0000-000000000005','join','{"name":"Luciana"}'),
  ('40000000-0000-0000-0000-000000000001','profile:10000000-0000-0000-0000-000000000001','tool_call','{"tool":"docWrite","section":"Mínimo común denominador"}'),
  ('40000000-0000-0000-0000-000000000001','profile:10000000-0000-0000-0000-000000000001','completed','{"duration_min":55}'),
  ('40000000-0000-0000-0000-000000000003','ai:aulaquipu-tutor','join','{"name":"Ayni"}'),
  ('40000000-0000-0000-0000-000000000003','ai:aulaquipu-tutor','tool_call','{"tool":"docWrite","section":"Ideas principales"}'),
  ('40000000-0000-0000-0000-000000000003','ai:aulaquipu-tutor','tool_call','{"tool":"docAppendTable","title":"Organizador de texto"}'),
  ('40000000-0000-0000-0000-000000000003','ai:aulaquipu-tutor','completed','{"duration_min":35}'),
  ('40000000-0000-0000-0000-000000000004','ai:aulaquipu-tutor','join','{"name":"Quipu"}'),
  ('40000000-0000-0000-0000-000000000004','ai:aulaquipu-tutor','tool_call','{"tool":"graphSet","id":"f1","latex":"y=1/x"}'),
  ('40000000-0000-0000-0000-000000000004','ai:aulaquipu-tutor','completed','{"duration_min":30}'),
  ('40000000-0000-0000-0000-000000000007','ai:aulaquipu-tutor','join','{"name":"Quipu"}')
on conflict do nothing;

-- ============================================================
-- WEB APP: tema de cada sesión, ajustes de tutor y cuentas de prueba
-- ============================================================
update sessions set topic_id = (select id from topics where name = 'fracciones')
where id in ('40000000-0000-0000-0000-000000000004', '40000000-0000-0000-0000-000000000007')
  and topic_id is null;

update sessions s
set topic_id = coalesce(
  (select g.topic_id from groups g where g.id = s.group_id),
  (select r.topic_id from requests r where r.id = s.request_id),
  (select att.topic_id from ai_tutor_topics att join topics t on t.id = att.topic_id
   where att.ai_tutor_id = s.ai_tutor_id order by t.created_at, t.name limit 1)
)
where s.topic_id is null;

insert into tutor_settings (tutor_id, group_price_quipus, availability) values
  ('10000000-0000-0000-0000-000000000001', 30, '{"Lun 16:00","Mié 16:00","Vie 15:00"}'),
  ('10000000-0000-0000-0000-000000000002', 20, '{"Mar 17:00","Jue 17:00"}'),
  ('10000000-0000-0000-0000-000000000003', 15, '{"Lun 18:00","Sáb 10:00"}'),
  ('10000000-0000-0000-0000-000000000009', 24, '{"Mié 15:00","Vie 16:00"}')
on conflict (tutor_id) do nothing;

insert into tutor_settings (tutor_id)
select distinct tutor_id from tutor_topics
on conflict (tutor_id) do nothing;

-- DNI 700000NN (NN = últimos dígitos del perfil), contraseña de prueba: aula2026
insert into credentials (profile_id, dni, password_hash, is_test)
select p.id, '700000' || right(p.id::text, 2), extensions.crypt('aula2026', extensions.gen_salt('bf', 8)), true
from profiles p
where p.id::text like '10000000-0000-0000-0000-0000000000%'
on conflict (profile_id) do nothing;

commit;
