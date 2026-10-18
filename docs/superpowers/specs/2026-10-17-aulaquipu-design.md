# AulaQuipu — Documento de diseño

**Fecha:** 2026-10-17
**Contexto:** Hack the Andes, Lima, 17–18 de octubre de 2026 (30 horas). Entrega domingo 18, 09:00.
**Estado:** definición de producto cerrada; lista para plan de implementación.

Convención de este documento:
- **[TUYO]** = decisión explícita del dueño del producto.
- **[MÍO]** = mi decisión de diseño; se puede rechazar sin rehacer el producto.
- **[ABIERTO]** = ambigüedad real que solo el dueño puede resolver; está listada al final.

---

## 1. Problema e intención

### 1.1 El problema (evidencia real)

En un salón peruano un solo profesor no llega a 30 alumnos. Cuatro consecuencias:

1. **La mayoría no aprende.** Solo el 11,3% de alumnos de 5º de secundaria alcanza nivel satisfactorio en lectura y el 12,8% en matemática (ENLA 2025). Una clase igual para todos no sirve a quien va atrasado.
2. **Los que saben se aburren.** El alumno adelantado no tiene reto ni reconocimiento, y lo que sabe no ayuda a nadie.
3. **El que va atrasado no tiene a quién recurrir.** El tutor privado es caro; en casa muchas veces nadie puede ayudarlo.
4. **Nadie aprende a manejar dinero en la práctica.** Perú está por debajo del promedio OCDE en competencia financiera (PISA 2022), mientras los adolescentes quedan expuestos a apps de apuestas (949 millones de accesos en 2025) y la ludopatía crece.

### 1.2 La intención

Un mercado donde los estudiantes se enseñan entre sí y se pagan con su propia tarjeta de dinero simulado: **el que sabe enseña y gana, el que aprende paga y mejora, y todos aprenden a manejar dinero sin arriesgar dinero real.** La moneda se llama **quipus**. La app se llama **AulaQuipu**.

La doble motivación diaria es el motor: volver para **ganar** (enseñando) o para **aprender** (gastando).

---

## 2. Metas, no-metas y anti-metas

### 2.1 Metas del POC

- Un alumno de secundaria publica lo que quiere aprender y termina una sesión de tutoría en vivo — con un tutor humano o con un tutor de IA — dentro de la plataforma.
- El tutor (humano o IA) da la clase en un aula virtual didáctica con herramientas en vivo (graficador, documento compartido, pizarra).
- Los quipus fluyen: cada sesión paga al tutor y descuenta al alumno; el saldo vive en un ledger auditable.
- La reputación se construye desde cero con estrellas públicas y reviews privadas.
- Los alumnos personalizan avatar y perfil gastando quipus (skins, marcos, insignias).
- El flujo completo corre en vivo desde una URL pública (requisito de la rúbrica).

### 2.2 No-metas (fuera de alcance, decidido)

- **Rentabilidad / monetización. [TUYO]** No se modela cómo entra dinero real. Cada cuenta arranca con 100 quipus y eso basta para el POC.
- **Control parental. [TUYO]** El público es secundaria (menores de edad) y no se construyen controles parentales.
- **Gobernanza del colegio. [TUYO]** El colegio es solo contexto; no hay paneles de profesor ni de directivos, ni integración institucional.
- **Currículo nacional. [TUYO]** Los temas no se alinean al Minedu; los proponen los alumnos, con la única valla de que sean de secundaria.
- **App nativa móvil. [TUYO]** Solo web responsiva con vista tipo celular.
- **Conversión de quipus a dinero real. [MÍO]** El quipu nunca sale del sistema. Quien enseña mucho gana prestigio y visibilidad, no efectivo.
- **Browser embebido del tutor IA. [MÍO]** Fuera del POC; se agrega solo si sobra tiempo (ver §6.4).
- **Chat privado entre alumnos, mensajería asíncrona, red social.** Fuera del alcance.

### 2.3 Anti-metas (fracaso aunque "funcione")

- Que la plataforma parezca o actúe como una app de apuestas o de dinero real. El quipu es dinero de juego: ni depósitos, ni retiros, ni precios en soles.
- Que un alumno pueda usar la app sin que el bucle enseñar/aprender quede claro en los primeros dos minutos.
- Que la tutoría ocurra fuera de la plataforma (Zoom, WhatsApp, Meet). La reputación, el pago y la trazabilidad solo existen si la sesión ocurre aquí.

