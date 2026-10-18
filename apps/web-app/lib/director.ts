// Director de la clase: tipos compartidos (web + servidor) y validación pura de las acciones que
// propone el modelo. Nada de aquí toca la red ni el entorno, así el mock puede reutilizarlo.

/** Acción que recibe el aula. El quiz nunca incluye la clave de respuestas. */
export type DirectorAction =
  | { type: "graph_set"; id: string; latex: string; color?: string }
  | { type: "graph_clear"; ids: string[] }
  | { type: "quiz"; id: string; question: string; options: string[] }
  | { type: "image"; url: string; caption: string; credit: string };

export interface DirectorInput {
  source: "student" | "tutor";
  text: string;
  /** Últimas líneas del chat (cortas), de la más vieja a la más nueva. */
  context?: string[];
}

export interface DirectorResult {
  actions: DirectorAction[];
}

export interface QuizVerdict {
  correct: boolean;
  correctIndex: number;
  explanation: string;
}

/** Acción tal como la propone el modelo, ya validada; el servidor le asigna ids y guarda la clave. */
export type RawAction =
  | { type: "graph_set"; latex: string; color?: string }
  | { type: "graph_clear" }
  | { type: "quiz"; question: string; options: string[]; correctIndex: number; explanation: string }
  | { type: "image"; query: string };

export const MAX_TEXT = 600;
export const MAX_CONTEXT_LINES = 6;
export const MAX_CONTEXT_CHARS = 200;

const LATEX_COMMANDS = new Set([
  "frac", "sqrt", "pi", "cdot", "left", "right", "le", "ge", "leq", "geq", "sin", "cos", "tan", "ln", "log", "theta", "times", "div", "neq",
]);
// Solo caracteres de una expresión de Desmos; sin "$", comillas, saltos ni símbolos raros
const LATEX_CHARS = /^[A-Za-z0-9\s+\-*/^_=<>(){}[\],.|\\]+$/;

export function sanitizeLatex(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const latex = value.trim().replace(/\\\\/g, "\\");
  if (!latex || latex.length > 120 || !LATEX_CHARS.test(latex)) return null;
  for (const m of latex.matchAll(/\\([A-Za-z]*)/g)) if (!LATEX_COMMANDS.has(m[1])) return null;
  if (/\\(?![A-Za-z])/.test(latex)) return null;
  return latex;
}

export const sanitizeColor = (v: unknown): string | undefined => (typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v) ? v : undefined);

const text = (v: unknown, max: number, min = 1): string | null => {
  if (typeof v !== "string") return null;
  const t = v.replace(/\s+/g, " ").trim();
  return t.length >= min && t.length <= max ? t : null;
};

function sanitizeOne(raw: unknown): RawAction | null {
  if (!raw || typeof raw !== "object") return null;
  const a = raw as Record<string, unknown>;
  switch (a.type) {
    case "graph_set": {
      const latex = sanitizeLatex(a.latex);
      if (!latex) return null;
      const color = sanitizeColor(a.color);
      return { type: "graph_set", latex, ...(color ? { color } : {}) };
    }
    case "graph_clear":
      return { type: "graph_clear" };
    case "quiz": {
      const question = text(a.question, 220, 5);
      const explanation = text(a.explanation, 320, 1) ?? "";
      const options = Array.isArray(a.options) ? a.options.map((o) => text(o, 110)) : [];
      const idx = a.correct_index ?? a.correctIndex;
      if (!question || options.length < 2 || options.length > 4 || options.some((o) => o === null)) return null;
      const opts = options as string[];
      if (new Set(opts.map((o) => o.toLowerCase())).size !== opts.length) return null;
      if (typeof idx !== "number" || !Number.isInteger(idx) || idx < 0 || idx >= opts.length) return null;
      return { type: "quiz", question, options: opts, correctIndex: idx, explanation };
    }
    case "image": {
      const query = text(a.query, 100, 3);
      return query ? { type: "image", query } : null;
    }
    default:
      return null;
  }
}

/** Descarta lo inválido; como máximo 4 acciones y un solo quiz por llamada. */
export function sanitizeActions(raw: unknown): RawAction[] {
  if (!Array.isArray(raw)) return [];
  const out: RawAction[] = [];
  let quizzes = 0;
  for (const item of raw) {
    const a = sanitizeOne(item);
    if (!a) continue;
    if (a.type === "quiz" && quizzes++ >= 1) continue;
    out.push(a);
    if (out.length >= 4) break;
  }
  return out;
}

/** Entrada del cliente → forma segura (texto ≤ 600, contexto ≤ 6 líneas cortas). */
export function parseDirectorInput(body: Record<string, unknown>): DirectorInput | null {
  const source = body.source === "tutor" ? "tutor" : body.source === "student" ? "student" : null;
  const t = typeof body.text === "string" ? body.text.replace(/\s+/g, " ").trim() : "";
  if (!source || t.length < 2 || t.length > MAX_TEXT) return null;
  const context = Array.isArray(body.context)
    ? body.context.filter((l): l is string => typeof l === "string").slice(-MAX_CONTEXT_LINES).map((l) => l.replace(/\s+/g, " ").trim().slice(0, MAX_CONTEXT_CHARS))
    : [];
  return { source, text: t, context: context.filter(Boolean) };
}

// ---------- director de mentira (modo mock, sin OpenAI) ----------

function toLatex(expr: string): string {
  let e = expr
    .toLowerCase()
    .replace(/[?.!¿¡]+/g, " ")
    .replace(/\by\s+igual\s+a\b/g, "y=")
    .replace(/\bal cuadrado\b/g, "^{2}")
    .replace(/\bal cubo\b/g, "^{3}")
    .replace(/\bmás\b/g, "+")
    .replace(/\bmenos\b/g, "-")
    .replace(/\bpor\b/g, "*")
    .replace(/\bentre\b/g, "/")
    .replace(/\^\s*(\d+)/g, "^{$1}")
    .replace(/\s+\^/g, "^")
    .replace(/\s+/g, " ")
    .trim();
  e = e.replace(/(\d+)\s*\/\s*(\d+)\s*x/g, "\\frac{$1}{$2}x");
  if (!e.includes("=")) e = `y=${e}`;
  return e.replace(/\s*([=+\-])\s*/g, "$1");
}

const MOCK_QUIZ: RawAction = {
  type: "quiz",
  question: "Un auto recorre 120 km en 2 horas. ¿Cuál es su velocidad media?",
  options: ["40 km/h", "60 km/h", "120 km/h", "240 km/h"],
  correctIndex: 1,
  explanation: "La velocidad media es distancia entre tiempo: 120 km ÷ 2 h = 60 km/h.",
};

/** Detecta pedidos obvios ("grafica y = x al cuadrado", "hazme una pregunta") para el modo mock. */
export function mockDirect(input: DirectorInput): RawAction[] {
  const t = input.text.toLowerCase();
  const graph = t.match(/\b(?:grafica|grafícame|graficar|graficame|dibuja)\b\s*(?:la\s+|una\s+)?(?:función|funcion|recta|parábola|parabola)?\s*(.+)$/);
  if (graph && /[xy]/.test(graph[1])) {
    const latex = sanitizeLatex(toLatex(graph[1]));
    if (latex) return [{ type: "graph_set", latex }];
  }
  if (/\b(borra|limpia|quita)\b.*\b(gr[áa]fic|plano|funci)/.test(t)) return [{ type: "graph_clear" }];
  if (/\b(pregunta|quiz)\b|opci[óo]n m[úu]ltiple/.test(t)) return [MOCK_QUIZ];
  return [];
}
