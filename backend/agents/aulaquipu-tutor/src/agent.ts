import { Agent, dedent, inference, tool } from '@livekit/agents';
import { z } from 'zod';

export type TutorHooks = {
  publish: (msg: Record<string, unknown>, topic: string) => Promise<void>;
  logEvent: (kind: string, payload: Record<string, unknown>) => Promise<void>;
};

export type ClassContext = {
  tutorName: string;
  style: string;
  focus: string;
  topic: string;
  studentName: string;
};

const DEFAULT_CONTEXT: ClassContext = {
  tutorName: 'Quipu',
  style: '',
  focus: '',
  topic: '',
  studentName: '',
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

// Instrucciones del modelo de razonamiento al que GPT-Live delega el trabajo. El modelo de voz
// NO ve las herramientas: solo decide qué delegar; este modelo es el que las llama
// (https://docs.livekit.io/agents/models/realtime/gpt-live/).
function backendInstructions(c: ClassContext): string {
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
      - Puedes llamar varias herramientas seguidas.
      - Responde al tutor con una sola frase corta que pueda decir en voz alta, sin markdown.
    ` + (c.topic ? `\nEl tema de la clase es: ${c.topic}.` : '')
  );
}

export function createAgent(hooks: TutorHooks, context: ClassContext = DEFAULT_CONTEXT) {
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
      - Mientras se escribe, di en una frase qué estás anotando ("te lo anoto en el documento").
      - Saludos, preguntas de diagnóstico, ánimo y respuestas cortas: respóndelos tú, sin delegar.
      - Nunca digas que ya escribiste o graficaste algo si no lo delegaste.

      # Reglas de voz
      - Habla en texto plano corto: una a tres frases por turno, una sola pregunta a la vez.
      - No leas en voz alta markdown, tablas ni fórmulas largas.
      - Di los resultados numéricos de forma natural.

      # Enseñanza
      - Si el alumno se atasca, reexplica por otro camino con otro ejemplo concreto; nunca lo derivas con nadie más.
      - Temas de secundaria: matemática, comunicación, ciencias, historia, inglés. Si el pedido es de otro nivel, redirige amablemente.
      - Anima al alumno: reconocer el progreso es parte del trabajo.
    ` + classBrief(context),
    llm: new inference.DuplexModel({
      model: 'openai/gpt-live-1',
      voice: 'marin',
      modelOptions: {
        delegation: 'responses',
        responsesOptions: { instructions: backendInstructions(context), parallelToolCalls: true },
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
        execute: async ({ section, markdown }) => {
          await hooks.publish({ type: 'doc_op', op: 'write', section, markdown }, 'aulaquipu:doc');
          await hooks.logEvent('tool_call', { tool: 'docWrite', section });
          return `Sección "${section}" escrita en el documento.`;
        },
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
        execute: async ({ title, columns, rows }) => {
          await hooks.publish(
            { type: 'doc_op', op: 'append_table', title, columns, rows },
            'aulaquipu:doc',
          );
          await hooks.logEvent('tool_call', { tool: 'docAppendTable', title });
          return `Tabla "${title}" agregada al documento.`;
        },
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
        execute: async ({ id, latex, color }) => {
          await hooks.publish({ type: 'graph_op', op: 'set', id, latex, color }, 'aulaquipu:graph');
          await hooks.logEvent('tool_call', { tool: 'graphSet', id, latex, color });
          return `Curva ${id} dibujada en el graficador.`;
        },
      }),
      tool({
        name: 'graphRemove',
        description: 'Quita una curva del graficador del aula.',
        parameters: z.object({
          id: z.string().describe('Identificador de la curva a quitar'),
        }),
        execute: async ({ id }) => {
          await hooks.publish({ type: 'graph_op', op: 'remove', id }, 'aulaquipu:graph');
          await hooks.logEvent('tool_call', { tool: 'graphRemove', id });
          return `Curva ${id} quitada del graficador.`;
        },
      }),
    ],
  });
}
