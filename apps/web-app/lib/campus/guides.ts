// Killa, la mascota guía del campus (no es una alumna). Le dices qué quieres hacer ("aprender",
// "enseñar"...) y te lleva: dibuja el camino en el piso y tu avatar camina hasta el lugar.

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
  name: string;
  species: string;
  sprite: FurniId;
  greeting: string;
  /** Lo que le puedes pedir. */
  topics: GuideTopicId[];
}

/** La mascota del cole: flota en una esquina del campus y te lleva a donde necesites. */
export const KILLA: Guide = {
  name: "Killa",
  species: "Alpaca",
  sprite: "fest_ltd19_alpaca",
  greeting: "¡Hola! Soy Killa 🦙. ¿Qué quieres hacer? Te llevo.",
  topics: ["aprender", "ensenar", "ia", "quipus", "moverse"],
};
