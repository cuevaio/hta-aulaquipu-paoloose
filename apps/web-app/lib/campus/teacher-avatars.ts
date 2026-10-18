// Look fijo de cada tutor IA en el campus: se arma con piezas del creador a partir de su id,
// así siempre se ve igual y sin guardar nada. La ropa toma el color de su persona.

import { useEffect, useState } from "react";
import { BASE_CATEGORIES, BODY_ITEM, HAIR_COLORS, SKIN_TONES } from "@/lib/avatar-catalog";
import type { AvatarConfig } from "@/lib/types";

export interface Pose {
  /** Acción Habbo: std (de pie), spk (hablando), sig (señala), wav (saluda), respect (reverencia). */
  action: string;
  frame: number;
}

interface Beat extends Pose {
  ms: number;
}

// Un tutor "da clase": explica, señala el pizarrón, saluda o hace una reverencia, y vuelve a
// explicar. Los cuadros que no existan para una pieza (p. ej. "sig" en el pelo) quedan de pie.
const SCRIPT: Beat[] = [
  { action: "spk", frame: 0, ms: 650 },
  { action: "spk", frame: 1, ms: 650 },
  { action: "spk", frame: 0, ms: 650 },
  { action: "std", frame: 0, ms: 900 },
  { action: "sig", frame: 0, ms: 1600 },
  { action: "std", frame: 0, ms: 600 },
  { action: "spk", frame: 1, ms: 650 },
  { action: "spk", frame: 0, ms: 650 },
  { action: "wav", frame: 0, ms: 380 },
  { action: "wav", frame: 1, ms: 380 },
  { action: "wav", frame: 0, ms: 380 },
  { action: "std", frame: 0, ms: 1200 },
  { action: "respect", frame: 0, ms: 800 },
  { action: "respect", frame: 1, ms: 600 },
  { action: "std", frame: 0, ms: 1000 },
];

const REDUCED = "(prefers-reduced-motion: reduce)";

/** Pose actual del tutor: avanza por SCRIPT con un desfase propio para que no se muevan a la vez. */
export function useTeacherPose(id: string): Pose {
  const [step, setStep] = useState(() => hash(id) % SCRIPT.length);
  useEffect(() => {
    if (window.matchMedia(REDUCED).matches) return;
    const beat = SCRIPT[step];
    const t = setTimeout(() => setStep((s) => (s + 1) % SCRIPT.length), beat.ms);
    return () => clearTimeout(t);
  }, [step]);
  const { action, frame } = SCRIPT[step];
  return { action, frame };
}

const option = (slot: string, labels: string[]) => {
  const cat = BASE_CATEGORIES.find((c) => c.slot === slot)!;
  return cat.options.filter((o) => labels.includes(o.label)).map((o) => o.item);
};

// Ropa de profe: camisas, corbata o chaleco; pantalón o falda larga
const HAIR = option("hr", ["Clásico", "Liso", "Melena", "Moño", "Cola", "Rulos", "Afro", "Largo"]);
const SHIRTS = option("ch", ["Camisa", "Corbata", "Chaleco", "Cuello V", "Botones"]);
const LEGS = option("lg", ["Jean", "Bolsillos", "Falda larga"]);
const SHOES = option("sh", ["Modelo 1", "Modelo 2", "Modelo 3"]);
const GLASSES = ["acc_eye_U_brownglasses", null, null];

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

export function teacherAvatar(id: string, color?: string): AvatarConfig {
  const h = hash(id);
  const pick = <T,>(list: T[], salt: number) => list[(h >>> salt) % list.length];
  const glasses = pick(GLASSES, 3);
  return {
    slots: {
      hh: BODY_ITEM,
      hr: pick(HAIR, 0),
      ch: pick(SHIRTS, 5),
      lg: pick(LEGS, 9),
      sh: pick(SHOES, 13),
      ...(glasses && { ea: glasses }),
    },
    skin: pick(SKIN_TONES, 17),
    hair: pick(HAIR_COLORS.slice(0, 5), 21),
    color: color ?? "#4F7AA2",
  };
}
