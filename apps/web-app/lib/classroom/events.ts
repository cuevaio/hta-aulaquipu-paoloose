// Contrato de eventos del aula. Son las herramientas del tutor IA (§8.6) más
// los mensajes de presencia. Viajan por un ClassroomTransport: hoy un bus local,
// mañana el data channel de LiveKit (mismo JSON, mismo consumidor).

export type ClassroomTool = "doc" | "graph" | "notebook" | "activity";

/** Eventos antiguos o de otros clientes pueden pedir la pestaña "board" (Pizarra): hoy es el Cuaderno. */
export function normalizeTool(tool: string): ClassroomTool | null {
  if (tool === "board") return "notebook";
  return tool === "doc" || tool === "graph" || tool === "notebook" || tool === "activity" ? tool : null;
}

/** Reacciones del avatar del tutor IA (herramienta emote del agente). */
export type TutorEmote = "celebrate" | "think" | "surprised" | "encourage";

export interface Point {
  x: number; // normalizado 0..1
  y: number;
}

export interface Stroke {
  id: string;
  color: string;
  width: number;
  points: Point[];
  target: "board" | "notebook";
}

export type ClassroomEvent =
  | { type: "doc_write"; actor: string; markdown: string; mode: "append" | "replace" }
  | { type: "doc_append_table"; actor: string; rows: string[][]; title?: string }
  /** Herramienta docWrite del agente: escribe o reemplaza una sección "## título". */
  | { type: "doc_section"; actor: string; section: string; markdown: string }
  | { type: "graph_set"; actor: string; id: string; latex: string; color?: string }
  | { type: "graph_remove"; actor: string; id: string }
  | { type: "board_draw"; actor: string; stroke: Stroke }
  | { type: "board_clear"; actor: string; target: "board" | "notebook" }
  /** Borrador: quita los trazos indicados (mismo destino). */
  | { type: "board_erase"; actor: string; target: "board" | "notebook"; ids: string[] }
  | { type: "ask_student"; actor: string; question: string }
  | { type: "focus_tool"; actor: string; tool: ClassroomTool | "board" }
  | { type: "speech"; actor: string; text: string; partial?: boolean; segment?: string }
  | { type: "speaking"; actor: string; on: boolean }
  | { type: "chat"; actor: string; name: string; text: string }
  | { type: "notebook_image"; actor: string; url: string }
  /** Tarjeta de opción múltiple del tutor (herramienta quizAsk). La clave de respuestas no viaja. */
  | { type: "quiz_ask"; actor: string; id: string; question: string; options: string[] }
  /** El alumno eligió una opción: va al agente, que la califica. */
  | { type: "quiz_answer"; actor: string; id: string; index: number }
  /** Veredicto del agente para una tarjeta. */
  | { type: "quiz_result"; actor: string; id: string; correct: boolean; correctIndex: number; explanation: string }
  | { type: "emote"; actor: string; kind: TutorEmote }
  /** El alumno terminó la clase: el agente debe escribir el resumen antes de que se cierre la sala. */
  | { type: "wrap_up"; actor: string; doc: string }
  /** El agente terminó (ok) o no pudo escribir el resumen. */
  | { type: "wrap_up_done"; actor: string; ok: boolean }
  /** Confirmación de una herramienta del agente que sí se ejecutó (chip del chat). */
  | { type: "tool_action"; actor: string; tool: string; label: string }
  | { type: "session_event"; actor: string; kind: string; payload: Record<string, unknown> };

/** Aplica un evento de pizarra a la lista de trazos (idempotente por id de trazo). */
export function applyBoardEvent(strokes: Stroke[], e: ClassroomEvent): Stroke[] {
  switch (e.type) {
    case "board_draw":
      return strokes.some((s) => s.id === e.stroke.id) ? strokes : [...strokes, e.stroke];
    case "board_clear":
      return strokes.filter((s) => s.target !== e.target);
    case "board_erase": {
      const ids = new Set(e.ids);
      return strokes.filter((s) => s.target !== e.target || !ids.has(s.id));
    }
    default:
      return strokes;
  }
}

export function tableToMarkdown(rows: string[][], title?: string): string {
  if (!rows.length) return "";
  const [head, ...body] = rows;
  const cell = (c: string) => String(c).replace(/\|/g, "\\|").replace(/\n/g, " ");
  const line = (r: string[]) => `| ${head.map((_, i) => cell(r[i] ?? "")).join(" | ")} |`;
  return ["", ...(title ? [`## ${title}`, ""] : []), line(head), line(head.map(() => "---")), ...body.map(line), ""].join("\n");
}

/** Escribe o reemplaza la sección "## {section}" del documento (contrato de docWrite del agente). */
export function upsertSection(doc: string, section: string, markdown: string): string {
  const title = section.trim().replace(/^#+\s*/, "");
  const block = `## ${title}\n\n${markdown.trim()}\n`;
  const lines = doc.split("\n");
  const norm = (t: string) => t.trim().toLowerCase();
  const start = lines.findIndex((l) => /^##\s+/.test(l) && norm(l.replace(/^##\s+/, "")) === norm(title));
  if (start === -1) return `${doc.replace(/\s*$/, "")}${doc.trim() ? "\n\n" : ""}${block}`;
  let end = lines.findIndex((l, i) => i > start && /^#{1,2}\s+/.test(l));
  if (end === -1) end = lines.length;
  return [...lines.slice(0, start), ...block.replace(/\n$/, "").split("\n"), "", ...lines.slice(end)].join("\n").replace(/\n{3,}/g, "\n\n");
}
