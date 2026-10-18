# Feature: Campus proximity text chat + navigation cleanup

**Branch:** `feat/campus-chat-cleanup` (local only, no push), from `main` 630a674.
**Objective:** Remove duplicated navigation in the campus and add an opt-in proximity text chat (speech bubbles) between connected users.

**Problem:** Three entry points to `/home`, a 7-item bottom bar that duplicates map hotspots (unreadable at 9px on mobile), `/clases` is an almost empty page duplicating `/home` content, decorative objects look interactive but do nothing. The multiplayer campus has presence but no way to talk.
**Why:** Clarity of the demo and a visible "alive" social feature; analysis found these redundancies (campus-shell.tsx BAR, map.ts boards, clases/page.tsx).

## Scope
- T1 cleanup: single "Tablero" board (Plaza); Biblioteca board repurposed (no third path to /home); `/home` absorbs "Mis clases" (UpcomingClasses section) and `/clases` redirects to it; bottom bar reduced to 4 core items (Tablero, Aprender, Enseñar, Perfil) readable on mobile; give the vault a function or make decorative objects visibly non-interactive.
- T2 proximity chat: data-channel topic `campus:chat`, messages sent only to nearby peers via `destinationIdentities` (same room + distance), shown as bubbles above avatars + small log panel; receiver re-checks distance/room; opt-in (off by default), client-side word filter, per-user mute/block, length limit and rate limit.

## Out of scope
- Proximity audio; per-user rooms; server-side message logging/moderation (follow-up: needs a table and API).

## Constraints
- Minors: chat off by default, only same campus room, filter + block, no links.
- Next.js 16 (read `node_modules/next/dist/docs/` for unfamiliar APIs). Spanish UI copy, neutral tuteo.
- Campus token already has `canPublishData: true` (`lib/server/livekit.ts`).

## TDD
- Mode: off. Source: no project/session configuration; no test runner.
- Checks: `npx tsc --noEmit`, `npx eslint <changed files>`, affected routes 200.

## Tasks
- [x] T1 — Navigation cleanup.
- [x] T2 — Proximity text chat.

## Acceptance criteria
- Only one board leads to /home; bar has 4 readable items; /clases content lives in /home.
- Two users near each other in the same room can exchange bubbles; far or other-room users do not receive them; chat starts disabled; block hides a user's messages.
- Typecheck and lint clean; routes 200.

## Progress
- T1 done: Plaza board is the only /home link; Biblioteca board -> /aprender (now lists "Mis pedidos" via new MyRequests, shared with /home); "Mis clases" is a section (#clases) in /home; /clases redirect()s to /home#clases; bar = 4 items text-xs; vault -> /perfil. Checks: tsc clean, eslint clean, /campus /home /clases /aprender /perfil 200.
- T2 done: topic campus:chat sent via destinationIdentities to peers in same room within 4 tiles (receiver re-checks, +1 tolerance); opt-in toggle (localStorage per user), 140 chars, link/email/phone denial, word mask, rate limit 1.5s/5 per 15s, per-user block; bubbles via DOM refs in world.tsx; ChatPanel in campus-shell. Checks: tsc clean, eslint clean, routes 200. Not browser-tested.

## Next step
- Manual two-browser test, then review/PR.
