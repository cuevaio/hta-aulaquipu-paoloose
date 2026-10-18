# Feature: Intuitive onboarding, registration and teaching flow

**Branch:** `feat/ux-onboarding-teach` (local only, no push)
**Objective:** Make the earn/spend loop obvious in the first two minutes, make offering tutoring easy, and add real self-registration, while always keeping the existing test-accounts panel on the login page.

**Problem:** New users land on the campus map with no guidance; teaching is the most hidden flow (8–10 steps, empty state "Vuelve más tarde", settings at the bottom); there is no sign-up, so real users cannot join (traction bonus); terminology is inconsistent.
**Why:** Spec anti-goal: the teach/learn loop must be clear within two minutes. Rubric: "Funciona" 25%, "Claridad" 10%, traction bonus requires real users.

## Scope (proposals 1–10 from UX analysis)
1. First-visit welcome overlay on campus (3 steps: 100 quipus → learn by spending → teach to earn) ending in "Quiero aprender" / "Quiero enseñar".
2. Campus mission hint for users with no activity + visible movement hint on mobile ("toca para caminar").
3. Teach panel as a checklist: ① topics ② price ③ schedule ④ requests, with progress; requests last.
4. Teach empty state becomes actionable: show open learner requests (existing feed) and offer to add those topics.
5. Clear earnings copy (no unexplained "hasta").
6. Consistent naming (one "Tablero", always "pedido"), remove "(demo)" copy, add "Tutores IA" to the bottom bar, add an interactive hotspot in the "Aulas IA" room.
7. "Pedirle una clase" CTA on tutor profile (`tutor/[id]`), prefilling a request for that tutor's topic.
8. Price quick-pick chips (e.g. 10/20/30) and simpler schedule blocks.
9. Demand prompt in teach panel ("N alumnos buscan X. ¿La enseñas?").
10. Real registration: DNI, password, name, grade, school, avatar color/shape; onboarding question "¿Qué se te da bien? / ¿Qué se te complica?" that creates tutor topics and/or a first request. Atomic server-side (profile + credentials + 100-quipu mint). Test-accounts panel stays.

## Constraints
- Keep the test-accounts panel and test login working (both mock and http modes).
- Mock mode (`lib/api/mock.ts`) must support every new API method.
- Registration persistence needs a new SQL migration (`backend/migrations/002_*.sql`) that the owner applies in Supabase; http mode registration fails until applied.
- Spanish UI copy, neutral tuteo. Next.js 16: consult `node_modules/next/dist/docs/` for unfamiliar APIs.
- Delivery: strategy `ask-on-risk`; branch is local-only. Chain/PR strategy question deferred until the user asks for a PR/push (forecast > 400 lines).

## TDD
- Mode: off. Source: no project/session configuration; web-app has no test runner.
- Checks: `npx tsc --noEmit`, `npx eslint <changed files>`, affected routes return 200 on the dev server.

## Tasks
- [x] T1 — Naming/navigation: consistent terms, remove "(demo)", "Tutores IA" in bar, Aulas IA hotspot (6).
- [x] T2 — Campus welcome overlay + mission hint + mobile movement hint (1, 2).
- [x] T3 — Teach panel: checklist order + progress, actionable empty state with demand + add-topic, earnings copy, price chips, schedule blocks (3, 4, 5, 8, 9).
- [x] T4 — Tutor profile "Pedirle una clase" CTA with prefilled request (7).
- [ ] T5 — Self-registration: migration + RPC, API route, mock, sign-up UI with onboarding questions; keep test panel (10).

## Acceptance criteria
- A new user sees the welcome on first campus visit and can reach learn/teach in one tap.
- Teach panel shows a checklist; a tutor with no requests sees actionable demand.
- Tutor profile has a working CTA leading to a request.
- Registration works in mock mode end-to-end and the SQL migration is ready for Supabase; test accounts still work.
- Typecheck and lint clean on changed files; affected routes 200.

## Progress
- T1 done: tsc clean, eslint clean, /campus /ensenar /aprender /tutores-ia /home 200. Bar now 7 items (compact on mobile), Aulas IA board -> /tutores-ia, 'Tablero' = /home, '(demo)' removed.
- T2 done: tsc clean, eslint clean (components/campus), /campus /ensenar /aprender /home 200. Welcome overlay + '?' button, mission card (myRequests+tutorPanel+myUpcoming all empty), mobile movement hint; flags in localStorage per user via useSyncExternalStore. UI not browser-verified.
- T3 done (commit follows T2 182461c): tsc clean, eslint clean, /ensenar 200. Earnings semantics verified in backend/migrations/001_web_app.sql (accept_request: group total_price = tutor price; members pay floor(price/n); end_session pays tutor the sum of shares). Price step counted 'listo' when settings were saved (has schedule) or price != 20 (no explicit saved flag exists). UI not browser-verified.
- T4 done (after T3 18a5be1): tsc clean, eslint clean, /tutor/x /aprender?tema&tutor /campus /ensenar /tutores-ia /home 200. CTA per topic -> /aprender?tema&tutor -> /match/<id>?tutor= (tutor sorted first, 'Tu elección', card pre-armed). Not browser-verified.

## Next step
- T5 (registration), done by someone else.
