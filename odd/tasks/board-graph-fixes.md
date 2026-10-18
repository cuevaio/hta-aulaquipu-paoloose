# Feature: Whiteboard and Desmos graph fixes

**Branch:** `fix/board-graph` (local only, no push), from `origin/main` 1cb368f.
**Objective:** Fix confirmed user-visible bugs in the classroom whiteboard/notebook annotation and the Desmos graph tool.

**Problem / evidence (code review):**
- Eraser paints `#ffffff` strokes width 24 (`components/classroom/whiteboard.tsx:76,195`): white blotches over notebook photo; eraser strokes are broadcast.
- Notebook strokes normalized to a centered square (`whiteboard.tsx:35-38`) while the photo is fitted to the canvas rect (`:71`): annotations misalign across aspect ratios.
- `draw` depends on `strokes` and the ResizeObserver effect depends on `draw` (`:88-102`): observer recreated per stroke, canvas resized/cleared → flicker.
- Strokes dropped when `transport` is null (`app/aula/[sessionId]/page.tsx:503,514`).
- Agent graph tool has no color (`backend/agents/aulaquipu-tutor/src/agent.ts:129-140`) and transport drops color (`lib/classroom/livekit-transport.ts:168`).
- Desmos load failure leaves a stuck queue with no retry (`components/classroom/desmos.tsx`).
- Fixed math bounds (`desmos.tsx:67`) hide large curves.
- Possible double-escaped LaTeX (`\\frac`) from the agent prompt.

## Scope
- T1 Whiteboard: real eraser (stroke-removal by proximity, broadcast as removal event), notebook strokes normalized to the image rect, stable ResizeObserver (no per-stroke resize), local apply even without transport.
- T2 Graphs: color through agent tool + transport, retry on Desmos load failure, auto-fit bounds to expressions/points set by tutor, normalize double backslashes in LaTeX.
- T3 Browser validation of both flows in mock/local mode (orchestrator).

## Out of scope
- Live (partial) stroke streaming, late-joiner state sync, broadcasting student Desmos edits.

## TDD
- Mode: off. Source: no project/session configuration; no test runner.
- Checks: `npx tsc --noEmit`, `npx eslint <changed files>`, agent `pnpm typecheck` (Node 24), routes 200, browser validation.

## Tasks
- [x] T1 — Whiteboard fixes.
- [x] T2 — Graph fixes.
- [ ] T3 — Browser validation.

## Acceptance criteria
- Erasing over a notebook photo removes strokes and never paints over the photo.
- A mark on the photo stays on the same spot of the image when the panel size changes.
- No canvas flicker when strokes arrive.
- Agent curves keep their color; Desmos shows a retry when it fails to load; tutor curves are visible without manual zoom.

## Progress
- T1 done: `board_erase` event + `applyBoardEvent` (idempotent by stroke id), proximity eraser with cursor, notebook strokes normalized to image rect, single ResizeObserver with size-change-only resize, local apply without transport, pointercancel, tap dot. Checks: `tsc --noEmit` clean, eslint clean, /aula/x 200. Browser check pending (T3).
- T2 done: `color` in agent graphSet (hex, optional, in prompt) and passed through transport; web-side LaTeX double-backslash cleanup (agent prompt renders single backslash: verified via dedent); Desmos "Reintentar" (re-runs load, flushes queue); tutor points `(a,b)` expand view bounds (never shrink; only for AI ops). Checks: web `tsc` + eslint clean, /aula/x 200, agent `tsc --noEmit` clean (`pnpm typecheck` fails in this env with MODULE_NOT_FOUND, used local tsc). Agent worker needs restart.

## Next step
- T3 browser validation.
