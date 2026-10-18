// Validación compartida de lo que edita el panel de administración (servidor y modo mock),
// para que las mismas reglas valgan en los dos. Devuelve el valor limpio o un mensaje en español.

import { ANNOUNCEMENT_MAX, type AiTutorInput, type AnnouncementInput, type SkinInput } from "@/lib/admin-types";
import type { SkinKind, SkinMeta } from "@/lib/types";

export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

export const SKIN_KINDS: { id: SkinKind; label: string }[] = [
  { id: "avatar", label: "Color del cuerpo" },
  { id: "head", label: "Diseño de cabeza" },
  { id: "frame", label: "Marco" },
  { id: "badge", label: "Insignia" },
  { id: "profile_deco", label: "Decoración de perfil" },
];

// Mismas claves que dibuja components/avatar.tsx y traduce lib/skins.ts
export const SKIN_ACCESSORIES = [
  "chullo",
  "lentes",
  "corona",
  "audifonos",
  "birrete",
  "flor",
  "gorra",
  "cresta",
  "gato",
  "lazo",
  "sombrero",
  "rulos",
  "antenas",
] as const satisfies readonly NonNullable<SkinMeta["accessory"]>[];
export const SKIN_FRAMES = ["basico", "dorado", "arcoiris", "andino"] as const;
export const SKIN_DECOS = ["andes", "cosmos", "selva"] as const;
export const SKIN_ICONS = ["star", "trophy", "book", "quipu"] as const;
export const AI_VOICES = ["warm", "bright", "calm"] as const;

const HEX = /^#[0-9a-fA-F]{6}$/;
const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const oneOf = <T extends string>(list: readonly T[], v: unknown): T | null => (typeof v === "string" && (list as readonly string[]).includes(v) ? (v as T) : null);
const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });

/** Nombre de tema: 2 a 60 caracteres. */
export function parseTopicName(raw: unknown): Parsed<string> {
  const name = text(raw);
  if (name.length < 2 || name.length > 60) return fail("El nombre del tema debe tener entre 2 y 60 caracteres.");
  return { ok: true, value: name };
}

export function parseSkinMeta(kind: SkinKind, raw: unknown): Parsed<SkinMeta> {
  const m = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  // avatar = color del cuerpo; head = diseño de cabeza (se combinan al equiparlos)
  if (kind === "avatar") {
    const color = text(m.color);
    if (!HEX.test(color)) return fail("El color del cuerpo debe ser hexadecimal, por ejemplo #7C6BF2.");
    return { ok: true, value: { color } };
  }
  if (kind === "head") {
    const accessory = oneOf(SKIN_ACCESSORIES, m.accessory);
    return accessory ? { ok: true, value: { accessory } } : fail("Elige el diseño de cabeza.");
  }
  if (kind === "frame") {
    const frame = oneOf(SKIN_FRAMES, m.frame);
    return frame ? { ok: true, value: { frame } } : fail("Elige el estilo del marco.");
  }
  if (kind === "badge") {
    const icon = oneOf(SKIN_ICONS, m.icon);
    return icon ? { ok: true, value: { icon } } : fail("Elige el ícono de la insignia.");
  }
  const deco = oneOf(SKIN_DECOS, m.deco);
  return deco ? { ok: true, value: { deco } } : fail("Elige el fondo de la decoración.");
}

export function parseSkinInput(raw: Record<string, unknown>): Parsed<SkinInput> {
  const name = text(raw.name);
  if (name.length < 2 || name.length > 40) return fail("El nombre del artículo debe tener entre 2 y 40 caracteres.");
  const kind = SKIN_KINDS.find((k) => k.id === raw.kind)?.id;
  if (!kind) return fail("Elige el tipo de artículo.");
  const price = Number(raw.price_quipus);
  if (!Number.isInteger(price) || price < 0 || price > 5000) return fail("El precio va de 0 a 5000 quipus.");
  const meta = parseSkinMeta(kind, raw.meta);
  if (!meta.ok) return meta;
  return { ok: true, value: { name, kind, price_quipus: price, meta: meta.value, active: raw.active !== false } };
}

export function parseAiTutorInput(raw: Record<string, unknown>): Parsed<AiTutorInput> {
  const name = text(raw.name);
  if (name.length < 2 || name.length > 30) return fail("El nombre del tutor debe tener entre 2 y 30 caracteres.");
  const emoji = text(raw.emoji);
  if (!emoji || emoji.length > 8) return fail("Elige un emoji para el tutor.");
  const color = text(raw.color);
  if (!HEX.test(color)) return fail("El color debe ser hexadecimal, por ejemplo #7C6BF2.");
  const tagline = text(raw.tagline);
  const style = text(raw.style);
  const focus = text(raw.focus);
  if (tagline.length > 60 || style.length > 60 || focus.length > 40) return fail("Descripción, estilo o especialidad demasiado largos.");
  const voice = oneOf(AI_VOICES, raw.voice);
  if (!voice) return fail("Elige una voz.");
  const price = Number(raw.price_quipus);
  if (!Number.isInteger(price) || price < 1 || price > 500) return fail("El precio va de 1 a 500 quipus.");
  const topics = Array.isArray(raw.topic_ids) ? raw.topic_ids : [];
  if (topics.length > 60 || topics.some((t) => typeof t !== "string" || !t)) return fail("Lista de temas inválida.");
  return {
    ok: true,
    value: {
      name,
      emoji,
      color,
      tagline,
      style,
      focus,
      voice,
      price_quipus: price,
      active: raw.active !== false,
      topic_ids: [...new Set(topics as string[])],
    },
  };
}

export function parseReason(raw: unknown, what = "El motivo"): Parsed<string> {
  const reason = text(raw);
  if (reason.length < 3 || reason.length > 140) return fail(`${what} debe tener entre 3 y 140 caracteres.`);
  return { ok: true, value: reason };
}

export function parseAnnouncement(raw: Record<string, unknown>): Parsed<AnnouncementInput> {
  const t = text(raw.text).replace(/\s+/g, " ");
  if (t.length < 1 || t.length > ANNOUNCEMENT_MAX) return fail(`El anuncio debe tener entre 1 y ${ANNOUNCEMENT_MAX} caracteres.`);
  const starts = typeof raw.starts_at === "string" ? Date.parse(raw.starts_at) : NaN;
  if (Number.isNaN(starts)) return fail("Fecha de inicio inválida.");
  let ends: string | null = null;
  if (raw.ends_at !== null && raw.ends_at !== undefined && raw.ends_at !== "") {
    const e = typeof raw.ends_at === "string" ? Date.parse(raw.ends_at) : NaN;
    if (Number.isNaN(e)) return fail("Fecha de fin inválida.");
    if (e <= starts) return fail("El anuncio debe terminar después de empezar.");
    ends = new Date(e).toISOString();
  }
  return { ok: true, value: { text: t, active: raw.active !== false, starts_at: new Date(starts).toISOString(), ends_at: ends } };
}

/** Texto de un reporte del chat: sin controles, una sola línea, hasta 140 caracteres (como el chat). */
export function parseReportText(raw: unknown): Parsed<string> {
  const t = (typeof raw === "string" ? raw : "").replace(/\p{Cc}/gu, " ").replace(/\s+/g, " ").trim();
  if (!t) return fail("No hay mensaje que reportar.");
  if (t.length > 140) return fail("El mensaje es demasiado largo.");
  return { ok: true, value: t };
}