---

## 4. Restricciones

- **30 horas de hackathon.** Entrega: domingo 18 de octubre, 09:00.
- **Requisitos de la rúbrica (Paso 0):** URL pública desplegada + demo en vivo (slides o video) + repo en GitHub. Si falta uno, no se puntúa. Localhost no cuenta como URL pública.
- **Hosting:** todo auto-hospedado en la máquina del dueño. **[TUYO]** Sin servicios de terceros para la llamada ni el backend; LiveKit corre self-hosted. La URL pública se consigue con un túnel (Cloudflare Tunnel / ngrok) hacia su máquina. **[MÍO]**
- **Única dependencia externa pagada:** servicios de IA (OpenAI Realtime API). **[TUYO]**
- **Stack confirmado:** Node/TypeScript + Supabase. **[TUYO]**
- **Rúbrica — dónde están los puntos:**
  - Complejidad técnica 30% (5 pts = datos reales, modelos o servicios orquestados, arquitectura no trivial; el desempate se gana aquí).
  - Funciona 25% (5 pts = el flujo completo corre en vivo desde la URL pública y aguanta preguntas fuera del guion).
  - Calidad técnica 20% (5 pts = maneja errores, casos borde y credenciales; nada de secretos en el repo).
  - Problema e impacto 15% (5 pts = usuario específico + evidencia; la data ENLA 2025/PISA ya está).
  - Claridad 10% (5 pts = qué, por qué y qué quedó fuera).
  - Bonus tracción hasta +0.5 (usuarios reales durante el hackathon, evidencia visible desde el producto).

---

## 5. Definición de producto

### 5.1 La moneda: quipus

- Moneda virtual interna, sin respaldo en dinero real. **[TUYO]**
- Cada cuenta nueva recibe **100 quipus** mediante una fila `mint` en el ledger. **[TUYO]**
- El saldo nunca se almacena como número editable: se deriva del ledger (ver §7.4).
- Gana quien enseña, gasta quien aprende. **[TUYO]**
- **El precio de cada clase lo fija el tutor**, no la plataforma. **[TUYO]**
- Salidas de gasto (tres, cerradas): **[TUYO]**
  1. **Clases con otros alumnos** (gasto principal).
  2. **Sesiones con tutores de IA** (premium; cuestan más porque son más caras de operar).
  3. **Skins y prestigio:** skins de avatar, marcos de perfil, decoración, insignias.

### 5.2 El bucle central

1. Entras con 100 quipus.
2. Quieres aprender → publicas qué → pagas una sesión → gastas quipus.
3. Quieres ganar → declaras qué sabes enseñar → te contratan → ganas quipus.
4. Vuelves al día siguiente por una de las dos razones: llenar la billetera o vaciarla en aprendizaje.

### 5.3 Actores

- **Alumno / estudiante.** Público único: secundaria (grados 1 a 5), menores de edad. **[TUYO]** Un alumno puede ser alumno y tutor a la vez (los mayores de grados superiores enseñan a los menores).
- **Tutor humano.** Alumno que declara capacidad ("capacidad declarada") para enseñar temas. Puede ser de cualquier colegio; la conexión cruza colegios. **[TUYO]**
- **Tutor de IA.** Agente avanzado que da clases completas (ver §5.6).
- **El colegio y el profesor no son actores del producto.** **[TUYO]**

### 5.4 Mercado: oferta, demanda y matching

**Oferta (capacidad declarada):** el tutor declara qué temas domina y con qué nivel (`basico | intermedio | avanzado`). No hay barrera de entrada: cualquiera puede declarar. La reputación se construye desde cero. **[TUYO]**

**Demanda:** el alumno publica un **pedido** ("necesito fracciones para el viernes"), en texto libre, con modo `grupo` (preferido) o `individual`. Los temas son libres, propuestos por los alumnos, siempre que sean de secundaria. **[TUYO]**

**Matching:** el sistema detecta demanda común — varios chicos atascados en lo mismo — y **arma grupos solo**, repartiendo el precio total entre los miembros. **[TUYO]**
- Regla de reparto: si el tutor fija `total_price_quipus = P` para una sesión grupal con `N` alumnos, cada alumno paga `P / N` (entero, residuo al tutor; ver §11.1). **[TUYO]**
- Tamaño de grupo: 3–5 alumnos. **[MÍO]**
- Normalización de temas: "no entiendo lo de las fracciones" y "sé enseñar fracciones" deben ser el mismo tema. **[MÍO]** El backend normaliza el texto libre a un tema existente o crea uno nuevo (embedding simple o LLM con lista de temas existentes); los tutores eligen de la lista de temas existentes.

