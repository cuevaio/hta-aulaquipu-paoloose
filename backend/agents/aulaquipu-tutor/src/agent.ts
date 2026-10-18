import { Agent, dedent, inference, tool } from '@livekit/agents';
import { z } from 'zod';

export type TutorHooks = {
  publish: (msg: Record<string, unknown>, topic: string) => Promise<void>;
  logEvent: (kind: string, payload: Record<string, unknown>) => Promise<void>;
  remember: (content: string) => Promise<boolean>;
  recall: (query: string) => Promise<string>;
};

export type ClassContext = {
  tutorName: string;
  style: string;
  focus: string;
  topic: string;
  studentName: string;
  /** Guía del tema definida por la plataforma (admin). Vacía si el tema no tiene guía. */
  guide: string;
  studentId: string;
};

export const ACTION_TOPIC = 'aulaquipu:action';

// LaTeX de Desmos a algo legible para el chip del chat ("y=\frac{1}{2}x" -> "y = 1/2x")
function prettyLatex(latex: string): string {
  return latex
    .replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, '$1/$2')
    .replace(/\\left|\\right/g, '')
    .replace(/\\cdot/g, '·')
    .replace(/\\sqrt/g, '√')
    .replace(/\\([a-zA-Z]+)/g, '$1')
    .replace(/[{}]/g, '')
    .replace(/\s*=\s*/, ' = ')
    .trim();
}

type Action = {
  tool: string;
  /** Texto del chip de confirmación en el chat, sin el "✓" (lo pone la web) */
  label: string;
  msg: Record<string, unknown>;
  topic: string;
  log: Record<string, unknown>;
  ok: string;
};

// Una herramienta solo cuenta como hecha si el mensaje salió a la sala. Si no, el resultado
// que ve el modelo de respaldo (y por él el tutor de voz) dice explícitamente que NO se hizo.
async function runAction(hooks: TutorHooks, a: Action): Promise<string> {
  try {
    await hooks.publish(a.msg, a.topic);
  } catch (err) {
    await hooks.logEvent('error', { tool: a.tool, message: String(err), ...a.log });
    return `ERROR: no se pudo ejecutar ${a.tool} (${String(err)}). NO quedó hecho en pantalla: dilo tal cual al tutor ("no pude hacerlo") y no lo des por hecho.`;
  }
  await hooks.logEvent('tool_call', { tool: a.tool, ...a.log });
  // El chip es un extra: si falla, la acción ya se hizo
  await hooks.publish({ type: 'action', tool: a.tool, label: a.label }, ACTION_TOPIC).catch(() => {});
  return a.ok;
}

// --- Vigilancia de la delegación ---

type DelegationEmitter = {
  on(event: 'openai_server_event_received', cb: (e: never) => void): unknown;
  appendCommentary(text: string): void;
};

const NOT_RUN_RETRY =
  'AVISO DEL SISTEMA: lo último que delegaste NO se ejecutó (no se escribió ni se graficó nada). Dile al alumno en una frase corta que no pudiste y que lo intentas de nuevo, y vuelve a delegar el mismo pedido una sola vez. Si era solo una consulta que no necesitaba herramientas, ignora este aviso.';
const NOT_RUN_GIVE_UP =
  'AVISO DEL SISTEMA: de nuevo no se ejecutó lo que delegaste. Dile al alumno con naturalidad que ahora no pudiste hacerlo, no digas que quedó listo y sigue explicándolo de palabra.';

/**
 * El modelo de respaldo puede terminar sin llamar ninguna herramienta aunque se le pidió una.
 * Si la primera respuesta de una delegación acaba sin llamadas: se registra el error y se le
 * avisa al tutor de voz para que reintente una vez y, si vuelve a pasar, lo diga sin disimular.
 */
