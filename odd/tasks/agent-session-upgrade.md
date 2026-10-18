# Feature: AI tutor session upgrade

**Branch:** `feat/agent-session-upgrade` (local only, no push until the user asks), from `origin/main` 3b226df.
**Objective:** Make the AI class reliable and interactive: tools that really run, quiz cards, avatar reactions, and an end-of-class summary.

**Problem / evidence:**
- Browser test: the tutor said "Listo, te grafico…" but no graph appeared and no tool call was logged. The voice model (GPT-Live) delegates writing/graphing to a second model with tools (`backend/agents/aulaquipu-tutor/src/agent.ts`, "Delega SIEMPRE…"); the claim happens before/without the delegated tool running.
- Web already understands `ask_student`, `focus_tool`; the animated avatar has a `celebrating` state that nothing triggers.

**Known blocker (out of scope):** `src/main.ts` imports `./memory.ts`, which was never pushed (commit 1a9d7ca). A local no-op stub exists only on this machine and is excluded via `.git/info/exclude`; never commit it.

## Scope
- T1 Tool reliability: the tutor never claims an action before the tool result; every successful tool action shows a visible confirmation in the classroom (chat chip "✓ Graficado y = ½x", "✓ Escrito en el documento"); delegation failures are logged and spoken ("no pude graficarlo, lo intento de nuevo"); one retry.
- T2 Quiz cards: agent tool to ask a multiple-choice question (2–4 options, correct index, short explanation); classroom shows a card; the student taps; correct/incorrect feedback; the answer reaches the agent so it reacts; result logged in `session_events`.
- T3 Avatar reactions: agent tool `emote` (celebrate, think, surprised, encourage) driving `AiTutorAvatar`; the avatar also celebrates automatically on a correct quiz answer.
- T7 End-of-class summary: pressing "Terminar" in an AI class asks the agent to write a "Resumen de la clase" section (what we saw, what was hard, 3 practice exercises) in the live doc before the room closes; visible waiting state with a skip option and a timeout; the summary page shows it.
- Local mode (simulated tutor) gets at least one quiz step and a celebration so the demo works without LiveKit.

## Constraints
- Session events kinds are limited (`join, leave, message, tool_call, doc_update, error, completed`): log quiz results as `tool_call` with payload.
- Data channel topics follow the existing `aulaquipu:*` convention; translation lives in `apps/web-app/lib/classroom/livekit-transport.ts`.
- Spanish UI copy, neutral tuteo. Next.js 16 docs in `node_modules/next/dist/docs/`.

## TDD
- Mode: off. Source: no project/session configuration. Agent has `src/agent.test.ts` (vitest) — run it if it works.
- Checks: web `npx tsc --noEmit` + eslint on changed files; agent `node_modules/.bin/tsc --noEmit` (Node 24); routes 200; browser test with the real agent (orchestrator).

## Tasks
- [x] T1 — Tool reliability + confirmations.
- [x] T2 — Quiz cards.
- [x] T3 — Avatar reactions.
- [x] T7 — End-of-class summary.
- [x] T9 — Topic images: agent tool `showImage` inserts an educational image into the live doc. Source order: admin image bank per topic (new table, migration `004_topic_images.sql`, applied only with explicit user approval; graceful fallback if missing), then Wikimedia Commons search done server-side by the agent (only `upload.wikimedia.org` URLs, with credit/license). Web renderer only displays images from allowlisted hosts (doc is student-editable). Admin "Guías IA" page gets an image section per topic (URL or upload).
- [ ] T8 — Browser validation with the real agent (orchestrator). Partial (live class with Inti, "Biología celular"):
  - OK: `showImage` called by the realtime layer → Wikimedia diagram + credit in doc + "✓ Imagen" chip; tutor confirmed only after the tool result.
  - OK: Terminar → "Inti está escribiendo el resumen…" → summary section (Lo que vimos / Lo que te costó / 3 ejercicios) persisted and shown on /resumen.
  - FAIL: "Hazme una pregunta de opción múltiple…" and "grafica" → tutor said it would, but no `quizAsk`/`graphSet` call and no delegation event in the agent log; quiz card and graph never appeared. Emote not exercised (depends on quiz).
  - Minor: after ending, the browser landed on /campus instead of /resumen/<id>.
  - Insight: tools exposed directly on the realtime layer (showImage) and direct LLM calls (wrap-up) work; tools that rely on delegation to the backend model did not fire.

