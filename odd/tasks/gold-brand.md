# Feature: Gold brand across the app

**Branch:** `feat/gold-brand` (local, push to main when the user asks), from `origin/main` f422034.
**Objective:** Remove the turquoise/mint brand accent from the whole project and use the gold accent introduced in /info and /presentacion; refresh the login page (logo, headline, illustration with the new sprite avatars).

**Why:** User request: "la parte turquesa sale del proyecto", update the login styles with the new avatars and logo.
**Evidence:** 38 files reference `mint`/`#2FD3A3`; most usages go through the `--mint` token (`app/globals.css:44,80`).

## Scope
- T1 Brand token: redefine `--mint` (and any mint foreground/ring tokens) to the gold accent with AA contrast on both dark (navy) and light surfaces; replace hard-coded brand turquoise (`#2FD3A3`, teal oklch values) in UI chrome. Keep user-content colors (skin colors like "Verde menta", graph/curve colors, avatar palettes, Desmos colors) unchanged.
- T2 Login page (`app/page.tsx`): gold logo, gold/cream headline highlights (no turquoise), badge restyled, hero illustration rebuilt with the new sprite avatars (`components/sprite-avatar.tsx` / `sprite-figure.tsx`) instead of the old blob avatars; keep the test-accounts panel and footer links working.
- T3 Logo component: gold variant becomes the default everywhere.

## Constraints
- Don't break readability: check contrast for text on gold buttons and gold text on light backgrounds.
- Next.js 16; Spanish copy unchanged unless needed.

## TDD
- Mode: off. Checks: `npx tsc --noEmit`, `npx eslint <changed files>`, `next build`, routes 200, Tailwind CLI compile contains the new tokens, browser review (restart dev server if CSS is stale).

## Tasks
- [x] T1 — Brand token + hard-coded turquoise.
- [ ] T2 — Login page refresh with sprite avatars.
- [ ] T3 — Logo default gold.
- [ ] T4 — Review (orchestrator).

## Progress
- T1 done. Tokens: `--mint` #D9B25F (== aurum), `--mint-deep` #8A6A1F (bars/rings on light), `--accent`/`--sidebar-primary`/`--chart-2` = gold, `--accent-foreground` #3A2A05 (text on gold and dark-amber text on light tints), new `--success` #4CAF73 for semantic status. Contrast: accent-fg on gold 6.93, on white 13.9; gold on navy #1E1B3A 8.23, on #2B2550 7.07; mint-deep on white 5.05. Gold text on light surfaces: none left (checkmark/correct/mic/online dots moved to success green; admin bars/ring use mint-deep). Hero glows: gold + violet; speak-pulse gold; button/counter depth shadows use mint-deep.
  Checks: tsc OK, eslint OK on changed files, Tailwind CLI out has --mint:#d9b25f, --mint-deep, .bg-success, no 170-hue oklch left.
  Kept turquoise (#2FD3A3) as content: lib/skins.ts palette `andes` + andino/arcoiris frames; lib/api/seed.ts (Diego color, Killa tutor, "Verde menta" skin); avatar.tsx legacy blob accessories + `selva` deco gradient; ai-tutor-avatar.tsx illustration; whiteboard pen palette; ai-scripts Desmos/graph curves; campus world.tsx tutors-room floor tint and lib/subjects.ts "Ciencias" tone (#cdf3e5, category color coding).
  Green now (semantic success only): online dots (campus HUD, peers, chat toggle, admin live), quiz "¡Correcto!", mic-on, booked-class check.