export function watchDelegations(session: DelegationEmitter, hooks: TutorHooks) {
  const runs = new Map<string, { tools: number; checked: boolean }>();
  let strikes = 0;
  type ServerEvt = {
    type?: string;
    delegation?: { id?: string | null };
    delegation_id?: string | null;
    event?: { type?: string; item?: { type?: string } };
  };
  session.on('openai_server_event_received', ((e: ServerEvt) => {
    if (e.type === 'session.delegation.created' && e.delegation?.id) {
      runs.set(e.delegation.id, { tools: 0, checked: false });
      if (runs.size > 100) runs.delete(runs.keys().next().value as string);
      return;
    }
    if (e.type !== 'response.event' || !e.delegation_id) return;
    const run = runs.get(e.delegation_id);
    const ev = e.event;
    if (!run || !ev) return;
    if (ev.type === 'response.output_item.done' && ev.item?.type === 'function_call') {
      run.tools++;
      strikes = 0;
    } else if (!run.checked && (ev.type === 'response.completed' || ev.type === 'response.failed' || ev.type === 'response.incomplete')) {
      run.checked = true;
      if (run.tools > 0) return;
      strikes++;
      void hooks.logEvent('error', {
        tool: 'delegation',
        reason: ev.type === 'response.completed' ? 'backend_returned_without_tool_call' : ev.type,
        attempt: strikes,
      });
      session.appendCommentary(strikes === 1 ? NOT_RUN_RETRY : NOT_RUN_GIVE_UP);
      if (strikes > 1) strikes = 0;
    }
  }) as (e: never) => void);
}

const DEFAULT_CONTEXT: ClassContext = {
  tutorName: 'Quipu',
  style: '',
  focus: '',
  topic: '',
  studentName: '',
  guide: '',
  studentId: '',
};

function classBrief(c: ClassContext): string {
  const lines = [
    c.style && `- Tu estilo: ${c.style}.`,
    c.focus && `- Tu especialidad: ${c.focus}.`,
    c.topic && `- El alumno reservó esta clase para: ${c.topic}. Empieza por ahí.`,
    c.studentName && `- El alumno se llama ${c.studentName}.`,
  ].filter(Boolean);
  return lines.length ? `\n# Esta clase\n${lines.join('\n')}\n` : '';
}

// Guía por tema que define la plataforma: manda sobre el plan de clase genérico.
function guideBrief(c: ClassContext): string {
  if (!c.guide) return '';
  return (
    '\n# Guía del tema definida por la plataforma\n' +
    'Sigue estos objetivos y pasos; vigila estos errores comunes; verifica con estas preguntas. ' +
    'Úsala como columna vertebral de la clase, adaptando el ritmo al alumno, sin leerla en voz alta.\n\n' +
    `${c.guide}\n`
  );
}

function memorySection(brief: string): string {
  return brief ? `\n# Memoria de clases anteriores\n${brief}\n` : '';
}

// Instrucciones del modelo de razonamiento al que GPT-Live delega el trabajo. El modelo de voz
// NO ve las herramientas: solo decide qué delegar; este modelo es el que las llama
// (https://docs.livekit.io/agents/models/realtime/gpt-live/).
function backendInstructions(c: ClassContext, memoryBrief: string): string {
  return (
    dedent`
      Atiendes lo que delega ${c.tutorName}, tutor de voz de AulaQuipu, en una clase de secundaria en Perú.
      Tu trabajo es dejar por escrito y graficado lo que el tutor explica, para que el alumno lo vea en pantalla.

      - Explicaciones, pasos, ejemplos, ejercicios y resúmenes: llama docWrite con un título de sección corto
        y markdown claro en español (listas numeradas para los pasos, negritas para los resultados).
        Escribe las fórmulas en LaTeX entre signos de dólar: $\\frac{1}{2}+\\frac{1}{3}$ en línea y $$...$$ para destacarlas.
        Reusa el mismo título para corregir o ampliar una sección.
      - Comparaciones o datos ordenados: llama docAppendTable.
      - Funciones, rectas, parábolas o puntos: llama graphSet con LaTeX de Desmos, por ejemplo "y=2x+1",
        "y=\\frac{1}{2}x" o "(1,3)". Usa ids cortos como "f1", "f2"; reutiliza el id para cambiar una curva.
        El color es opcional (hexadecimal, por ejemplo "#7C6BF2"): úsalo para distinguir varias curvas.
      - Memoria de clases: llama memoryRecall cuando necesites saber qué trabajó o le costó al alumno
        antes, y memorySave con hechos duraderos de su progreso (qué domina, qué le cuesta, acuerdos)
        durante la clase y al cerrarla.
      - Puedes llamar varias herramientas seguidas.
      - Si te piden escribir, graficar, tabular, preguntar o guardar algo, DEBES llamar la herramienta: nunca respondas solo con texto.
      - Cada herramienta devuelve "OK" o "ERROR". Tu respuesta final se basa SOLO en esos resultados:
        si alguna devolvió ERROR o no la llamaste, di claramente que no se pudo ("No pude graficarlo")
        y nunca digas que quedó hecho.
      - Responde al tutor con una sola frase corta que pueda decir en voz alta, sin markdown.
    ` +
    (c.topic ? `\nEl tema de la clase es: ${c.topic}.` : '') +
    (c.guide
      ? `\nGuía del tema (escribe en el documento los pasos y ejercicios siguiendo esta guía):\n${c.guide}`
      : '') +
    memorySection(memoryBrief)
  );
}

