// Materias para agrupar temas en pantalla. Los temas de la base no tienen materia, así que se
// deducen por palabras clave; lo que no encaja va a "Otros". Solo afecta la presentación.

import type { Level } from "@/lib/types";

export interface Subject {
  id: string;
  name: string;
  emoji: string;
  /** Fondo suave de la tarjeta de la materia */
  tone: string;
  keywords: string[];
}

export const SUBJECTS: Subject[] = [
  {
    id: "mate",
    name: "Matemática",
    emoji: "🔢",
    tone: "bg-[#e3ddff]",
    keywords: ["fraccion", "ecuacion", "proporcion", "porcentaje", "probabilidad", "derivada", "geometr", "funcion", "trigonometr", "algebra", "estadist", "numero"],
  },
  {
    id: "comu",
    name: "Comunicación",
    emoji: "📖",
    tone: "bg-[#ffe2cf]",
    keywords: ["lectora", "lectura", "redaccion", "gramatica", "ensayo", "ortograf", "texto", "literatura"],
  },
  {
    id: "ciencia",
    name: "Ciencias",
    emoji: "🧪",
    tone: "bg-[#cdf3e5]",
    keywords: ["biolog", "quimic", "cinemat", "fisic", "celula", "ciencia", "movimiento"],
  },
  { id: "ingles", name: "Inglés", emoji: "🗣️", tone: "bg-[#d9e9ff]", keywords: ["ingles", "english"] },
  { id: "historia", name: "Historia", emoji: "🏛️", tone: "bg-[#fff0c4]", keywords: ["historia", "geograf", "civica", "peru"] },
  { id: "tec", name: "Tecnología", emoji: "💻", tone: "bg-[#f3e7d3]", keywords: ["programacion", "codigo", "python", "computacion"] },
];

export const OTHER_SUBJECT: Subject = { id: "otros", name: "Otro tema", emoji: "✍️", tone: "bg-muted", keywords: [] };

const fold = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

export function subjectOf(topicName: string): Subject {
  const t = fold(topicName);
  return SUBJECTS.find((s) => s.keywords.some((k) => t.includes(k))) ?? OTHER_SUBJECT;
}

/** Temas agrupados por materia, en el orden de SUBJECTS (y "Otros" al final si hay). */
export function groupBySubject<T extends { name: string }>(topics: T[]): { subject: Subject; topics: T[] }[] {
  const groups = new Map<string, { subject: Subject; topics: T[] }>();
  for (const t of topics) {
    const subject = subjectOf(t.name);
    const g = groups.get(subject.id) ?? { subject, topics: [] };
    g.topics.push(t);
    groups.set(subject.id, g);
  }
  return [...SUBJECTS, OTHER_SUBJECT].map((s) => groups.get(s.id)).filter((g): g is { subject: Subject; topics: T[] } => !!g);
}


/** Nivel en palabras de un alumno (el valor guardado sigue siendo basico/intermedio/avanzado). */
export const LEVEL_FRIENDLY: Record<Level, { label: string; emoji: string; hint: string }> = {
  basico: { label: "Lo entiendo", emoji: "🙂", hint: "Puedo explicar lo básico" },
  intermedio: { label: "Lo domino", emoji: "💪", hint: "Resuelvo ejercicios sin problema" },
  avanzado: { label: "Soy pro", emoji: "🏆", hint: "Saco 20 y ayudo a otros" },
};
