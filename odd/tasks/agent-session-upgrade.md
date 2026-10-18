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
- [ ] T3 — Avatar reactions.
- [ ] T7 — End-of-class summary.
- [ ] T8 — Browser validation with the real agent (orchestrator).

## Acceptance criteria
- Asking the tutor to graph produces a graph and a confirmation, or an explicit failure message — never a false "listo".
- A quiz card appears, the student answers, the avatar celebrates on a correct answer and the tutor reacts.
- Ending an AI class writes a summary section into the document shown on the summary page.

## Progress
- T1 done: root cause agent.ts voice instructions let GPT-Live say "listo" while delegating (only forbade claiming work that was never delegated) and nothing checked the backend run; tools now return OK/ERROR, publish `aulaquipu:action` chips, `watchDelegations` logs/nudges when a delegation ends without a tool call. Checks: agent tsc 0, vitest 5/5, web tsc 0, eslint clean, /aula/x and /resumen/x 200.
- T2 done: agent `quizAsk` (answer key stays agent-side), `handleQuizAnswer` judges `aulaquipu:quiz-answer`, publishes `aulaquipu:quiz-result`, logs `tool_call{tool:'quiz'}` and prompts the voice reply; web quiz card + local script quizzes. Checks: agent tsc 0, vitest 9/9, web tsc 0, eslint clean, /aula/x and /resumen/x 200.

## Next step
- T3.