### Round 2 (user feedback after live test)
- [x] T10 — Graphing is essential: expose `graphSet`/`graphRemove` (with color) directly on the realtime voice layer (same pattern as `showImage`, which worked live) instead of relying on delegation; auto-switch to the Graficador tab when graphing.
- [x] T11 — New "Actividad" tab replaces "Pizarra": the tutor's interactive space (quiz cards now; room for future activities). `quizAsk` and `emote` on the realtime layer; switching to the tab automatically when a quiz arrives.
- [x] T12 — Unify whiteboard + notebook into a single "Cuaderno" tab: free drawing, optional photo of the notebook as background, eraser and alignment fixes preserved.
- [x] T13 — Images: smaller in the doc (never larger than the content column; capped height, click to enlarge) and non-blocking `showImage` so the tutor keeps talking while it searches.
- [x] T14 — `src/memory.ts` real implementation with `@atomicmemory/sdk` (already in package.json; README "Class memory" section), scoped per student, configured by `ATOMICMEMORY_API_URL`/`ATOMICMEMORY_API_KEY`; graceful no-op when not configured. Committed (replaces the local stub).
- [x] T15 — Minor: after ending an AI class, land on `/resumen/<id>` (observed landing on /campus).

## Acceptance criteria
- Asking the tutor to graph produces a graph and a confirmation, or an explicit failure message — never a false "listo".
- A quiz card appears, the student answers, the avatar celebrates on a correct answer and the tutor reacts.
- Ending an AI class writes a summary section into the document shown on the summary page.