**Descubrimiento:** el alumno no navega un listado tipo Netflix. La app **recomienda** un tutor que domine el tema, o el alumno elige directamente un tutor de IA. La decisión es de dos toques. **[TUYO]**
- Recomendación (POC): ordenar tutores del tema por `estrellas_promedio DESC, sesiones_completadas DESC`, y sugerir primero el grupo ya formado si existe.

### 5.5 Aula virtual (la sesión en vivo)

- La clase ocurre **siempre dentro de la plataforma**; cero links externos (no Zoom, no Meet, no WhatsApp). **[TUYO]**
- Estética inspirada en **gather.town, sin avatares móviles**: cada participante es una **tarjeta fija de avatar customizable** (skin, marco, insignias) dispuesta alrededor del espacio didáctico. **[TUYO]**
- Es "tipo Zoom pero más didáctico": video/voz en vivo más herramientas de enseñanza.
- Herramientas del aula:
  - **Video/voz en vivo** (WebRTC) entre participantes humanos; el tutor IA participa con voz.
  - **Graficador tipo Desmos** embebido, manipulable en vivo. **[TUYO]**
  - **Documento vivo** estilo markdown con tablas y esquemas que se escribe en tiempo real. **[TUYO]**
  - **Pizarra compartida** básica (dibujo libre sobre un canvas).
  - **Foto del cuaderno/ejercicio** subida por el alumno, con marcado/anotación encima.
- El pago se **libera al terminar la sesión**. **[MÍO]** (La sesión se marca `completed`; ahí se escriben las filas del ledger.)

### 5.6 Tutores de IA

Inspiración: los "dots" de OpenAI — agentes proactivos con identidad propia, personalizable, que usan herramientas mientras trabajan.

- Son **profesores completos**, no asistentes de emergencia ni chat genérico. **[TUYO]**
- Llevan la clase entera en el aula virtual, con **avatar-persona con nombre, voz y estilo propios**. **[TUYO]**
- Trabajan con **browser embebido + herramientas internas**: graficador tipo Desmos que manejan en vivo, documentos markdown con tablas que escriben mientras hablan. **[TUYO]**
- Se asume **agentes frontera que no se equivocan**: no hay fallback a un humano; si el alumno se atasca, el agente detecta y reexplica por otro camino. **[TUYO]**
- Son **caras y premium**: por eso cuestan muchos quipus. Comparables a un tutor humano de élite, disponibles a cualquier hora. **[TUYO]**
- Cobran en quipus igual que los humanos; el precio lo fija la plataforma para los agentes (ver §5.1 y §11.2).

### 5.7 Reputación

- **Estrellas (1–5), públicas.** Son la señal rápida al elegir tutor. **[TUYO]**
- **Reviews, privadas.** El texto de la review es feedback personal solo para el tutor; no hay muro público de reseñas. **[TUYO]**
- Un alumno califica solo sesiones en las que participó; una review por sesión por alumno.
- Se muestra en el perfil del tutor: `estrellas_promedio` y `sesiones_completadas` (calculados).

### 5.8 Skins y prestigio

- Tercera salida de gasto: **skins de avatar, marcos de perfil, decoración y prestigio puro (insignias)**. **[TUYO]**
- **[MÍO]** Catálogo predefinido sembrado en la base (p. ej. 8–12 skins: 2–3 gratis por defecto, el resto con precio en quipus). Compra idempotente; solo se puede equipar lo propio.
- Las insignias de prestigio (p. ej. "Primer tutor", "10 sesiones enseñadas") se desbloquean por logros, no se compran. **[MÍO]**

---

## 6. Arquitectura técnica

### 6.1 Stack (cerrado)

