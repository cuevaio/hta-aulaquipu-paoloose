// Agent behavior is covered by the simulations in scenarios.yaml, which run full
// conversations against the agent on LiveKit Cloud (see README.md). The eval
// below is kept as an example of the in-process testing framework
// (https://docs.livekit.io/agents/start/testing/) for turn-level checks that
// don't need a live session. Uncomment it and run `pnpm test` to use it.
//
//
// Debajo: pruebas sin red de las herramientas del tutor (el hook publish se simula).

import { describe, expect, it, vi } from 'vitest';
import {
  createAgent,
  createQuizBook,
  handleQuizAnswer,
  watchDelegations,
  type TutorHooks,
} from './agent.ts';

function makeHooks(overrides: Partial<TutorHooks> = {}) {
  const published: Array<{ msg: Record<string, unknown>; topic: string }> = [];
  const events: Array<{ kind: string; payload: Record<string, unknown> }> = [];
  const hooks: TutorHooks = {
    publish: async (msg, topic) => void published.push({ msg, topic }),
    logEvent: async (kind, payload) => void events.push({ kind, payload }),
    remember: async () => true,
    recall: async () => '',
    ...overrides,
  };
  return { hooks, published, events };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toolsOf(hooks: TutorHooks): Record<string, any> {
  process.env.LIVEKIT_API_KEY ??= 'test';
  process.env.LIVEKIT_API_SECRET ??= 'test';
  process.env.LIVEKIT_URL ??= 'wss://test.livekit.cloud';
  const agent = createAgent(hooks);
  return Object.fromEntries(agent.toolCtx.flatten().map((t) => [t.id, t]));
}

const run = (t: { execute: (a: never, o: never) => Promise<string> }, args: unknown) =>
  t.execute(args as never, {} as never);

describe('herramientas del tutor', () => {
  it('graphSet publica la curva, el chip de confirmación y registra la llamada', async () => {
    const { hooks, published, events } = makeHooks();
    const out = await run(toolsOf(hooks).graphSet, { id: 'f1', latex: 'y=\\frac{1}{2}x' });
    expect(out).toMatch(/^OK/);
    expect(published.map((p) => p.topic)).toEqual(['aulaquipu:graph', 'aulaquipu:action']);
    expect(published[1].msg).toMatchObject({ type: 'action', tool: 'graphSet', label: 'Graficado y = 1/2x' });
    expect(events[0]).toMatchObject({ kind: 'tool_call', payload: { tool: 'graphSet' } });
  });

  it('si la publicación falla devuelve ERROR, lo registra y no hay chip', async () => {
    const { hooks, published, events } = makeHooks({
      publish: async () => {
        throw new Error('sala caída');
      },
    });
    const out = await run(toolsOf(hooks).docWrite, { section: 'Pasos', markdown: '1. a' });
    expect(out).toMatch(/^ERROR/);
    expect(out).toMatch(/NO quedó hecho/);
    expect(published).toHaveLength(0);
    expect(events).toEqual([
      { kind: 'error', payload: expect.objectContaining({ tool: 'docWrite' }) },
    ]);
  });
});

describe('vigilancia de la delegación', () => {
  function setup() {
    const { hooks, events } = makeHooks();
    let listener: (e: Record<string, unknown>) => void = () => {};
    const appendCommentary = vi.fn();
    watchDelegations(
      {
        on: (_event, cb) => void (listener = cb as unknown as typeof listener),
        appendCommentary,
      },
      hooks,
    );
    const emit = (e: Record<string, unknown>) => listener(e);
    return { events, appendCommentary, emit };
  }
  const created = { type: 'session.delegation.created', delegation: { id: 'd1' } };
  const done = (type: string, extra = {}) => ({ type: 'response.event', delegation_id: 'd1', event: { type, ...extra } });

  it('avisa y registra error si la respuesta termina sin llamar herramientas', () => {
    const t = setup();
    t.emit(created);
    t.emit(done('response.completed'));
    expect(t.events[0]).toMatchObject({ kind: 'error', payload: { tool: 'delegation', attempt: 1 } });
    expect(t.appendCommentary).toHaveBeenCalledOnce();
    expect(t.appendCommentary.mock.calls[0][0]).toMatch(/NO se ejecutó/);
  });

  it('no avisa si hubo una llamada a herramienta', () => {
    const t = setup();
    t.emit(created);
    t.emit(done('response.output_item.done', { item: { type: 'function_call' } }));
    t.emit(done('response.completed'));
    expect(t.events).toHaveLength(0);
    expect(t.appendCommentary).not.toHaveBeenCalled();
  });

  it('reintenta una vez y a la segunda falla pide decirlo sin disimular', () => {
    const t = setup();
    for (const id of ['d1', 'd2']) {
      t.emit({ type: 'session.delegation.created', delegation: { id } });
      t.emit({ type: 'response.event', delegation_id: id, event: { type: 'response.completed' } });
    }
    expect(t.appendCommentary.mock.calls[0][0]).toMatch(/vuelve a delegar/);
    expect(t.appendCommentary.mock.calls[1][0]).toMatch(/no pudiste hacerlo/);
  });
});

describe('quiz de opción múltiple', () => {
  const quiz = { question: '¿1/2 + 1/2?', options: ['1', '2', '1/4'], correctIndex: 0, explanation: 'Medio y medio es uno.' };

  it('quizAsk muestra la tarjeta sin enviar la respuesta correcta', async () => {
    const { hooks, published } = makeHooks();
    const out = await run(toolsOf(hooks).quizAsk, quiz);
    expect(out).toMatch(/^OK/);
    expect(published).toHaveLength(1);
    expect(published[0].topic).toBe('aulaquipu:quiz');
    expect(JSON.stringify(published[0].msg)).not.toMatch(/correctIndex|Medio y medio/);
  });

  it('quizAsk rechaza un quiz inválido sin mostrar nada', async () => {
    const { hooks, published } = makeHooks();
    const out = await run(toolsOf(hooks).quizAsk, { ...quiz, correctIndex: 3 });
    expect(out).toMatch(/^ERROR/);
    expect(published).toHaveLength(0);
  });

  it('califica la primera respuesta, publica el veredicto y registra el resultado', async () => {
    const { hooks, published, events } = makeHooks();
    const book = createQuizBook();
    const id = book.add(quiz);
    const prompt = await handleQuizAnswer(hooks, book, { id, index: 0 });
    expect(prompt).toMatch(/CORRECTA/);
    const result = published.find((p) => p.topic === 'aulaquipu:quiz-result')!;
    expect(result.msg).toMatchObject({ id, correct: true, correctIndex: 0, explanation: quiz.explanation });
    expect(events).toContainEqual({
      kind: 'tool_call',
      payload: expect.objectContaining({ tool: 'quiz', correct: true }),
    });
    // una segunda respuesta al mismo quiz se ignora
    expect(await handleQuizAnswer(hooks, book, { id, index: 1 })).toBeNull();
  });

  it('una respuesta incorrecta anima y revela la correcta', async () => {
    const { hooks, published } = makeHooks();
    const book = createQuizBook();
    const id = book.add(quiz);
    const prompt = await handleQuizAnswer(hooks, book, { id, index: 2 });
    expect(prompt).toMatch(/INCORRECTA/);
    expect(published.find((p) => p.topic === 'aulaquipu:quiz-result')!.msg).toMatchObject({ correct: false, correctIndex: 0 });
    expect(await handleQuizAnswer(hooks, book, { id: 'nope', index: 0 })).toBeNull();
  });
});