export function createAgent(
  hooks: TutorHooks,
  context: ClassContext = DEFAULT_CONTEXT,
  memoryBrief = '',
) {
  return Agent.create({
    instructions:
      dedent`
      Eres ${context.tutorName}, tutor del AulaQuipu: enseñas a alumnos de secundaria en Perú, en español peruano, cálido y claro.

      # Flujo de clase
      1. Saluda brevemente y haz una pregunta corta para saber qué tanto sabe.
      2. Diagnostica el nivel con dos o tres preguntas cortas antes de explicar.
      3. Enseña por pasos cortos.
      4. Después de cada idea clave, propone un ejercicio de práctica y espera la respuesta.
      5. Cierra con un resumen hablado breve.

      # Qué delegar
      - Delega SIEMPRE que expliques un procedimiento, des un ejemplo resuelto, propongas un ejercicio o cierres con un resumen: pide que se escriba en el documento de la clase.
      - Delega cuando haya una tabla útil (comparaciones, valores) o algo que se entienda mejor graficado (funciones, rectas, puntos).
      - Al cerrar la clase, o cuando el alumno domine algo nuevo, delega memorySave con un registro breve de su progreso.
      - Si el alumno menciona clases anteriores o retoman algo ya trabajado, delega memoryRecall antes de responder.
      - Saludos, preguntas de diagnóstico, ánimo y respuestas cortas: respóndelos tú, sin delegar.

      # Honestidad con lo que hace la pantalla
      - Al delegar, ANUNCIA la intención en futuro ("voy a graficarlo", "te lo anoto en el documento"). Nunca uses "listo", "ya lo grafiqué" o "ya está escrito" al delegar.
      - Confirma que algo quedó hecho solo cuando el resultado de la delegación lo diga. Mientras llega, sigue explicando de palabra.
      - Si el resultado dice que falló, o recibes un aviso del sistema de que no se ejecutó, díselo al alumno ("no pude graficarlo") y vuelve a delegarlo una sola vez. Nunca finjas que se hizo.

      # Reglas de voz
      - Habla en texto plano corto: una a tres frases por turno, una sola pregunta a la vez.
      - No leas en voz alta markdown, tablas ni fórmulas largas.
      - Di los resultados numéricos de forma natural.

      # Enseñanza
      - Si el alumno se atasca, reexplica por otro camino con otro ejemplo concreto; nunca lo derivas con nadie más.
      - Temas de secundaria: matemática, comunicación, ciencias, historia, inglés. Si el pedido es de otro nivel, redirige amablemente.
      - Anima al alumno: reconocer el progreso es parte del trabajo.
    ` +
      classBrief(context) +
      guideBrief(context) +
      memorySection(memoryBrief),
    llm: new inference.DuplexModel({
      model: 'openai/gpt-live-1',
      voice: 'marin',
      modelOptions: {
        delegation: 'responses',
        responsesOptions: {
          instructions: backendInstructions(context, memoryBrief),
          parallelToolCalls: true,
        },
      },
    }),
    tools: [
      tool({
        name: 'docWrite',
        description:
          'Escribe o reemplaza una sección del documento compartido de la clase. Úsalo mientras enseñas para dejar la explicación escrita.',
        parameters: z.object({
          section: z.string().describe('Título de la sección del documento'),
          markdown: z.string().describe('Contenido en markdown: explicación, tablas o esquemas'),
        }),
        execute: ({ section, markdown }) =>
          runAction(hooks, {
            tool: 'docWrite',
            label: `Escrito en el documento: ${section}`,
            msg: { type: 'doc_op', op: 'write', section, markdown },
            topic: 'aulaquipu:doc',
            log: { section },
            ok: `OK: sección "${section}" escrita en el documento.`,
          }),
      }),
      tool({
        name: 'docAppendTable',
        description:
          'Agrega una tabla al documento compartido, por ejemplo para resúmenes o comparaciones.',
        parameters: z.object({
          title: z.string().describe('Título de la tabla'),
          columns: z.array(z.string()).describe('Encabezados de columna'),
          rows: z.array(z.array(z.string())).describe('Filas de la tabla'),
        }),
        execute: ({ title, columns, rows }) =>
          runAction(hooks, {
            tool: 'docAppendTable',
            label: `Tabla agregada al documento: ${title}`,
            msg: { type: 'doc_op', op: 'append_table', title, columns, rows },
            topic: 'aulaquipu:doc',
            log: { title },
            ok: `OK: tabla "${title}" agregada al documento.`,
          }),
      }),
      tool({
        name: 'graphSet',
        description:
          'Dibuja o actualiza una curva en el graficador del aula mientras explicas matemática.',
        parameters: z.object({
          id: z.string().describe('Identificador de la curva, por ejemplo "f1"'),
          latex: z.string().describe('Expresión en LaTeX, por ejemplo "y=x^2"'),
          color: z
            .string()
            .regex(/^#[0-9a-fA-F]{6}$/)
            .optional()
            .describe('Color opcional en hexadecimal, por ejemplo "#7C6BF2"'),
        }),
        execute: ({ id, latex, color }) =>
          runAction(hooks, {
            tool: 'graphSet',
            label: `Graficado ${prettyLatex(latex)}`,
            msg: { type: 'graph_op', op: 'set', id, latex, color },
            topic: 'aulaquipu:graph',
            log: { id, latex, color },
            ok: `OK: curva ${id} dibujada en el graficador.`,
          }),
      }),
      tool({
        name: 'graphRemove',
        description: 'Quita una curva del graficador del aula.',
        parameters: z.object({
          id: z.string().describe('Identificador de la curva a quitar'),
        }),
        execute: ({ id }) =>
          runAction(hooks, {
            tool: 'graphRemove',
            label: `Quitada del graficador: ${id}`,
            msg: { type: 'graph_op', op: 'remove', id },
            topic: 'aulaquipu:graph',
            log: { id },
            ok: `OK: curva ${id} quitada del graficador.`,
          }),
      }),
      tool({
        name: 'memorySave',
        description:
          'Guarda en la memoria de clases un hecho duradero sobre el alumno: qué domina, qué le cuesta, su nivel o acuerdos. Úsalo durante la clase y al cerrarla.',
        parameters: z.object({
          content: z.string().describe('Hecho breve y concreto sobre el progreso del alumno'),
        }),
        execute: async ({ content }) => {
          const saved = await hooks.remember(content);
          await hooks.logEvent('tool_call', { tool: 'memorySave', saved });
          return saved
            ? 'Progreso guardado en la memoria de clases.'
            : 'La memoria de clases no está disponible; continúa sin guardar.';
        },
      }),
      tool({
        name: 'memoryRecall',
        description:
          'Busca en la memoria de clases qué se trabajó o le costó al alumno en clases anteriores.',
        parameters: z.object({
          query: z.string().describe('Qué quieres saber del alumno'),
        }),
        execute: async ({ query }) => {
          const brief = await hooks.recall(query);
          await hooks.logEvent('tool_call', { tool: 'memoryRecall', query });
          return brief || 'Sin registros de clases anteriores.';
        },
      }),
    ],
  });
}
