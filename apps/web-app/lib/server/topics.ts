// Normalización de pedidos en texto libre a un tema (§5.4): "no entiendo lo de las fracciones"
// y "sé enseñar fracciones" deben caer en el mismo tema. Con OPENAI_API_KEY usa un LLM con la
// lista de temas existentes; si no hay clave o falla, cae a palabras clave.

import { db, env, HttpError, must } from "@/lib/server/core";
import { cleanTopicName } from "@/lib/topic-name";

interface TopicRow {
  id: string;
  name: string;
  proposed_by: string | null;
  status: string;
}

const fold = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();

// Palabras clave por tema de la base (nombres en minúscula como en database.sql)
const KEYWORDS: Record<string, string[]> = {
  fracciones: ["fraccion", "denominador", "numerador", "quebrado", "mcm"],
  "ecuaciones de segundo grado": ["segundo grado", "cuadratica", "discriminante", "ecuacion", "despejar", "incognita"],
  proporcionalidad: ["proporcion", "regla de tres", "porcentaje", "%", "descuento", "razon"],
  "comprensión lectora": ["comprension", "lectura", "leer", "inferencia", "texto"],
  "redacción de textos": ["redaccion", "redactar", "conclusion", "parrafo", "escribir"],
  gramática: ["gramatica", "ortografia", "tilde", "sujeto", "predicado"],
  "biología celular": ["celula", "celular", "biologia", "mitosis", "organelo", "adn"],
  "química orgánica": ["quimica", "organica", "carbono", "hidrocarburo", "alcano"],
  cinemática: ["cinematica", "mru", "mrua", "velocidad", "aceleracion", "movimiento", "caida libre"],
  "historia del perú": ["historia", "inca", "independencia", "virreinato", "peru"],
  "inglés básico": ["ingles", "english", "verb to be", "pronunciacion"],
  "programación básica": ["programacion", "programar", "codigo", "python", "algoritmo"],
  probabilidad: ["probabilidad", "azar", "dado", "moneda", "estadistica"],
  "ensayo argumentativo": ["ensayo", "argumentativo", "tesis", "argumento"],
  derivadas: ["derivada", "calculo", "limite"],
};

const KEYWORDS_BY_NAME = new Map(Object.entries(KEYWORDS).map(([name, words]) => [fold(name), words.map(fold)]));

function byKeywords(text: string, topics: TopicRow[]): TopicRow | null {
  const q = fold(text);
  let best: { t: TopicRow; score: number } | null = null;
  for (const t of topics) {
    const name = fold(t.name);
    const words = KEYWORDS_BY_NAME.get(name) ?? [];
    let score = q.includes(name) ? 3 : 0;
    for (const w of words) if (q.includes(w)) score += 1;
    if (score > 0 && (!best || score > best.score)) best = { t, score };
  }
  return best?.t ?? null;
}

interface LlmVerdict {
  match: string | null;
  new_topic: string | null;
  secundaria: boolean;
}

async function askLlm(text: string, topics: TopicRow[]): Promise<LlmVerdict | null> {
  const key = env("OPENAI_API_KEY");
  if (!key) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: env("OPENAI_TOPIC_MODEL") ?? "gpt-4.1-mini",
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "Normalizas pedidos de alumnos de secundaria de Perú a un tema de estudio. " +
              'Responde SOLO JSON: {"match": nombre exacto de la lista o null, "new_topic": nombre corto en minúsculas si no hay match o null, "secundaria": true si es un tema escolar de secundaria}. ' +
              "Prefiere un tema existente si el pedido encaja razonablemente.",
          },
          { role: "user", content: `Temas existentes: ${JSON.stringify(topics.map((t) => t.name))}\nPedido: ${JSON.stringify(text)}` },
        ],
      }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const parsed = JSON.parse(json.choices?.[0]?.message?.content ?? "{}") as Partial<LlmVerdict>;
    return {
      match: typeof parsed.match === "string" ? parsed.match : null,
      new_topic: typeof parsed.new_topic === "string" ? parsed.new_topic : null,
      secundaria: parsed.secundaria !== false,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function createTopic(name: string, proposedBy: string): Promise<TopicRow> {
  const clean = name.trim().toLowerCase().slice(0, 60);
  const { data, error } = await db().from("topics").insert({ name: clean, proposed_by: proposedBy }).select().single();
  if (!error) return data as TopicRow;
  if (error.code !== "23505") throw new HttpError(500, "No pudimos registrar el tema.");
  // Otro alumno lo creó al mismo tiempo: usamos ese
  const exact = clean.replace(/[\\%_]/g, (c) => `\\${c}`);
  const rows = await must<TopicRow[]>(db().from("topics").select("*").ilike("name", exact).limit(1));
  if (!rows.length) throw new HttpError(500, "No pudimos registrar el tema.");
  if (rows[0].status === "flagged") throw new HttpError(400, "Ese tema no está disponible. Prueba con otro.");
  return rows[0];
}

export async function normalizeTopic(text: string, userId: string): Promise<TopicRow> {
  const topics = await must<TopicRow[]>(db().from("topics").select("*").eq("status", "active"));
  const verdict = await askLlm(text, topics);
  if (verdict) {
    if (!verdict.secundaria) {
      throw new HttpError(400, "Ese tema no parece de secundaria. Prueba con algo del colegio (mate, comunicación, ciencias, inglés…).");
    }
    const hit = verdict.match ? topics.find((t) => fold(t.name) === fold(verdict.match!)) : undefined;
    if (hit) return hit;
    if (verdict.new_topic) {
      const existing = topics.find((t) => fold(t.name) === fold(verdict.new_topic!));
      return existing ?? createTopic(verdict.new_topic, userId);
    }
  }
  return byKeywords(text, topics) ?? createTopic(cleanTopicName(text), userId);
}