| Capa | Tecnología | Notas |
|---|---|---|
| Frontend | Next.js (React) + Tailwind CSS | Web responsiva, mobile-first; el POC se ve "tipo celular" en pantallas chicas |
| Aula en vivo | **LiveKit self-hosted** (docker) + LiveKit JS Client SDK | WebRTC en la máquina del dueño; sin servicios de terceros para la llamada |
| Agente de voz IA | **LiveKit Agents (Node, `@livekit/agents`)** + **GPT-Live (speech-to-speech)** | El agente entra a la sala LiveKit como participante; tool-calling a las herramientas del aula. Worker en `backend/agents/aulaquipu-tutor` |
| Graficador | **Desmos API v1.12** (`calculator.js`, API key) | El agente lo maneja con `setExpression`/`removeExpressions` mientras explica |
| Documento vivo | **Tiptap + Yjs (CRDT)** | Escritura colaborativa en tiempo real; sincronización por `y-websocket` (self-hosted) |
| Pizarra / anotaciones | Canvas propio (React + Konva o tldraw) | Dibujo libre y marcado sobre foto del cuaderno |
| Backend | Next.js route handlers (server-side) | Solo mintear tokens LiveKit (patrón de `backend/demo_project`, livekit-meet). No hay API CRUD propia |
| Base de datos | **Supabase** (Postgres + Auth) | Tablas en §7; RLS encendido; Auth con email+password |
| Túnel público | Cloudflare Tunnel (o ngrok) hacia localhost | La URL pública de la rúbrica |
| Agentes de matching/normalización | LLM (OpenAI) vía backend | Normalizar temas libres; formar grupos |

### 6.2 Topología de despliegue

```
Navegador (alumno)
  │ HTTPS (túnel Cloudflare → localhost)
  ├── Next.js (puerto 3000) — frontend + route handler de tokens
  ├── LiveKit Server self-hosted (docker, puertos 7880/7881/UDP 50000-60000)
  ├── y-websocket (puerto 1234)
  └── Worker Node LiveKit Agents (conecta a LiveKit + GPT-Live)
Supabase (nube) ← Postgres + Auth  [único servicio en nube además de OpenAI]
```

**[MÍO]** Supabase va en la nube (es la decisión de stack del dueño); si se exigiera 100% local, Postgres local con las mismas tablas.

### 6.3 Servicios y responsabilidades

- **`web` (Next.js):** todas las pantallas (§10), cliente LiveKit, cliente Yjs, Desmos embebido, estado de sesión.
- **Route handlers de Next.js (`app/api/connection-details`):** mintear tokens LiveKit por sala (patrón exacto de `backend/demo_project`). No hay API CRUD propia: el frontend habla directo con Supabase (tablas + RPCs, §7).
- **`agent-worker` (Node, `backend/agents/aulaquipu-tutor`):** agente de tutor IA. Entra a la sala LiveKit cuando se abre una sesión `ai`; orquesta voz (GPT-Live) + herramientas (Desmos vía mensajes al cliente, escritura en el documento Yjs, eventos en `session_events`).
- **`livekit` (Docker):** SFU de WebRTC.
- **`y-websocket` (Node):** doc de sincronización del documento vivo por sesión.

### 6.4 El browser embebido (recortado)

**[MÍO]** Fuera del POC. Si sobra tiempo: Playwright server-side con streaming de capturas al panel del aula (o Cloudflare Browser Rendering / Browserbase, que implicaría servicio externo). Prioridad inferior a que el flujo completo corra limpio.

---

## 7. Modelo de datos (Supabase / Postgres)

### 7.1 DDL completo

> **Canon:** el DDL oficial está en `backend/database.sql` y ya fue ejecutado contra Supabase (2026-10-17). Incluye además checks de integridad, índices (§7.1b), RLS sin policies (solo el backend con secret key accede) y seeds de `ai_tutors`, `skins`, `topics` y `ai_tutor_topics`. En caso de diferencia con lo de abajo, manda el archivo. Diferencias clave con la primera versión: `profiles.id` ya **no** referencia `auth.users` (usuarios hardcodeados para la demo), y `reviews` acepta tutor humano **o** tutor IA (`tutor_id` / `ai_tutor_id`, exactamente uno).

