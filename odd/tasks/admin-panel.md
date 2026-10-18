# Feature: Admin panel

**Branch:** `feat/admin-panel` (local only, no push until the user asks), from `origin/main` ee93bc0.
**Objective:** A protected `/admin` area for platform operators: traction and economy metrics, credit grants, AI pricing and promotions, AI teaching guides ("rúbricas") per topic, content management, moderation and announcements.

**Why:** Hackathon rubric bonus for traction "visible from the product"; operators need to steer the quipu economy and AI quality without SQL.
**Viability of AI guides (verified):** the web dispatches the agent with JSON metadata (`apps/web-app/lib/server/livekit.ts:45`), parsed by the agent (`backend/agents/aulaquipu-tutor/src/main.ts:19-39`), so a per-topic guide can travel in that metadata and be injected into the agent instructions.

## Current gaps (evidence)
- No admin role anywhere in schema.
- Ledger kinds limited to `mint, session_payment, ai_session, skin_purchase, refund` (`backend/database.sql:131`).
- AI price lives in `ai_tutors.price_quipus`; sessions snapshot `price_quipus`, so price changes don't affect booked sessions.

## Scope (12 items)
1. Credits: grant/adjust to one student, a grade, a school or everyone, with reason; ledger kinds `grant` and `adjust`.
2. AI prices: edit per AI tutor; promotions (percentage off, time window, optional "first AI class free").
3. AI teaching guides per topic: objectives, steps, common mistakes, checks; passed to the agent and used in its instructions.
4. Traction dashboard: registered users, active today, classes (human/AI), quipus in circulation, top topics.
5. Demand without supply: topics with open requests and no human tutor.
6. Economy health: quipus in (mint/grant) vs out (classes/AI/shop), zero-balance users, top earners.
7. Quality: tutor ranking by stars, classes ended < 5 min, low-star reviews (admin can read private feedback).
8. Topics: rename, merge duplicates, flag/hide.
9. AI tutors: create/edit/pause (name, persona, voice/style, topics, price).
10. Shop: create skins, change prices.
11. Moderation: suspend users (blocks login/API), chat reports inbox, close stuck live sessions with refund.
12. Announcements: banner shown in the campus.

## Constraints
- Admin access enforced server-side on every `/api/admin/*` route (never UI-only); admins table + seeded demo admin; mock mode supports everything.
- Every admin mutation writes an audit row (who, what, when, payload).
- New SQL in `backend/migrations/003_admin.sql` (idempotent), mirrored in `backend/database.sql`; owner applies it in Supabase. Must not depend on 002.
- Keep existing flows and test accounts working. Spanish UI copy, neutral tuteo. Next.js 16 docs in `node_modules/next/dist/docs/`.
- Delivery: strategy `ask-on-risk`; forecast well above 400 lines; chain/PR question deferred because the user pushes directly to main.

## TDD
- Mode: off. Source: no project/session configuration; no test runner.
- Checks: `npx tsc --noEmit`, `npx eslint <changed files>`, agent `tsc --noEmit` (Node 24), routes 200, `/api/admin/*` returns 401/403 for non-admins, browser smoke test.

## Tasks
- [x] T1 — Foundation: migration 003 (admins, audit, ledger kinds, guides, promotions, announcements, suspension, chat reports), server admin guard, `/admin` shell + nav, mock support, demo admin.
- [x] T2 — Metrics: traction, demand gaps, economy, quality (4–7).
- [x] T3 — Credits and AI pricing/promotions (1–2), applied in booking.
- [x] T4 — AI teaching guides (3): CRUD + agent metadata + agent instructions.
- [x] T5 — Management: topics, AI tutors, shop (8–10).
- [ ] T6 — Moderation and announcements (11–12).
- [ ] T7 — Browser smoke test (orchestrator).

## Acceptance criteria
- Non-admins get 403 on every admin API; admin sees `/admin`.
- Grants change balances through the ledger; promotions change the AI booking price.
- An AI class on a topic with a guide uses it (visible in agent instructions/log).
- Every admin action appears in the audit log.

