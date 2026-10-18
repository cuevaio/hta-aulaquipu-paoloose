import { Agent, dedent, inference, tool } from '@livekit/agents';
import { z } from 'zod';

export type TutorHooks = {
  publish: (msg: Record<string, unknown>, topic: string) => Promise<void>;
  logEvent: (kind: string, payload: Record<string, unknown>) => Promise<void>;
};

export function createAgent(hooks: TutorHooks) {
  return Agent.create({
    instructions: dedent`
      Eres Quipu, tutor del AulaQuipu: enseñas a alumnos de secundaria en Perú, en español peruano, cálido y claro.

      # Flujo de clase
      1. Saluda brevemente y pregunta qué tema quieren trabajar hoy.
      2. Diagnostica el nivel con dos o tres preguntas cortas antes de explicar.
      3. Enseña por pasos cortos. Mientras explicas, DEBES usar las herramientas: escribe la explicación en el documento compartido con docWrite, y usa graphSet cuando hay funciones, gráficas o geometría. El documento es la pizarra del alumno: lo que dices debe quedar escrito ahí.
      4. Después de cada idea clave, propone un ejercicio de práctica y espera la respuesta.
      5. Cierra con un resumen hablado breve y un docWrite con la sección "Resumen" y qué practicar.

      # Reglas de voz
      - Habla en texto plano corto: una a tres frases por turno, una sola pregunta a la vez.
      - El markdown, las tablas y las fórmulas van al documento con las herramientas; no los leas en voz alta.
      - Deletrea resultados numéricos de forma natural y no menciones nombres de herramientas ni código.

      # Enseñanza
      - Si el alumno se atasca, reexplica por otro camino con otro ejemplo concreto; nunca lo derivas con nadie más.
      - Temas de secundaria: matemática, comunicación, ciencias, historia, inglés. Si el pedido es de otro nivel, redirige amablemente.
      - Anima al alumno: reconocer el progreso es parte del trabajo.
    `,
    llm: new inference.DuplexModel({ model: 'openai/gpt-live-1', voice: 'marin' }),
    tools: [
      tool({
        name: 'docWrite',
        description:
          'Escribe o reemplaza una sección del documento compartido de la clase. Úsalo mientras enseñas para dejar la explicación escrita.',
        parameters: z.object({
          section: z.string().describe('Título de la sección del documento'),
          markdown: z
            .string()
            .describe('Contenido en markdown: explicación, tablas o esquemas'),
        }),
        execute: async ({ section, markdown }) => {
          await hooks.publish(
            { type: 'doc_op', op: 'write', section, markdown },
            'aulaquipu:doc',
          );
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
        }),
        execute: async ({ id, latex }) => {
          await hooks.publish({ type: 'graph_op', op: 'set', id, latex }, 'aulaquipu:graph');
          await hooks.logEvent('tool_call', { tool: 'graphSet', id, latex });
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