```sql
create table profiles (
  id uuid primary key default gen_random_uuid(),
  username text unique not null,
  display_name text not null,
  grade smallint not null check (grade between 1 and 5),
  school text,
  avatar_config jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table topics (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  proposed_by uuid references profiles(id),
  status text not null default 'active',
  created_at timestamptz not null default now()
);

create table tutor_topics (
  tutor_id uuid references profiles(id) on delete cascade,
  topic_id uuid references topics(id) on delete cascade,
  level text not null default 'basico',
  primary key (tutor_id, topic_id)
);

create table requests (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references profiles(id),
  topic_id uuid not null references topics(id),
  detail text,
  mode text not null default 'grupo',
  status text not null default 'open',
  created_at timestamptz not null default now()
);

create table ai_tutors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  persona jsonb not null default '{}',
  price_quipus int not null check (price_quipus > 0)
);

create table ai_tutor_topics (
  ai_tutor_id uuid references ai_tutors(id) on delete cascade,
  topic_id uuid references topics(id) on delete cascade,
  primary key (ai_tutor_id, topic_id)
);

create table groups (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references topics(id),
  tutor_id uuid references profiles(id),
  ai_tutor_id uuid references ai_tutors(id),
  total_price_quipus int not null check (total_price_quipus > 0),
  scheduled_at timestamptz,
  status text not null default 'forming',
  created_at timestamptz not null default now(),
  check (tutor_id is not null or ai_tutor_id is not null)
);

create table group_members (
  group_id uuid references groups(id) on delete cascade,
  student_id uuid references profiles(id),
  share_quipus int not null,
  status text not null default 'joined',
  primary key (group_id, student_id)
);

create table sessions (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references groups(id),
  request_id uuid references requests(id),
  tutor_kind text not null check (tutor_kind in ('human','ai')),
  tutor_id uuid references profiles(id),
  ai_tutor_id uuid references ai_tutors(id),
  room_name text not null,
  price_quipus int not null check (price_quipus > 0),
  status text not null default 'live',
  started_at timestamptz not null default now(),
  ended_at timestamptz
);

create table quipus_ledger (
  id bigint generated always as identity primary key,
  session_id uuid references sessions(id),
  from_profile uuid references profiles(id),
  to_profile uuid references profiles(id),
  amount bigint not null check (amount > 0),
  kind text not null check (kind in ('mint','session_payment','ai_session','skin_purchase','refund')),
  created_at timestamptz not null default now()
);

create table reviews (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id),
  reviewer_id uuid not null references profiles(id),
  tutor_id uuid references profiles(id),
  ai_tutor_id uuid references ai_tutors(id),
  stars smallint not null check (stars between 1 and 5),
  check ((tutor_id is null) <> (ai_tutor_id is null)),
  feedback_private text,
  created_at timestamptz not null default now(),
  unique (session_id, reviewer_id)
);

create table skins (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind text not null check (kind in ('avatar','frame','badge','profile_deco')),
  price_quipus int not null check (price_quipus >= 0),
  meta jsonb not null default '{}'
);

create table profile_skins (
  profile_id uuid references profiles(id) on delete cascade,
  skin_id uuid references skins(id) on delete cascade,
  equipped boolean not null default false,
  primary key (profile_id, skin_id)
);

create table session_events (
  id bigint generated always as identity primary key,
  session_id uuid not null references sessions(id),
  actor text not null,
  kind text not null,
  payload jsonb not null default '{}',
  created_at timestamptz not null default now()
);
```

### 7.2 Campos semánticos

- `profiles.grade`: 1..5 (secundaria). `avatar_config`: forma/color del avatar tipo blob, skin equipada, marco.
- `topics.name`: tema normalizado (p. ej. "fracciones"). `status`: `active | flagged`.
- `requests.mode`: `grupo | individual`. `requests.status`: `open | matched | fulfilled | cancelled`.
- `groups.status`: `forming | scheduled | live | completed | cancelled`. `scheduled_at` obligatorio cuando pasa a `scheduled`.
- `sessions.tutor_kind = 'human'` exige `tutor_id`; `'ai'` exige `ai_tutor_id`. `room_name` = `session-{id}` (sala LiveKit).
- `sessions.status`: `live | completed | cancelled`.
- `quipus_ledger.kind`: `mint` (from_profile null → alumno), `session_payment` (alumno → tutor por su parte), `ai_session` (alumno → sistema por sesión IA), `skin_purchase` (alumno → sistema), `refund` (tutor → alumno, por sesión cancelada).
- `session_events.kind`: `join | leave | message | tool_call | doc_update | error | completed`. `actor`: `profile:{id}` o `ai:{ai_tutor_id}`. Sirve como log de la clase y como evidencia demo.

### 7.3 Vistas útiles

```sql
create view balances as
  select p.id as profile_id,
    coalesce(sum(case when l.to_profile = p.id then l.amount end), 0)
    - coalesce(sum(case when l.from_profile = p.id then l.amount end), 0) as quipus
  from profiles p left join quipus_ledger l
    on l.to_profile = p.id or l.from_profile = p.id
  group by p.id;

create view tutor_stats as
  select t.id as tutor_id,
    coalesce(avg(r.stars), 0) as estrellas_promedio,
    count(distinct s.id) filter (where s.status = 'completed') as sesiones_completadas
  from profiles t
  left join sessions s on s.tutor_id = t.id
  left join reviews r on r.tutor_id = t.id
  group by t.id;
```

