// Mascotas guía del campus: no son alumnos. Les dices qué quieres hacer ("aprender", "enseñar"...)
// y te llevan: dibujan el camino en el piso y tu avatar camina hasta el lugar.

import type { FurniId } from "@/lib/campus/furni";

export type GuideTopicId = "aprender" | "ensenar" | "ia" | "quipus" | "moverse";

export interface GuideTopic {
  id: GuideTopicId;
  emoji: string;
  label: string;
  /** Lo que dice la mascota mientras te guía (o la respuesta, si no hay a dónde ir). */
  say: string;
  /** Objeto del mapa al que te lleva caminando; al llegar se abre. */
  go?: { target: string; place: string };
}

export const GUIDE_TOPICS: Record<GuideTopicId, GuideTopic> = {
  aprender: {
    id: "aprender",
    emoji: "📚",
    label: "Quiero aprender",
    say: "Ahí eliges la materia y el tema que te cuesta, y te armamos la clase.",
    go: { target: "lib-kiosk", place: "Mostrador de ayuda" },
  },
  ensenar: {
    id: "ensenar",
    emoji: "🎓",
    label: "Quiero enseñar",
    say: "Ahí ves quién necesita ayuda en tus temas. Acepta un pedido, da tu clase y gana quipus.",
    go: { target: "tut-board", place: "Tablón de pedidos" },
  },
  ia: {
    id: "ia",
    emoji: "✨",
    label: "Clase con IA ya",
    say: "Quipu, Ayni e Inti te explican por voz y en la pizarra, a cualquier hora.",
    go: { target: "ia-board-1", place: "Laboratorio IA" },
  },
  quipus: {
    id: "quipus",
    emoji: "🪢",
    label: "Mis quipus",
    say: "Los quipus son la moneda del cole: pagas clases y los ganas enseñando. Ahí ves tu tarjeta.",
    go: { target: "bank-atm", place: "Tesorería" },
  },
  moverse: {
    id: "moverse",
    emoji: "🕹️",
    label: "¿Cómo me muevo?",
    say: "Camina con las flechas o tocando el piso. Acércate a algo con cartel y presiona X.",
  },
};

export interface Guide {
  id: string;
  x: number;
  y: number;
  name: string;
  species: string;
  sprite: FurniId;
  scale: number;
  greeting: string;
  /** Sus opciones; las dos mascotas enseñan a aprender y a enseñar. */
  topics: GuideTopicId[];
}

/** Solo dos mascotas, para que no se confundan con alumnos. */
export const GUIDES: Guide[] = [
  {
    id: "guia-killa",
    x: 17,
    y: 26,
    name: "Killa",
    species: "Alpaca",
    sprite: "fest_ltd19_alpaca",
    scale: 0.95,
    greeting: "¡Hola! Soy Killa 🦙. ¿Qué quieres hacer? Te llevo.",
    topics: ["aprender", "ensenar", "moverse"],
  },
  {
    id: "guia-tika",
    x: 9,
    y: 13,
    name: "Tika",
    species: "Guacamayo",
    sprite: "br_c25_parrot4",
    scale: 1.7,
    greeting: "¡Hola, hola! Soy Tika 🦜. Dime a dónde y te llevo volando.",
    topics: ["ensenar", "aprender", "ia", "quipus"],
  },
];

export const guideById = (id: string) => GUIDES.find((g) => g.id === id);