## Progress
- T1 done: root cause agent.ts voice instructions let GPT-Live say "listo" while delegating (only forbade claiming work that was never delegated) and nothing checked the backend run; tools now return OK/ERROR, publish `aulaquipu:action` chips, `watchDelegations` logs/nudges when a delegation ends without a tool call. Checks: agent tsc 0, vitest 5/5, web tsc 0, eslint clean, /aula/x and /resumen/x 200.
- T2 done: agent `quizAsk` (answer key stays agent-side), `handleQuizAnswer` judges `aulaquipu:quiz-answer`, publishes `aulaquipu:quiz-result`, logs `tool_call{tool:'quiz'}` and prompts the voice reply; web quiz card + local script quizzes. Checks: agent tsc 0, vitest 9/9, web tsc 0, eslint clean, /aula/x and /resumen/x 200.
- T3 done: agent `emote` tool + agent-side celebrate/encourage on quiz verdict; web `emote` event drives avatar for 2.5 s (new `surprised` variant), auto-celebrate on correct quiz; local script emits emotes. Checks: agent tsc 0, vitest 10/10, web tsc 0, eslint clean, routes 200.
- T7 done: web sends `aulaquipu:control` wrap_up (+doc) on "Terminar" in AI classes; agent `wrapUpClass` generates the summary with a direct LLM call from transcript+doc, writes "Resumen de la clase" via the doc topic and replies `wrap_up_done`; web waits (25 s timeout, "Terminar sin resumen"), saves doc, then endSession. Local tutor writes a script-based summary. Checks: agent tsc 0, vitest 12/12, web tsc 0, eslint clean, routes 200.
- T9 done (004 pending user approval, NOT applied): `004_topic_images.sql` (+ database.sql section 11; validated twice in PGlite on base+seed: RLS on, url/caption checks, service_role only); admin API `GET/POST admin/topics/:id/images`, `DELETE admin/topic-images/:id` (audited `topic_image.add/delete`, 503 "Falta aplicar la migración 004" notice if missing) + "Imágenes del tema" panel + mock; agent `showImage` (bank first, then Wikimedia Commons with User-Agent, upload.wikimedia.org + png/jpeg/svg only, title denylist, 6 s timeout, max 3 per class, chip "Imagen: …"); roomToken sends `topicId`; web markdown renders `<img>` only for upload.wikimedia.org / Supabase host / same-origin, else "[imagen bloqueada]". Local mode step skipped (not trivial). Checks: agent tsc 0, vitest 16/16, web tsc 0, eslint clean, /aula/x and /admin/guias-ia 200, new admin APIs 401 without cookie.
- T10 done: voice-layer instructions now tell the tutor to call graphSet/graphRemove (with optional color) itself; backend instructions drop graph and say the tutor does it. Tools stay in the single shared tool list (the SDK has no per-layer split; ownership is by instruction). Web already auto-focuses the Graficador (transport emits focus_tool graph on graph_set). Checks: agent tsc 0, vitest 18/18.
- T11 done: tab Pizarra replaced by Actividad (new activity-panel.tsx; quiz card moved there with empty state, tab auto-opens on quiz_ask, dot badge, result card stays until Seguir); agent: quizAsk/emote called by the voice layer, removed from backend instructions. Local sim quizzes land in Actividad via the same quiz_ask handler; legacy focus 'board' maps to notebook. Board strokes are not rendered until T12. Checks: agent tsc 0, vitest 18/18, web tsc 0, eslint clean, /aula/x /resumen/x 200.
- T12 done: single Cuaderno tab (free drawing canvas + optional notebook photo): board/notebook strokes share one canvas (applyBoardEvent ignores target), 'Subir foto del cuaderno'/'Cambiar foto' + new 'Quitar foto' (notebook_clear event, peer-synced), strokes normalized to photo rect or square (eraser-by-removal, stable canvas and alignment logic untouched); simulated tutor board drawings and focus 'board' land in Cuaderno. Tabs: Documento, Graficador, Cuaderno, Actividad. Checks: web tsc 0, eslint clean, /aula/x /resumen/x 200.
- T13 done: web: ClassImage moved to client components/class-image.tsx (max-width 100%, max-height 280px, object-contain, centered, click-to-enlarge lightbox with Esc/close/backdrop); agent: showImage tool returns immediately ('OK: buscando la imagen…') and startImage runs bank/Wikimedia in the background (pending counted toward the 3-per-class cap), publishes doc insert + chip when found, or an error chip (action ok:false -> ⚠) plus hooks.tell -> session.generateReply so the tutor mentions it; showImage is now a voice-layer tool described as non-blocking, removed from backend instructions. Checks: agent tsc 0, vitest 20/20, web tsc 0, eslint clean, /aula/x /resumen/x 200.
- T14 done: src/memory.ts real implementation (MemoryClient from @atomicmemory/sdk/browser, the server-safe subset without the embeddings bundle): memoryScope/remember/recallBrief, env read lazily (dotenv loads after main.ts imports), scope user=studentId (+thread/metadata sessionId), 4 s timeout, no-op + single warning without credentials/on errors, never logs content or keys. Replaces the local stub, which is now committed. node_modules lacked the SDK: installed with npx pnpm@10 install --frozen-lockfile (corepack pnpm is broken here); package.json/lock unchanged. Checks: agent tsc 0, vitest 26/26 (6 new, SDK mocked).
- T15 done: no programmatic push to /campus exists in the end flow (aula only navigates to /resumen via finishClass, onRoomClosed and the status effect). Only /campus sources: CampusShell panel backdrop button, its X and Escape. Most likely cause (NOT reproduced): a stray click (e.g. second click of a double click on 'Terminar') lands on the full-screen backdrop of the freshly mounted resumen panel and closes it. Fix: aula funnels all three exits through one guarded goToSummary (router.replace /resumen/<id>), and the shell backdrop ignores clicks during the first 800 ms after a panel opens. Checks: web tsc 0, eslint clean, /aula/x /resumen/x 200.

## Next step
- Restart the agent worker, then re-run the T8 browser validation on the Round 2 changes (T10-T15): graph and quiz from the voice layer, Actividad/Cuaderno tabs, non-blocking images, memory (needs ATOMICMEMORY_* in .env.local), end -> /resumen.