### 7.4 Invariantes del ledger

1. El saldo es la suma firmada del ledger; nunca se actualiza un campo `balance`.
2. La fila `mint` inicial es idempotente por usuario (una sola por cuenta).
3. `session_payment` solo se escribe al pasar `sessions.status` a `completed`, una vez por participante.
4. Ninguna transacción puede dejar un saldo negativo; la API rechaza la operación (pago, compra) antes de escribir.
5. Toda fila lleva `session_id` cuando proviene de una sesión (trazabilidad para la demo).
6. Secretos (service role key de Supabase, API key de OpenAI, API key de Desmos) solo en variables de entorno; `.env` en `.gitignore`; el repo lleva `.env.example`. (Rúbrica: castigan secretos en el repo.)

---

## 8. Flujos detallados

### 8.1 Onboarding

**[TUYO]** No hay registro ni login para la demo: los usuarios se crean hardcodeados directamente en Supabase. Cada usuario precargado lleva su fila `profiles` + su fila `mint` de 100 quipus (ejemplo comentado en §6 de `backend/database.sql`).

1. El alumno elige su usuario precargado (selector de usuario o query param). **[MÍO]**
2. Home: se ve el saldo, el botón "Quiero aprender" y el botón "Quiero enseñar".

### 8.2 Pedir tutoría (alumno)

1. Alumno toca "Quiero aprender" y escribe en texto libre ("no entiendo lo de las fracciones"), elige modo (`grupo` preferido) y opcionalmente horario.
2. El backend normaliza el texto a un tema (busca en `topics`; si no existe, crea uno con `proposed_by`).
3. Se crea `requests` con `status='open'`.
4. El motor de matching decide (ver §11.3): hay grupo formándose → se une; hay tutor humano recomendado → se ofrece; si no, o si el alumno lo prefiere → se ofrecen los tutores IA que cubren el tema.
5. El alumno confirma en dos toques máximo. **[TUYO]**

### 8.3 Enseñar (tutor humano)

1. Toca "Quiero enseñar" y declara temas desde la lista existentes (+ nivel). Eso crea filas `tutor_topics`.
2. Fija precio total de la sesión grupal en quipus y horarios disponibles.
3. Recibe pedidos matcheados; acepta uno (o un grupo ya formado).
4. Al aceptar: `groups.status='scheduled'` con `scheduled_at`; los miembros ven la confirmación.

### 8.4 Reserva y pago

1. Al confirmar la reserva, se valida saldo suficiente (para individuales) o la cuota `share_quipus` (para grupos).
2. **No se descuenta aún.** El saldo se valida aquí y se liquida al cierre. **[MÍO]** (Simple y evita reembolsos; puede cambiar a retención anticipada si hace falta.)
3. Se crea la `sessions` (`status='live'` al abrir el aula) y se emite el token LiveKit para `room_name = session-{id}`.

### 8.5 Sesión en vivo humana

1. Cada participante entra a la sala LiveKit desde el navegador (video/voz). Aparece su tarjeta de avatar.
2. Herramientas disponibles: documento vivo (Yjs/Tiptap), graficador Desmos, pizarra, subir foto del cuaderno.
3. Eventos relevantes se registran en `session_events`.
4. Cualquiera puede terminar la sesión. Al terminar (`status='completed'`): se escriben las filas `session_payment` (una por alumno, por su cuota; desde el alumno hacia el tutor) y se habilita la review.

### 8.6 Sesión con tutor de IA (el corazón del demo)

1. El alumno elige un tutor IA del tema (o acepta el recomendado). Se crea `sessions` (`tutor_kind='ai'`) y se valida saldo contra `ai_tutors.price_quipus`.
2. Al entrar al aula, el **agent-worker** (Node, `@livekit/agents`) une a un participante `ai:{ai_tutor_id}` a la sala con voz (GPT-Live).
3. El agente:
   - Saluda con su persona (nombre, estilo, voz).
   - Diagnostica el nivel con 2–3 preguntas habladas.
   - Enseña por turnos: explica **hablando** mientras **escribe en el documento vivo** (markdown con tablas/esquemas) y **manipula el graficador Desmos** (`setExpression`) en tiempo real.
   - Usa la pizarra y anota sobre la foto del cuaderno si el alumno la subió.
   - Detecta si el alumno se atasca y reexplica por otro camino (sin fallback humano). **[TUYO]**
   - Al final: resumen escrito en el documento + recomendación de qué practicar.
