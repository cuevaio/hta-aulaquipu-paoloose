// Contrato de eventos del aula. Son las herramientas del tutor IA (§8.6) más
// los mensajes de presencia. Viajan por un ClassroomTransport: hoy un bus local,
// mañana el data channel de LiveKit (mismo JSON, mismo consumidor).

export type ClassroomTool = "doc" | "graph" | "board" | "notebook";

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
  | { type: "doc_append_table"; actor: string; rows: string[][] }
  | { type: "graph_set"; actor: string; id: string; latex: string; color?: string }
  | { type: "graph_remove"; actor: string; id: string }
  | { type: "board_draw"; actor: string; stroke: Stroke }
  | { type: "board_clear"; actor: string; target: "board" | "notebook" }
  | { type: "ask_student"; actor: string; question: string }
  | { type: "focus_tool"; actor: string; tool: ClassroomTool }
  | { type: "speech"; actor: string; text: string }
  | { type: "speaking"; actor: string; on: boolean }
  | { type: "chat"; actor: string; name: string; text: string }
  | { type: "session_event"; actor: string; kind: string; payload: Record<string, unknown> };

export function tableToMarkdown(rows: string[][]): string {
  if (!rows.length) return "";
  const [head, ...body] = rows;
  const line = (r: string[]) => `| ${r.join(" | ")} |`;
  return ["", line(head), line(head.map(() => "---")), ...body.map(line), ""].join("\n");
}
