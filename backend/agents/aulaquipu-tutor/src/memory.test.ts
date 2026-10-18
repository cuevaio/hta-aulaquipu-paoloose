// Pruebas sin red: el SDK de AtomicMemory se simula.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const sdk = vi.hoisted(() => ({
  initialize: vi.fn(async () => {}),
  ingest: vi.fn(async (_input: unknown) => ({ created: ['m1'], updated: [], unchanged: [] })),
  search: vi.fn(async (_req: unknown) => ({ results: [] as Array<{ memory: { content: string } }> })),
  ctor: vi.fn(),
}));

vi.mock('@atomicmemory/sdk/browser', () => ({
  MemoryClient: class {
    constructor(config: unknown) {
      sdk.ctor(config);
    }
    initialize = sdk.initialize;
    ingest = sdk.ingest;
    search = sdk.search;
  },
}));

async function load() {
  vi.resetModules();
  return import('./memory.ts');
}

const KEY = 'secreto-de-prueba';

describe('memoria de clases', () => {
  let warn: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ATOMICMEMORY_API_URL = 'https://memoria.example.com';
    process.env.ATOMICMEMORY_API_KEY = KEY;
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.useRealTimers();
    warn.mockRestore();
    delete process.env.ATOMICMEMORY_API_URL;
    delete process.env.ATOMICMEMORY_API_KEY;
  });

  it('sin credenciales es un no-op y avisa una sola vez, sin tocar el SDK', async () => {
    delete process.env.ATOMICMEMORY_API_KEY;
    const m = await load();
    const scope = m.memoryScope('stu-1', 'ses-1');
    expect(await m.remember(scope, 'domina fracciones')).toBe(false);
    expect(await m.recallBrief(scope, 'progreso')).toBe('');
    expect(await m.remember(scope, 'otro')).toBe(false);
    expect(sdk.ctor).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('guarda por alumno (user) etiquetando la clase', async () => {
    const m = await load();
    expect(await m.remember(m.memoryScope('stu-1', 'ses-9'), ' Domina fracciones ')).toBe(true);
    expect(sdk.ctor).toHaveBeenCalledWith({
      providers: { atomicmemory: { apiUrl: 'https://memoria.example.com', apiKey: KEY, timeout: 4000 } },
    });
    expect(sdk.ingest).toHaveBeenCalledWith({
      mode: 'text',
      content: 'Domina fracciones',
      scope: { user: 'stu-1', thread: 'ses-9' },
      metadata: { sessionId: 'ses-9', source: 'aulaquipu-tutor' },
    });
  });

  it('recuerda con la memoria del alumno (sin filtrar por clase) y arma viñetas', async () => {
    sdk.search.mockResolvedValueOnce({ results: [{ memory: { content: 'Le cuesta\nsumar fracciones' } }, { memory: { content: '  ' } }, { memory: { content: 'Domina rectas' } }] });
    const m = await load();
    const brief = await m.recallBrief(m.memoryScope('stu-1', 'ses-9'), 'progreso');
    expect(brief).toBe('- Le cuesta sumar fracciones\n- Domina rectas');
    expect(sdk.search).toHaveBeenCalledWith({ query: 'progreso', scope: { user: 'stu-1' }, limit: 5 });
  });

  it('si la API falla degrada a no-op, avisa una vez y no filtra contenido ni clave', async () => {
    sdk.ingest.mockRejectedValue(new Error(`401 ${KEY}`));
    sdk.search.mockRejectedValue(new Error('caída'));
    const m = await load();
    const scope = m.memoryScope('stu-1', 'ses-1');
    expect(await m.remember(scope, 'dato privado del alumno')).toBe(false);
    expect(await m.recallBrief(scope, 'x')).toBe('');
    expect(await m.remember(scope, 'otro dato privado')).toBe(false);
    expect(warn).toHaveBeenCalledTimes(1);
    const logged = JSON.stringify(warn.mock.calls);
    expect(logged).not.toContain(KEY);
    expect(logged).not.toContain('dato privado');
  });

  it('si la API tarda más de ~4 s, corta y devuelve vacío', async () => {
    vi.useFakeTimers();
    sdk.search.mockImplementation(() => new Promise(() => {}));
    const m = await load();
    const pending = m.recallBrief(m.memoryScope('stu-1', 'ses-1'), 'x');
    await vi.advanceTimersByTimeAsync(4_100);
    expect(await pending).toBe('');
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('sin id de alumno no hace nada', async () => {
    const m = await load();
    expect(await m.remember(m.memoryScope('', 'ses-1'), 'algo')).toBe(false);
    expect(await m.recallBrief(m.memoryScope('', 'ses-1'), 'algo')).toBe('');
    expect(sdk.ctor).not.toHaveBeenCalled();
  });
});