4. **Herramientas (tool-calling) del agente — contrato mínimo:**
   - `doc_write({ section, markdown })` → aplica operaciones Yjs al documento de la sesión.
   - `doc_append_table({ rows })` → agrega tabla al documento.
   - `graph_set({ id, latex })` / `graph_remove({ id })` → delega al Desmos del cliente vía LiveKit data channel o vía `api` (el cliente web suscrito aplica `calculator.setExpression`).
   - `board_draw({ path })` → trazo en la pizarra.
   - `ask_student({ question })` → pausa la explicación y pide respuesta (voz o texto).
   - `session_event({ kind, payload })` → log.
5. Al terminar: `status='completed'`, fila `ai_session` (alumno → sistema) por `price_quipus`, review opcional (estrellas y feedback privado para mejorar el agente).

### 8.7 Reviews

1. Tras `completed`, cada alumno puede dejar 1–5 estrellas + texto.
2. Estrellas públicas (promedio en perfil); texto privado, visible solo para el tutor (humano o perfil del agente).
3. `unique (session_id, reviewer_id)` impide duplicados.

### 8.8 Tienda de skins

1. El alumno ve el catálogo (`skins`) con precios en quipus.
2. Compra: se valida saldo, se escribe `skin_purchase` y `profile_skins`.
3. Equipa/desequipa (avatar, marco, decoración). Las insignias por logro aparecen automáticamente.

---

## 9. Superficie de servicios (versión final)

No hay API CRUD propia: el frontend habla directo con Supabase (tablas con RLS + RPCs §7) y con un route handler de Next.js.

- `GET /api/connection-details?roomName=&participantName=` — Next.js route handler (server-side): token LiveKit + URL del servidor. Patrón exacto de `backend/demo_project` (livekit-meet).
- Supabase RPC (`supabase.rpc(...)`): `get_balance`, `buy_skin`, `create_session`, `end_session` — todo lo que mueve quipus.
- Tablas directas (Supabase): `profiles`, `topics`, `tutor_topics`, `requests`, `groups`, `group_members`, `reviews`, `profile_skins`, `session_events`, y lecturas de todo lo demás.
- `session_events` también lo escribe el agent-worker (Node) vía REST de Supabase.

---

## 10. Pantallas (web responsiva, estilo celular)

1. **Selector de usuario** — elige entre los usuarios precargados (demo, sin login). **[TUYO]**
2. **Home** — saldo de quipus, dos CTAs ("Quiero aprender" / "Quiero enseñar"), pedidos abiertos del tema, atajos a tutores IA.
3. **Nuevo pedido** — texto libre, modo grupo/individual, horario.
4. **Match / confirmación** — grupo formándose (con cuota por persona), tutores humanos recomendados (estrellas), tutores IA (precio en quipus). Dos toques a la reserva.
5. **Perfil** — avatar con skin/marco/insignias, estrellas promedio, sesiones dadas, botón de reviews privadas recibidas.
6. **Panel de tutor** — mis temas declarados, precio grupal, horarios, pedidos entrantes, aceptar/rechazar.
7. **Aula virtual** — tarjetas de avatar fijas alrededor del área didáctica; video/voz; documento vivo; graficador; pizarra; foto del cuaderno; botón terminar.
8. **Resumen de sesión** — qué se vio, documento final, quipus pagados/ganados, estrellas + review.
9. **Tienda de skins** — catálogo, compra, equipar.
10. **Mis quipus** — historial del ledger en lenguaje claro.

---

## 11. Reglas y algoritmos

### 11.1 Reparto grupal

`share = floor(P / N)`; `residuo = P - share*N` se suma a la primera cuota (alumno administrador del grupo) o se asigna al tutor: **[MÍO]** se asigna al tutor (`share` a cada alumno; el tutor recibe `share*N + residuo`… en la práctica `P` completo). Verificar en implementación que `sum(shares) + residuo = P`.

### 11.2 Precios

