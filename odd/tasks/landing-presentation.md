# Feature: Project landing + demo presentation

**Branch:** `feat/landing-presentation` (local only, no push until the user asks), from `origin/main` aff4ca1.
**Objective:** A public landing page (`/info`) that explains AulaQuipu, and an in-app slide deck (`/presentacion`) for the live demo, both reachable from the public URL without login.

**Why:** Hackathon rubric step 0 requires public URL + live demo (slides or video) + repo. Points: technical complexity 30%, works 25%, technical quality 20%, problem & impact 15% (specific user + evidence), clarity 10% (what, why, what was left out), traction bonus.

## Sources of truth for content
- `docs/superpowers/specs/2026-10-17-aulaquipu-design.md` (and root copy): problem evidence (ENLA 2025: 11.3% satisfactory reading, 12.8% math in 5º secundaria; PISA 2022 financial literacy below OECD average; 949 million accesses to betting apps in 2025), loop, actors, anti-goals, non-goals.
- What was actually built (verify in code before claiming): campus 2D multiplayer + proximity chat, peer tutoring market (requests, matching, groups, grade rule not merged), quipus ledger, shop/skins, AI tutors with voice (LiveKit + GPT-Live), classroom tools (Documento, Graficador Desmos, Cuaderno, Actividad quizzes), class director (deterministic actions via text model), end-of-class summary, topic images (admin bank + Wikimedia), class memory (AtomicMemory, not yet active), admin panel (metrics, credits, AI prices/promos, AI teaching guides, content, moderation, announcements, audit).
- Do not invent metrics or traction numbers. Traction slide may read live counts from an existing public-safe source only if one exists; otherwise a placeholder the team fills in.

## Scope
- T1 `/info`: public landing (hero with the loop "El que sabe enseña y gana. El que aprende paga y mejora.", problem with evidence + sources, how it works in 3 steps, AI tutor section, campus section, tech section, safety/minors section, what's out of scope, CTA to `/` login). Responsive, matches the app's visual language.
- T2 `/presentacion`: public slide deck (≈10 slides: title, problem, user, solution loop, live demo script, architecture diagram, technical quality/safety, impact, out of scope & next steps, closing). Keyboard (←/→, space, Home/End), click/tap navigation, slide counter, fullscreen toggle, URL hash per slide, print-friendly. Speaker notes optional (toggle with "N").
- Links: login page footer → `/info` and `/presentacion`.

## Constraints
- Public routes must not require session and must not call authenticated APIs. Next.js 16 (read `node_modules/next/dist/docs/`; `cacheComponents` on — prefer static server components).
- Spanish copy, neutral tuteo, clear for a jury. No secrets, no real student data.

## TDD
- Mode: off. Checks: `npx tsc --noEmit`, `npx eslint <changed files>`, routes 200 without cookie, browser review (orchestrator).

## Tasks
- [x] T1 — `/info` landing.
- [ ] T2 — `/presentacion` deck.
- [ ] T3 — Browser review (orchestrator).

## Progress
- T1 done: `app/info/page.tsx` (static server component, metadata/OG), shared copy in `lib/public-content.ts` (stats worded as in the spec; team names and public URL are marked placeholders), login footer links in `app/page.tsx`. Checks: tsc clean, eslint clean, /info 200 and / 200 without cookie. Browser review pending (T3).

## Next step
- T2.
