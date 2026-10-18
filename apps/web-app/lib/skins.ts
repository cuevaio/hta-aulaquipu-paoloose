// Traduce el catálogo de la base (palette / border / bg / icon) al aspecto que dibuja <Avatar>.
// Así la tienda funciona con los skins de database.sql y con los del modo demo.

import type { AvatarConfig, SkinMeta } from "@/lib/types";

const PALETTES: Record<string, { color: string }> = {
  sun: { color: "#FFB547" },
  condor: { color: "#5B6B8C" },
  andes: { color: "#2FD3A3" },
  quipu: { color: "#7C6BF2" },
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

/** Ítems de sprite (otro sistema de avatar en preparación): la app actual no los dibuja. */
export function isSpriteSkin(meta: SkinMeta | undefined): boolean {
  return meta?.sprite === true;
}

export function avatarColor(config: AvatarConfig): string {
  return config.color ?? (config.palette ? PALETTES[config.palette]?.color : undefined) ?? "#7C6BF2";
}

/** Skin de avatar: color base y accesorio de paletas antiguas. */
export function avatarLook(meta: SkinMeta | undefined): { color?: string; accessory?: SkinMeta["accessory"] } {
  if (!meta) return {};
  const palette = meta.palette ? PALETTES[meta.palette] : undefined;
  return { color: meta.color ?? palette?.color, accessory: meta.accessory };
}

export function frameOf(meta: SkinMeta | undefined): NonNullable<SkinMeta["frame"]> {
  return meta?.frame ?? (meta?.border ? BORDERS[meta.border] : undefined) ?? "basico";
}

export function decoOf(meta: SkinMeta | undefined): SkinMeta["deco"] | undefined {
  return meta?.deco ?? (meta?.bg ? BACKGROUNDS[meta.bg] : undefined);
}

export function badgeIcon(meta: SkinMeta | undefined): string {
  return (meta?.icon && ICONS[meta?.icon]) || "🏅";
}

export const FRAME_STYLES: Record<NonNullable<SkinMeta["frame"]>, string> = {
  basico: "ring-2 ring-white/80",
  dorado: "ring-4 ring-[#FFC94D] shadow-[0_0_0_2px_#C98A00]",
  andino: "ring-4 ring-[#E5484D] shadow-[0_0_0_3px_#FFC94D,0_0_0_5px_#2FD3A3]",
  arcoiris: "ring-0 p-[3px] bg-[conic-gradient(#E5484D,#FFC94D,#2FD3A3,#4FA3FF,#7C6BF2,#F06EAA,#E5484D)]",
};
