// Memoria de clases con AtomicMemory (https://docs.atomicstrata.ai): qué trabajó y qué le costó
// a cada alumno. Sin credenciales, o si la API falla o tarda, se degrada a no-op: la clase sigue
// igual, solo sin memoria. Nunca se registran el contenido de los recuerdos ni las claves.
import { MemoryClient } from '@atomicmemory/sdk/browser';

export type MemoryScope = { studentId: string; sessionId: string };

// Si solo hay clave, se usa el servicio público de AtomicMemory
const DEFAULT_API_URL = 'https://api.atomicstrata.ai';

const TIMEOUT_MS = 4_000;
const MAX_BRIEF_CHARS = 1_200;
const MAX_RESULTS = 5;

export function memoryScope(studentId: string, sessionId: string): MemoryScope {
  return { studentId, sessionId };
}

let client: MemoryClient | null = null;
let ready: Promise<MemoryClient | null> | null = null;
let warned = false;

// Un solo aviso por proceso, sin contenido ni claves: solo el motivo
function warnOnce(reason: string) {
  if (warned) return;
  warned = true;
  console.warn(`[memoria] sin memoria de clases: ${reason}`);
}

function withTimeout<T>(work: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('tiempo agotado')), TIMEOUT_MS);
  });
  return Promise.race([work, timeout]).finally(() => clearTimeout(timer));
}

// Las variables se leen aquí, no al importar: main.ts carga el .env después de sus imports
function connect(): Promise<MemoryClient | null> {
  ready ??= (async () => {
    const apiUrl = process.env.ATOMICMEMORY_API_URL || DEFAULT_API_URL;
    const apiKey = process.env.ATOMICMEMORY_API_KEY;
    if (!apiKey) {
      warnOnce('falta ATOMICMEMORY_API_KEY');
      return null;
    }
    try {
      const memory = new MemoryClient({ providers: { atomicmemory: { apiUrl, apiKey, timeout: TIMEOUT_MS } } });
      await withTimeout(memory.initialize());
      client = memory;
      return memory;
    } catch (err) {
      warnOnce(`no se pudo conectar (${err instanceof Error ? err.name : 'error'})`);
      return null;
    }
  })();
  return ready;
}

/** Guarda un hecho duradero del alumno. true solo si la API lo aceptó. */
export async function remember(scope: MemoryScope, content: string): Promise<boolean> {
  const text = content.trim();
  if (!scope.studentId || !text) return false;
  const memory = client ?? (await connect());
  if (!memory) return false;
  try {
    await withTimeout(
      memory.ingest({
        mode: 'text',
        content: text,
        // Memoria por alumno (user); la clase donde se aprendió queda como hilo y metadato
        scope: { user: scope.studentId, ...(scope.sessionId && { thread: scope.sessionId }) },
        metadata: { sessionId: scope.sessionId, source: 'aulaquipu-tutor' },
      }),
    );
    return true;
  } catch (err) {
    warnOnce(`falló al guardar (${err instanceof Error ? err.name : 'error'})`);
    return false;
  }
}

/** Resumen en viñetas de lo recordado del alumno sobre `query`; '' si no hay memoria o falla. */
export async function recallBrief(scope: MemoryScope, query: string): Promise<string> {
  if (!scope.studentId) return '';
  const memory = client ?? (await connect());
  if (!memory) return '';
  try {
    const page = await withTimeout(memory.search({ query, scope: { user: scope.studentId }, limit: MAX_RESULTS }));
    const lines = page.results
      .map((r) => r.memory.content.replace(/\s+/g, ' ').trim())
      .filter(Boolean)
      .map((c) => `- ${c}`);
    return lines.join('\n').slice(0, MAX_BRIEF_CHARS);
  } catch (err) {
    warnOnce(`falló al consultar (${err instanceof Error ? err.name : 'error'})`);
    return '';
  }
}
