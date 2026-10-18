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
  | { type: "doc_append_table"; actor: string; rows: string[][]; title?: string }
  /** Herramienta docWrite del agente: escribe o reemplaza una sección "## título". */
  | { type: "doc_section"; actor: string; section: string; markdown: string }
  | { type: "graph_set"; actor: string; id: string; latex: string; color?: string }
  | { type: "graph_remove"; actor: string; id: string }
  | { type: "board_draw"; actor: string; stroke: Stroke }
  | { type: "board_clear"; actor: string; target: "board" | "notebook" }
  | { type: "ask_student"; actor: string; question: string }
  | { type: "focus_tool"; actor: string; tool: ClassroomTool }
  | { type: "speech"; actor: string; text: string; partial?: boolean; segment?: string }
  | { type: "speaking"; actor: string; on: boolean }
  | { type: "chat"; actor: string; name: string; text: string }
  | { type: "notebook_image"; actor: string; url: string }
  | { type: "session_event"; actor: string; kind: string; payload: Record<string, unknown> };

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
