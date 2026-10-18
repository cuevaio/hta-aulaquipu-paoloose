# Feature: AI tutor animated avatar (prototype)

**Branch:** `feat/ai-tutor-avatar` (local only)
**Objective:** Replace the static emoji `AiAvatar` with a self-built animated SVG character for AI tutors, driven by classroom state and audio level, with no third-party avatar service.

**Problem:** The AI tutor is an emoji in a circle with a pulse; it does not feel "alive" in the demo.
**Why:** The AI class is the core of the demo; a reactive avatar (lip movement, states, gaze) adds presence at low risk and keeps the "only OpenAI as third party" constraint. LiveKit avatar plugins (Anam, Tavus, Bey...) were considered and deferred: paid external service and LiveKit is not yet wired in the web.

## Scope
- New `AiTutorAvatar` SVG component with states: `idle | listening | thinking | speaking | writing | graphing | celebrating`, mouth driven by a `level` (0..1), blinking, gaze toward the active tool.
- Audio-level hook: real level from a `MediaStream` via `AnalyserNode` (future LiveKit agent track) + synthetic level fallback while the simulated tutor speaks via `speechSynthesis`.
- Preview page `/lab/avatar` to inspect states and personas.
- Integrate into the classroom: derive avatar state from existing `ClassroomEvent`s.

## Out of scope
- Wiring LiveKit / real agent audio (only the hook is ready to accept a stream).
- Changing the agent protocol.

## Constraints
- Match existing style (blob SVG avatars, Tailwind tokens in `globals.css`).
- Respect `prefers-reduced-motion`.
- Next.js 16 (read `node_modules/next/dist/docs/` before using unfamiliar APIs).

## TDD
- Mode: off. Source: no project/session configuration; web-app has no test runner.
- Checks: `npx tsc --noEmit`, `npx eslint <changed files>`, affected routes return 200 on dev server.

## Tasks
- [x] T1 — `AiTutorAvatar` component + `useAudioLevel` hook + `/lab/avatar` preview page.
- [ ] T2 — Integrate in classroom (`ParticipantCard`, aula page): derive state from events (`speaking`, `doc_write`/`doc_append_table` → writing, `graph_set` → graphing, `ask_student` → listening, `focus_tool` → gaze); keep `AiAvatar` for small cards elsewhere.

## Acceptance criteria
- `/lab/avatar` shows each persona and lets you switch state and see mouth/blink/gaze animate.
- In `/aula/[sessionId]` with an AI tutor, the avatar visibly changes state as the scripted tutor speaks, writes and graphs.
- Typecheck and lint pass on changed files.

## Progress
- T1 done: `components/classroom/ai-tutor-avatar.tsx`, `lib/classroom/use-audio-level.ts`, `/lab/avatar` (outside `(app)` layout, no login), keyframes in `globals.css`. Checks: `npx tsc --noEmit` clean; `npx eslint` on changed files clean; `GET /lab/avatar` -> 200. Dev log shows only a pre-existing `/campus` instant-navigation warning.

## Next step
- T2.