## Progress
- T1 done (01f6f12 `feat(admin): add admin schema, server guard and admin shell`). `backend/migrations/003_admin.sql` (mirrored in `database.sql` §9, demo admin `valentina5` also in `demo_seed.sql`) **must be applied in Supabase**; until then admins/suspension checks degrade to "nobody is admin / nobody suspended" and `admin/*` DB calls answer 503. Server: `lib/server/admin.ts` (`isAdmin`, `requireAdmin`, `requireNotSuspended`, `audit`, 15 s caches, optional `ADMIN_PROFILE_IDS`), route flag `a()` in `app/api/[...path]/route.ts`, `GET admin/me` (session only). UI: `/admin` shell (`components/admin/admin-shell.tsx`, tabs/sidebar), Auditoría page, "Admin" entry in the avatar menu (`Me.is_admin`), mock admin (`lib/api/mock-admin.ts`, admin = `usr-valeria`). Observed: `tsc --noEmit` clean, eslint clean, `/admin` `/admin/auditoria` `/` `/campus` `/tutores-ia` 200, `/api/admin/audit` no cookie 401, logged in as valentina5 (not admin on the unmigrated DB) `admin/me` {isAdmin:false}, `admin/audit` 403 "Solo administradores.", `ledger/mine` still 200.
- T2 done (b7798ee `feat(admin): add traction, economy, demand and quality dashboards`). SQL `admin_metrics()` (003) returns all aggregates as jsonb in one call; `GET admin/metrics`; UI Resumen (tracción en vivo, auto-refresh 30 s, demanda sin oferta, ranking, clases cortas, reseñas bajas con feedback privado) and Economía (entra vs sale, top earners, saldo cero); mock computes the same shape. Observed: `tsc --noEmit` clean, eslint clean, `/admin` `/admin/economia` `/` `/campus` `/tutores-ia` 200, `/api/admin/metrics` no cookie 401, as non-admin 403. SQL verified in PGlite (database.sql + demo_seed.sql + 003 run twice; `admin_metrics()` returned expected totals on the demo data).
- T3 done (`feat(admin): grant credits and manage AI prices and promotions`). SQL (003): `admin_grant()` (atomic per call, per-wallet locks, adjust skips balances that would go negative, writes its own audit row), `ai_price_for()` + `book_ai()` apply the best live promotion (max(1, round(price*(100-pct)/100))) or price 0 for "primera clase gratis" (student with no non-cancelled AI session, counted on `sessions` because a free class leaves no ledger row); `sessions.price_quipus` check relaxed to `>= 0` and `end_session()` skips the 0-quipu ledger row. API: `POST admin/credits`, `GET admin/credits/{preview,options}`, `GET admin/users`, `GET admin/ai-tutors`, `GET|PUT admin/ai-tutors/:id/price`, `GET|POST admin/promotions`, `PUT|DELETE admin/promotions/:id`; `ai-tutors` and `match` now return `effective_price` + `promo`. UI: Créditos, Precios IA, "Promo" badge and effective price in AiTutorCard/campus caption; mock applies the same rules. Observed: `tsc --noEmit` clean, eslint clean, `/admin/creditos` `/admin/precios-ia` `/` `/campus` `/tutores-ia` 200, admin routes no cookie 401 / non-admin 403, `ai-tutors` and `ledger/mine` still 200 on the unmigrated DB. PGlite: grant/adjust per scope, skipped on insufficient balance, validation errors, audit rows, promo prices (30 -> 23, 97% -> 1), free first class (session price 0, no ledger row, completes, second class not free). Mutations were not called against the real server (migration not applied). Pending: browser smoke test (T7), T3 UI not exercised in a browser.
- T4 done (`feat(admin): per-topic teaching guides for AI tutors`). No SQL change (`ai_guides` is in 003). API `GET admin/guides`, `GET|PUT|DELETE admin/guides/:topicId` (each field <= 1500 chars, audit `guide.save|delete`); UI Guías IA (topic list with guide badge, 4-field editor, import .md/.txt via FileReader split by headings, otherwise into "Pasos"); mock `ai_guides` (SEED_VERSION 6). Wiring: `roomToken` adds `guide` (<= 4000 chars, via `agentGuideFor` in `lib/server/admin.ts`, any DB failure = no guide) to the agent dispatch metadata; the agent parses it in `classContextFrom`, injects a "Guía del tema definida por la plataforma" section in the voice instructions and the delegated-model instructions, logs one line per session (`[tutor] sesión <id>: guía del tema aplicada (N caracteres)|no definida`) and adds `guide: bool` to the `join` session_event. **The running agent worker (`node src/main.ts`) must be restarted to pick up the new code.** Observed: web `tsc --noEmit` clean, eslint clean, agent `tsc --noEmit` clean (Node 24), `/admin/guias-ia` `/admin` `/admin/auditoria` `/campus` `/tutores-ia` 200, `admin/guides` (GET, GET :id, PUT :id) without cookie 401. Not exercised: real mutations (migration not applied) and a live agent session. The simulated mock tutor does not mention the guide (not trivial).
- T5 done (`feat(admin): manage topics, AI tutors and shop items`). SQL (003, mirrored in `database.sql` §9): `skins.active`, `admin_merge_topics(admin, src, dst)` (atomic: moves requests/groups/sessions, dedupes tutor_topics and ai_tutor_topics, moves the guide if dst has none, deletes src, writes its own audit row), `book_ai` rejects paused tutors (`tutor_pausado`), `buy_skin` rejects hidden skins (owners keep them). **`database.sql` §9 had been appended in full by each of T1-T3 (3 copies); it is now a single copy regenerated from 003.** API: `GET admin/topics`, `PUT admin/topics/:id` (rename / status), `POST admin/topics/merge`, `POST|PUT admin/ai-tutors(/:id)` (persona emoji/color/tagline/style/focus/voice, price, active, topics; merges into the existing persona JSON), `GET|POST|PUT admin/skins(/:id)` (kind fixed after creation; meta validated per kind with the keys `components/avatar.tsx` draws). Shared validation in `lib/admin-validate.ts` (server + mock). Hidden/paused filtering done in JS so unmigrated DBs keep working: `ai-tutors`/`match` skip paused tutors, shop skips hidden skins unless owned, `searchTopics` already hides flagged topics (asking for a flagged topic by exact name is refused). UI `/admin/contenido` (tabs Temas / Tutores IA / Tienda with previews). Mock covers all of it (SEED_VERSION 7). Observed: `tsc --noEmit` clean, eslint clean, `/admin/contenido` `/admin` `/campus` `/tutores-ia` `/tienda` `/admin/auditoria` 200, all new admin routes without cookie 401, as non-admin (valentina5 on the unmigrated DB) 403 while `ai-tutors` `skins` `topics` `ledger/mine` stay 200. PGlite (database.sql + demo_seed + 003 twice): merge moves 2 requests / 3 sessions / 1 group, dedupes a tutor present in both topics, moves the guide or keeps the destination's, audit row written, same-topic and missing-topic rejected, paused tutor rejected in `book_ai`, hidden skin rejected in `buy_skin` but idempotent for owners. Not exercised: real mutations (migration not applied) and the UI in a browser.

## Next step
- T4 (apply migration 003 in Supabase before testing admin mutations).
