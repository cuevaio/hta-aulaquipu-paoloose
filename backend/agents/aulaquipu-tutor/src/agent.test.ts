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
  backendInstructions,
  createAgent,
  createQuizBook,
  handleQuizAnswer,
  wrapUpClass,
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

describe('gráficos desde la capa de voz', () => {
  const ctx = { tutorName: 'Inti', style: '', focus: '', topic: '', studentName: '', guide: '', studentId: '', topicId: '' };

  it('graphSet publica el color y graphRemove quita la curva', async () => {
    const { hooks, published } = makeHooks();
    const tools = toolsOf(hooks);
    expect(await run(tools.graphSet, { id: 'f2', latex: 'y=x^2', color: '#7C6BF2' })).toMatch(/^OK/);
    expect(published[0]).toMatchObject({ topic: 'aulaquipu:graph', msg: { type: 'graph_op', op: 'set', id: 'f2', color: '#7C6BF2' } });
    expect(await run(tools.graphRemove, { id: 'f2' })).toMatch(/^OK/);
    expect(published[2]).toMatchObject({ topic: 'aulaquipu:graph', msg: { op: 'remove', id: 'f2' } });
  });

  it('las instrucciones del modelo de respaldo ya no piden graficar (lo hace el tutor)', () => {
    const text = backendInstructions(ctx, '');
    expect(text).not.toMatch(/llama (graphSet|quizAsk|emote)/);
    expect(text).toMatch(/gráficos, .*quizAsk.*emote.*tutor directamente/);
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

describe('emote', () => {
  it('publica la reacción del avatar', async () => {
    const { hooks, published } = makeHooks();
    const out = await run(toolsOf(hooks).emote, { kind: 'celebrate' });
    expect(out).toMatch(/^OK/);
    expect(published).toEqual([{ msg: { type: 'emote', kind: 'celebrate' }, topic: 'aulaquipu:emote' }]);
  });
});

describe('resumen de fin de clase', () => {
  const input = { transcript: 'Alumno: no entiendo', doc: '## Fracciones', topic: 'Fracciones', studentName: 'Ana' };

  it('escribe la sección en el documento y avisa wrap_up_done', async () => {
    const { hooks, published, events } = makeHooks();
    const ok = await wrapUpClass(hooks, async () => '### Lo que vimos\n- fracciones', input);
    expect(ok).toBe(true);
    expect(published[0]).toMatchObject({ topic: 'aulaquipu:doc', msg: { op: 'write', section: 'Resumen de la clase' } });
    expect(published.at(-1)).toEqual({ msg: { type: 'wrap_up_done', ok: true }, topic: 'aulaquipu:control' });
    expect(events.some((e) => e.kind === 'error')).toBe(false);
  });

  it('si el modelo falla registra el error y aun así responde ok:false', async () => {
    const { hooks, published, events } = makeHooks();
    const ok = await wrapUpClass(
      hooks,
      async () => {
        throw new Error('sin modelo');
      },
      input,
    );
    expect(ok).toBe(false);
    expect(events).toContainEqual({ kind: 'error', payload: expect.objectContaining({ tool: 'wrapUp' }) });
    expect(published).toEqual([{ msg: { type: 'wrap_up_done', ok: false }, topic: 'aulaquipu:control' }]);
  });
});

describe('showImage', () => {
  const commons = {
    query: {
      pages: {
        '1': {
          title: 'File:Nude study.jpg',
          index: 1,
          imageinfo: [{ url: 'https://upload.wikimedia.org/a/a.jpg', thumburl: 'https://upload.wikimedia.org/a/800px-a.jpg', mime: 'image/jpeg', extmetadata: {} }],
        },
        '2': {
          title: 'File:Cell.gif',
          index: 2,
          imageinfo: [{ url: 'https://upload.wikimedia.org/c/c.gif', thumburl: 'https://upload.wikimedia.org/c/800px-c.gif', mime: 'image/gif', extmetadata: {} }],
        },
        '3': {
          title: 'File:Evil host.png',
          index: 3,
          imageinfo: [{ url: 'https://evil.example.com/x.png', thumburl: 'https://evil.example.com/x.png', mime: 'image/png', extmetadata: {} }],
        },
        '4': {
          title: 'File:Animal cell diagram.svg',
          index: 4,
          imageinfo: [
            {
              url: 'https://upload.wikimedia.org/w/Animal_cell.svg',
              thumburl: 'https://upload.wikimedia.org/w/800px-Animal_cell.svg.png',
              mime: 'image/svg+xml',
              extmetadata: { Artist: { value: '<a href="//x">Mariana <b>Ruiz</b></a>' }, LicenseShortName: { value: 'CC BY-SA 4.0' } },
            },
          ],
        },
      },
    },
  };
  const jsonFetch = (body: unknown, ok = true) =>
    vi.fn(async (_url: unknown, _init?: unknown) => ({ ok, status: ok ? 200 : 503, json: async () => body }) as Response);

  it('usa el banco del tema antes que Wikimedia y elige por coincidencia de palabras', async () => {
    const fetchMock = jsonFetch(commons);
    const { hooks, published, events } = makeHooks({
      fetch: fetchMock as unknown as typeof fetch,
      topicImages: async () => [
        { url: 'https://cdn.example.com/triangulo.png', caption: 'Triángulo rectángulo', credit: 'Equipo' },
        { url: 'https://cdn.example.com/celula.png', caption: 'Partes de la célula animal', credit: '' },
      ],
    });
    const out = await run(toolsOf(hooks).showImage, { query: 'célula animal' });
    expect(out).toMatch(/^OK/);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(published[0]).toMatchObject({
      topic: 'aulaquipu:doc',
      msg: { type: 'doc_op', op: 'write', markdown: expect.stringContaining('![Partes de la célula animal](https://cdn.example.com/celula.png)') },
    });
    expect(published[1].msg).toMatchObject({ type: 'action', tool: 'showImage', label: 'Imagen: Partes de la célula animal' });
    expect(events[0]).toMatchObject({ kind: 'tool_call', payload: { tool: 'showImage', source: 'bank' } });
  });

  it('sin banco busca en Wikimedia: filtra título inseguro, mime, host y toma el crédito sin HTML', async () => {
    const fetchMock = jsonFetch(commons);
    const { hooks, published } = makeHooks({ fetch: fetchMock as unknown as typeof fetch });
    const out = await run(toolsOf(hooks).showImage, { query: 'animal cell', caption: 'La célula animal' });
    expect(out).toMatch(/^OK/);
    const [calledUrl, init] = fetchMock.mock.calls[0] as [string, { headers: Record<string, string> }];
    expect(calledUrl).toContain('commons.wikimedia.org/w/api.php');
    expect(calledUrl).toContain('gsrsearch=animal+cell');
    expect(init.headers['User-Agent']).toMatch(/AulaQuipu/);
    const md = (published[0].msg as { markdown: string }).markdown;
    expect(md).toContain('![La célula animal](https://upload.wikimedia.org/w/800px-Animal_cell.svg.png)');
    expect(md).toContain('*Imagen: Mariana Ruiz, CC BY-SA 4.0 · Wikimedia Commons*');
    expect(md).not.toContain('evil.example.com');
  });

  it('devuelve ERROR sin publicar si Wikimedia falla o no hay resultados', async () => {
    const down = makeHooks({ fetch: jsonFetch({}, false) as unknown as typeof fetch });
    expect(await run(toolsOf(down.hooks).showImage, { query: 'mapa del Perú' })).toMatch(/^ERROR/);
    expect(down.published).toHaveLength(0);
    expect(down.events[0]).toMatchObject({ kind: 'error', payload: { tool: 'showImage' } });

    const empty = makeHooks({ fetch: jsonFetch({ batchcomplete: '' }) as unknown as typeof fetch });
    expect(await run(toolsOf(empty.hooks).showImage, { query: 'algo raro' })).toMatch(/^ERROR: no encontré/);
    expect(empty.published).toHaveLength(0);
  });

  it('limita a 3 imágenes por clase', async () => {
    const { hooks, published } = makeHooks({
      topicImages: async () => [1, 2, 3, 4].map((n) => ({ url: `https://cdn.example.com/${n}.png`, caption: `Imagen ${n}`, credit: '' })),
    });
    const t = toolsOf(hooks).showImage;
    for (let i = 0; i < 3; i++) expect(await run(t, { query: 'imagen' })).toMatch(/^OK/);
    expect(await run(t, { query: 'imagen' })).toMatch(/^ERROR: ya se mostraron 3/);
    expect(published.filter((p) => p.topic === 'aulaquipu:doc')).toHaveLength(3);
  });
});
