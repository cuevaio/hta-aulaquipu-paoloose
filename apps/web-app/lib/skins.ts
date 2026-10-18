// Traduce el catálogo de la base (palette / border / bg / icon) al aspecto que dibuja <Avatar>.
// Así la tienda funciona con los skins de database.sql y con los del modo demo.

import type { AvatarConfig, SkinMeta } from "@/lib/types";

const PALETTES: Record<string, { color: string; accessory?: SkinMeta["accessory"] }> = {
  sun: { color: "#FFB547", accessory: "lentes" },
  condor: { color: "#5B6B8C", accessory: "chullo" },
  andes: { color: "#2FD3A3" },
  quipu: { color: "#7C6BF2", accessory: "corona" },
};

const BORDERS: Record<string, NonNullable<SkinMeta["frame"]>> = {
  gold: "dorado",
  andes: "andino",
  rainbow: "arcoiris",
};

const BACKGROUNDS: Record<string, NonNullable<SkinMeta["deco"]>> = {
  stars: "cosmos",
  mountains: "andes",
  jungle: "selva",
};

const ICONS: Record<string, string> = { star: "⭐", trophy: "🏆", book: "📚", quipu: "🪢" };

export function avatarColor(config: AvatarConfig): string {
  return config.color ?? (config.palette ? PALETTES[config.palette]?.color : undefined) ?? "#7C6BF2";
}

/** Skin de avatar: puede cambiar el color del blob y/o ponerle un accesorio. */
export function avatarLook(meta: SkinMeta | undefined): { color?: string; accessory?: SkinMeta["accessory"] } {
  if (!meta) return {};
  const palette = meta.palette ? PALETTES[meta.palette] : undefined;
  return { color: meta.color ?? palette?.color, accessory: meta.accessory ?? palette?.accessory };
}

export function frameOf(meta: SkinMeta | undefined): NonNullable<SkinMeta["frame"]> {
  return meta?.frame ?? (meta?.border ? BORDERS[meta.border] : undefined) ?? "basico";
}

export function decoOf(meta: SkinMeta | undefined): SkinMeta["deco"] | undefined {
  return meta?.deco ?? (meta?.bg ? BACKGROUNDS[meta.bg] : undefined);
}

export function badgeIcon(meta: SkinMeta | undefined): string {
  return (meta?.icon && ICONS[meta.icon]) || "🏅";
}
