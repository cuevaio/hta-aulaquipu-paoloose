// Reglas del chat de proximidad del campus. Funciones puras: las usan tanto quien envía
// como quien recibe, porque nadie debe confiar en que el otro lado ya filtró.

import { roomAt } from "@/lib/campus/map";

export const CHAT_RADIUS = 4; // baldosas a la redonda
export const CHAT_RADIUS_TOLERANCE = 1; // margen de quien recibe: su copia de las posiciones llega con retraso
export const CHAT_MAX_LENGTH = 140;
export const BUBBLE_MS = 6000;
export const LOG_SIZE = 20;

const MIN_GAP_MS = 1500;
const BURST_MAX = 5;
const BURST_WINDOW_MS = 15000;

// Lista corta a propósito: es una primera barrera en el cliente, no moderación completa
const BAD_WORDS = new Set([
  "mierda", "puta", "puto", "putamadre", "carajo", "cojudo", "cojuda", "huevon", "huevona", "concha",
  "conchatumadre", "maricon", "idiota", "estupido", "estupida", "imbecil", "pendejo", "pendeja", "verga",
  "culo", "cabron", "cabrona", "mongolo", "retrasado", "retrasada", "zorra", "perra",
]);

const strip = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

const LINK = /(https?:|www\.|\b[a-z0-9-]+\.(com|net|org|pe|io|me|ly|gg|tv|co|xyz|app|link|info|ru|cl|ar)\b)/i;
const PHONE = /\d[\s.-]?\d[\s.-]?\d[\s.-]?\d[\s.-]?\d[\s.-]?\d[\s.-]?\d/; // 7 dígitos seguidos o casi
const EMAIL = /\S+@\S+/;

/** Reemplaza las groserías por *** conservando el resto del texto. */
export function maskBadWords(text: string): string {
  return text.replace(/[\p{L}]+/gu, (w) => {
    const base = strip(w);
    return BAD_WORDS.has(base) || (base.endsWith("s") && BAD_WORDS.has(base.slice(0, -1))) ? "***" : w;
  });
}

/** Limpia y valida lo que se va a enviar o mostrar. Devuelve el texto final o el motivo del rechazo. */
export function prepareMessage(raw: unknown): { ok: true; text: string } | { ok: false; error: string } {
  if (typeof raw !== "string") return { ok: false, error: "Mensaje inválido" };
  const text = raw.replace(/\p{Cc}/gu, " ").replace(/\s+/g, " ").trim();
  if (!text) return { ok: false, error: "Escribe un mensaje" };
  if (text.length > CHAT_MAX_LENGTH) return { ok: false, error: `Máximo ${CHAT_MAX_LENGTH} caracteres` };
  if (LINK.test(text) || EMAIL.test(text)) return { ok: false, error: "No se pueden enviar enlaces ni correos" };
  if (PHONE.test(text)) return { ok: false, error: "No compartas teléfonos ni datos personales" };
  return { ok: true, text: maskBadWords(text) };
}

/** Límite de envío: una pausa mínima entre mensajes y un tope por ráfaga. Guarda las marcas de tiempo en `sent`. */
export function rateLimit(sent: number[], now: number): string | null {
  while (sent.length && now - sent[0] > BURST_WINDOW_MS) sent.shift();
  if (sent.length && now - sent[sent.length - 1] < MIN_GAP_MS) return "Espera un momento antes de enviar otro";
  if (sent.length >= BURST_MAX) return "Escribes muy rápido, espera unos segundos";
  sent.push(now);
  return null;
}

interface Point {
  x: number;
  y: number;
}

/** ¿Están en la misma sala del campus y a menos de `radius` baldosas? Los pasillos y las paredes no cuentan. */
export function isNearby(a: Point, b: Point, radius = CHAT_RADIUS): boolean {
  const ra = roomAt(a.x, a.y);
  const rb = roomAt(b.x, b.y);
  return !!ra && ra.id === rb?.id && Math.hypot(a.x - b.x, a.y - b.y) <= radius;
}
