// Catálogo GRATIS del creador de avatar (onboarding). Lo usan la UI y el servidor: el
// servidor solo acepta en avatar_config lo que está aquí. Lo que se vende va por la tienda
// (skins + profile_skins), nunca por avatar_config.
// Los ids salen de figuredata.json (sets que existen completos en las librerías base).

import type { AvatarConfig } from "@/lib/types";

export interface CatalogOption {
  /** Valor guardado en avatar_config.slots[slot] (ver parseItem en lib/figure.ts). */
  item: string;
  label: string;
}

export interface CatalogCategory {
  slot: "hr" | "ch" | "lg" | "sh";
  label: string;
  options: CatalogOption[];
}

const hair = (id: number, label: string): CatalogOption => ({ item: `hh_human_hair#hr${id}-hrb${id}`, label });

export const BASE_CATEGORIES: CatalogCategory[] = [
  {
    slot: "hr",
    label: "Pelo",
    options: [
      hair(1, "Clásico"), hair(2, "Liso"), hair(5, "Erizado"), hair(16, "Flequillo"),
      hair(24, "Puntas"), hair(23, "Rulos"), hair(4, "Afro"), hair(3, "Melena"),
      hair(6, "Cola"), hair(11, "Moño"), hair(26, "Hongo"), hair(29, "Trenza"),
      hair(509, "Rockero"), hair(34, "Largo"),
    ],
  },
  {
    slot: "ch",
    label: "Polo",
    options: [
      { item: "hh_human_shirt#ch1-ls1-rs1", label: "Básico" },
      { item: "hh_human_shirt#ch3-ls1-rs1", label: "Camisa" },
      { item: "hh_human_shirt#ch8-ls1-rs1", label: "Rayas" },
      { item: "hh_human_shirt#ch10-ls1-rs1", label: "Polera" },
      { item: "hh_human_shirt#ch100-ls1-rs1-ch1100", label: "Cuello V" },
      { item: "hh_human_shirt#ch502-ls1-rs1", label: "Estrella" },
      { item: "hh_human_shirt#ch200-ls1-rs1-ch1200", label: "Montañas" },
      { item: "hh_human_shirt#ch202-ls1-rs1-ch1202", label: "Chaleco" },
      { item: "hh_human_shirt#ch503-ls1-rs1", label: "Corazón" },
      { item: "hh_human_shirt#ch505-ls1-rs1", label: "Botones" },
      { item: "hh_human_shirt#ch21-ls1-rs1-ch1021", label: "Corbata" },
      { item: "hh_human_shirt#ch201-ls1-rs1", label: "Cruzado" },
    ],
  },
  {
    slot: "lg",
    label: "Pantalón",
    options: [
      { item: "hh_human_leg#1", label: "Jean" },
      { item: "hh_human_leg#4", label: "Buzo" },
      { item: "hh_human_leg#201", label: "Short" },
      { item: "hh_human_leg#6", label: "Bolsillos" },
      { item: "hh_human_leg#3", label: "Falda" },
      { item: "hh_human_leg#5", label: "Falda larga" },
      { item: "hh_human_leg#lg7-lg1007", label: "Vestido" },
    ],
  },
  {
    slot: "sh",
    label: "Zapatos",
    options: [1, 2, 3, 4, 5, 6, 7, 8].map((id) => ({ item: `hh_human_shoe#${id}`, label: `Modelo ${id}` })),
  },
];

/** Accesorios de regalo al empezar; el resto se compra en la tienda. slot = tipo de figura. */
export const STARTER_ACCESSORIES: (CatalogOption & { slot: "ha" | "ea" | "ca" })[] = [
  { slot: "ha", item: "hat_U_camocap", label: "Gorra" },
  { slot: "ea", item: "acc_eye_U_brownglasses", label: "Lentes" },
  { slot: "ea", item: "acc_eye_U_bigshades", label: "Lentes de sol" },
  { slot: "ca", item: "acc_chest_U_backpack", label: "Mochila" },
];

export const SKIN_TONES = ["#FFDBC1", "#FFCB98", "#CA9072", "#B87560", "#9C543F", "#644628"];
export const HAIR_COLORS = ["#1E1A18", "#5C4332", "#9A5D2E", "#DFA66F", "#F6D059", "#9E3D3B", "#234CAF"];
export const CLOTHES_COLORS = ["#ED5C50", "#4F7AA2", "#6BAE61", "#E7B027", "#7E5B90", "#75B7C7", "#595959", "#DDDDDD"];

export const BODY_ITEM = "hh_human_body";

/** Avatar inicial para quien aún no armó el suyo. */
export const DEFAULT_AVATAR: AvatarConfig = {
  slots: {
    hh: BODY_ITEM,
    hr: BASE_CATEGORIES[0].options[0].item,
    ch: BASE_CATEGORIES[1].options[0].item,
    lg: BASE_CATEGORIES[2].options[0].item,
    sh: BASE_CATEGORIES[3].options[0].item,
  },
  skin: SKIN_TONES[1],
  hair: HAIR_COLORS[1],
  color: CLOTHES_COLORS[1],
};

const ALLOWED = new Map<string, Set<string>>([
  ["hh", new Set([BODY_ITEM])],
  ...BASE_CATEGORIES.map((c) => [c.slot, new Set(c.options.map((o) => o.item))] as [string, Set<string>]),
]);
for (const a of STARTER_ACCESSORIES) {
  ALLOWED.set(a.slot, new Set([...(ALLOWED.get(a.slot) ?? []), a.item]));
}

const COLORS = { skin: SKIN_TONES, hair: HAIR_COLORS, color: CLOTHES_COLORS } as const;

/**
 * Valida un avatar del creador: solo piezas y colores del catálogo gratis.
 * Devuelve el config limpio o el motivo del rechazo.
 */
export function sanitizeAvatar(input: unknown): { ok: true; config: AvatarConfig } | { ok: false; error: string } {
  if (!input || typeof input !== "object") return { ok: false, error: "Avatar inválido." };
  const raw = input as Record<string, unknown>;
  const slots: Record<string, string> = {};
  const rawSlots = raw.slots && typeof raw.slots === "object" ? (raw.slots as Record<string, unknown>) : {};
  for (const [slot, item] of Object.entries(rawSlots)) {
    if (item === null || item === undefined || item === "") continue;
    if (typeof item !== "string" || !ALLOWED.get(slot)?.has(item)) {
      return { ok: false, error: "Esa pieza no está disponible en el creador de avatar." };
    }
    slots[slot] = item;
  }
  slots.hh = BODY_ITEM;
  const config: AvatarConfig = { slots };
  for (const key of ["skin", "hair", "color"] as const) {
    const v = raw[key];
    if (v === undefined) continue;
    if (typeof v !== "string" || !(COLORS[key] as readonly string[]).includes(v)) {
      return { ok: false, error: "Ese color no está disponible." };
    }
    config[key] = v;
  }
  return { ok: true, config };
}
