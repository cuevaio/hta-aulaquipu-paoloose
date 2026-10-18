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
- [ ] T2 — Metrics: traction, demand gaps, economy, quality (4–7).
- [ ] T3 — Credits and AI pricing/promotions (1–2), applied in booking.
- [ ] T4 — AI teaching guides (3): CRUD + agent metadata + agent instructions.
- [ ] T5 — Management: topics, AI tutors, shop (8–10).
- [ ] T6 — Moderation and announcements (11–12).
- [ ] T7 — Browser smoke test (orchestrator).

## Acceptance criteria
- Non-admins get 403 on every admin API; admin sees `/admin`.
- Grants change balances through the ledger; promotions change the AI booking price.
- An AI class on a topic with a guide uses it (visible in agent instructions/log).
- Every admin action appears in the audit log.

## Progress
- T1 done (`feat(admin): add admin schema, server guard and admin shell`). `backend/migrations/003_admin.sql` (mirrored in `database.sql` §9, demo admin `valentina5` also in `demo_seed.sql`) **must be applied in Supabase**; until then admins/suspension checks degrade to "nobody is admin / nobody suspended" and `admin/*` DB calls answer 503. Server: `lib/server/admin.ts` (`isAdmin`, `requireAdmin`, `requireNotSuspended`, `audit`, 15 s caches, optional `ADMIN_PROFILE_IDS`), route flag `a()` in `app/api/[...path]/route.ts`, `GET admin/me` (session only). UI: `/admin` shell (`components/admin/admin-shell.tsx`, tabs/sidebar), Auditoría page, "Admin" entry in the avatar menu (`Me.is_admin`), mock admin (`lib/api/mock-admin.ts`, admin = `usr-valeria`). Observed: `tsc --noEmit` clean, eslint clean, `/admin` `/admin/auditoria` `/` `/campus` `/tutores-ia` 200, `/api/admin/audit` no cookie 401, logged in as valentina5 (not admin on the unmigrated DB) `admin/me` {isAdmin:false}, `admin/audit` 403 "Solo administradores.", `ledger/mine` still 200.

## Next step
- T2.