- Humanos: libres (**[TUYO]**), piso sugerido 5 quipus.
- IA: fijados por plataforma. **[MÍO]** 30 quipus por sesión (ya sembrado en `database.sql`). En el POC **las sesiones IA son 1:1** (sin grupos con IA): los grupos siempre matchean con tutor humano, y un grupo sin tutor disponible se divide en sesiones individuales con IA.

### 11.3 Motor de matching (POC)

Job periódico (cada 30 s) + al crear un pedido:
1. Agrupar `requests` abiertos por `topic_id` y modo `grupo` con horarios compatibles (±1 h).
2. Si hay ≥2 alumnos compatibles y un tutor humano del tema disponible: crear `groups` (`forming`), repartir cuota, notificar.
3. Recomendación de tutor humano: `tutor_stats` del tema.
4. Fallback: sesión **individual** con tutor IA del tema (el agente IA es 1:1 en el POC).

### 11.4 Concurrencia y idempotencia

- `POST /sessions/:id/end` idempotente (doble click no liquida dos veces): condición `where status='live'`.
- Compra de skins idempotente por `(profile_id, skin_id)`.
- Tokens LiveKit por sesión con expiración corta (10 min).

---

## 12. Casos borde y errores

- **Saldo insuficiente** al reservar o comprar: rechazo con mensaje claro ("enseña para ganar más quipus" + atajo a "Quiero enseñar").
- **Caída de red en plena clase:** reconexión automática de LiveKit; la sesión sigue si el tutor no la terminó; reembolso (`refund`) si se cancela antes de 10 minutos. **[MÍO]**
- **Tutor no se presenta:** cancelación automática a los 10 min; `refund` si hubo pago anticipado; sin estrellas.
- **Alumno se va antes:** el tutor puede terminar la sesión; la cuota se libera igual (la clase se dio).
- **Doble cierre de sesión / doble review:** restricciones únicas + update condicional.
- **Errores de agentes de IA:** el `agent-worker` reintenta la llamada de herramienta; errores a `session_events(kind='error')`; la clase continúa con voz. Si el agente muere, la sesión se marca `cancelled` con `refund`.
- **Secretos:** `.env` + `.env.example`; la rúbrica resta por credenciales en el repo.

---

## 13. Criterios de aceptación del POC (checklist de demo)

- [ ] Registro → 100 quipus visibles en el ledger.
- [ ] Pedido de aprendizaje en texto libre → tema normalizado → match (grupo o tutor).
- [ ] Reserva con reparto grupal de cuotas correcto.
- [ ] Sesión humana en el aula con video/voz + documento vivo + Desmos.
- [ ] Sesión con tutor IA: habla, escribe en el documento y maneja el Desmos en vivo, en español.
- [ ] Cierre de sesión → ledger cuadra (pago humano / cobro IA) → review con estrellas públicas y feedback privado.
- [ ] Tienda: comprar y equipar una skin con quipus.
- [ ] Todo lo anterior desde la URL pública (túnel), sin secretos en GitHub.
- [ ] (Bonus tracción) registro de usuarios reales durante el hackathon visible desde el producto.

---

## 14. Lo que queda a criterio del builder

- Orden exacto de pantallas y copy en español peruano.
- Esquema visual de las tarjetas de avatar (posición fija alrededor del área didáctica).
- Selección entre Fastify y Next.js API routes para `api`.
- Implementación de la pizarra (Konva vs tldraw) y del marcado sobre foto.
- Estrategia de normalización de temas (LLM vs fuzzy match).
- Seeds: ya sembrados en `backend/database.sql` (3 tutores IA, 10 skins, 12 temas); el builder puede ampliarlos.

---

## 15. Preguntas abiertas [ABIERTO] — solo el dueño resuelve

1. **¿Qué pasa cuando un alumno se queda sin quipus?** (La más importante.) ¿Recarga periódica gratis (p. ej. +25 semanales), puede quedar en negativo, o solo puede volver a ganar enseñando? Cascada: con liquidación al cierre de la sesión, un alumno puede gastar su saldo entre la reserva y el cierre y dejar la cuenta en negativo — tu respuesta define si se retienen los quipus al reservar (escrow) o se acepta el negativo.
2. **¿El demo del domingo incluye la sesión humana completa (con otra persona real) o basta con el mercado + la clase IA?** Es la palanca de alcance más grande de las 30 horas: la clase humana en vivo implica UI de presencia múltiple, ensayo con segunda persona y liquidez por participante. Mi recomendación: demo = mercado + clase IA, y el aula humana queda funcional pero sin ensayar en vivo.
