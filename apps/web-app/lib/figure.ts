// Formato de figura paperdoll (estilo Habbo/open-hotel): atlas + offsets por
// frame con sub-tipos (bd, hd, hr, ch…) y sets (estilos) por carpeta de item.
// Agnóstico al arte: sirve para sprites propios con esta misma estructura.

export const FIGURE_TYPES = [
  "hrb", "cp", "hh", "bd", "hd", "lg", "sh", "ch", "ls", "rs",
  "cc", "lc", "rc", "wa", "hr", "ha", "he", "ea", "fa", "fc", "ey", "ca",
] as const;

export type FigureType = (typeof FIGURE_TYPES)[number];
export type FigureSlot = FigureType;

/** Config canónica: items equipados por tipo + color base. */
export interface FigureConfig {
  slots: Partial<Record<FigureSlot, string>>;
  color?: string;
}

/** "aq.hh=hh_human_body.hd=hh_human_face@FFB547" — compacto para URLs. */
export function encodeFigure(cfg: FigureConfig): string {
  const parts = FIGURE_TYPES.filter((s) => cfg.slots[s]).map((s) => `${s}=${cfg.slots[s]}`);
  const color = cfg.color ? `@${cfg.color.replace("#", "")}` : "";
  return `aq.${parts.join(".")}${color}`;
}

export function decodeFigure(figure: string): FigureConfig {
  const [body, color] = figure.split("@");
  const slots: FigureConfig["slots"] = {};
  for (const token of body.split(".").slice(1)) {
    const [slot, item] = token.split("=");
    if ((FIGURE_TYPES as readonly string[]).includes(slot) && item) {
      slots[slot as FigureSlot] = item;
    }
  }
  return { slots, color: color ? `#${color}` : undefined };
}

// ---- Spritesheet manifest ----

export interface SpriteFrame {
  frame: { x: number; y: number; w: number; h: number };
  rotated?: boolean;
  trimmed?: boolean;
  spriteSourceSize?: { x: number; y: number; w: number; h: number };
  sourceSize?: { w: number; h: number };
}

export interface SpritesheetManifest {
  manifest: {
    version?: string;
    assets: Record<string, { offset: string }>;
    name?: string;
    aliases?: Record<string, unknown>;
  };
  spritesheet: {
    frames: Record<string, SpriteFrame>;
    meta?: Record<string, unknown>;
  };
}

/** "-21,84" → { x: -21, y: 84 } */
export function parseOffset(offset: string): { x: number; y: number } {
  const [x, y] = offset.split(",").map((n) => Number(n.trim()));
  return { x: Number.isFinite(x) ? x : 0, y: Number.isFinite(y) ? y : 0 };
}

// ---- Reglas de armado Habbo ----
// Nombres de asset: h_{acción}_{tipo}_{id}_{dirección}_{frame}. Cada pieza se dibuja en
// (ancla − offset). Solo existen las direcciones 0, 1, 2, 3 y 7: la 4, 5 y 6 son espejo de
// la 2, 1 y 0 con las piezas izquierda/derecha intercambiadas (HabboAvatarPartSets).

/** Centro horizontal de la figura respecto del ancla (eje del espejo). */
export const FIGURE_CENTER_X = 33;

const MIRRORED: Record<number, number> = { 4: 2, 5: 1, 6: 0 };

const FLIPPED_TYPE: Record<string, string> = {
  lh: "rh", rh: "lh", lhs: "rhs", rhs: "lhs", ls: "rs", rs: "ls",
  lc: "rc", rc: "lc", li: "ri", ri: "li",
};

// HabboAvatarGeometry.json (vertical): posición/radio de cada parte del cuerpo y radio de
// cada sub-tipo dentro de ella. El orden de pintura sale de la distancia a la cámara.
const GEOMETRY: { x: number; z: number; radius: number; items: Record<string, number> }[] = [
  { x: 0, z: 0, radius: 0.4, items: { bd: 0.01, bds: 0.01, sh: 0.02, lg: 0.03, ch: 0.04, ss: 0.04, cp: 0.045, wa: 0.05, cc: 0.06, ca: 0.07 } },
  { x: 0, z: -0.29, radius: 0.3, items: { li: 0.01 } },
  { x: 0, z: -0.29, radius: 0.3, items: { ri: 0.01 } },
  { x: -1, z: -0.51, radius: 0.5, items: { lh: 0.01, lhs: 0.01, ls: 0.02, lc: 0.025 } },
  { x: 1, z: -0.51, radius: 0.5, items: { rh: 0.01, rhs: 0.01, rs: 0.02, rc: 0.025 } },
  { x: 0, z: 0, radius: 0.5, items: { hd: 0.01, fc: 0.02, ey: 0.03, hr: 0.04, hrb: 0.05, fa: 0.06, ea: 0.07, ha: 0.08, he: 0.09 } },
];
const CAMERA_Z = 10;

const zCache = new Map<number, Map<string, [number, number]>>();

/** Clave de orden por sub-tipo para una dirección: menor = más atrás. */
function zOrder(direction: number): Map<string, [number, number]> {
  const cached = zCache.get(direction);
  if (cached) return cached;
  const a = (direction * Math.PI) / 4;
  const out = new Map<string, [number, number]>();
  for (const part of GEOMETRY) {
    const x = part.x * Math.cos(a) - part.z * Math.sin(a);
    const z = part.x * Math.sin(a) + part.z * Math.cos(a);
    const dist = Math.hypot(x, z - CAMERA_Z) - part.radius;
    for (const [type, radius] of Object.entries(part.items)) out.set(type, [-dist, radius]);
  }
  zCache.set(direction, out);
  return out;
}

interface AssetName {
  action: string;
  type: string;
  id: string;
  direction: number;
  frame: number;
}

function parseAssetName(name: string): AssetName | null {
  const t = name.split("_");
  if (t.length !== 6 || t[0] !== "h") return null;
  return { action: t[1], type: t[2], id: t[3], direction: Number(t[4]), frame: Number(t[5]) };
}

/** Id de parte a usar de una carpeta: el "1" si existe (figura base), si no el más completo. */
export function pickPartId(sheet: SpritesheetManifest): string | null {
  const counts = new Map<string, number>();
  for (const name of Object.keys(sheet.manifest.assets)) {
    const a = parseAssetName(name);
    if (a?.action === "std") counts.set(a.id, (counts.get(a.id) ?? 0) + 1);
  }
  if (counts.has("1")) return "1";
  let best: string | null = null;
  for (const [id, n] of counts) if (best === null || n > counts.get(best)!) best = id;
  return best;
}

/** Sub-tipos que la carpeta trae para ese id (sin la sombra "sd"). */
function partTypes(sheet: SpritesheetManifest, id: string): string[] {
  const types = new Set<string>();
  for (const name of Object.keys(sheet.manifest.assets)) {
    const a = parseAssetName(name);
    if (a && a.action === "std" && a.id === id && a.type !== "sd") types.add(a.type);
  }
  return [...types];
}

function lookupFrame(sheet: SpritesheetManifest, name: string): SpriteFrame | undefined {
  const frames = sheet.spritesheet.frames;
  const prefix = sheet.manifest.name;
  return (
    (prefix ? frames[`${prefix}_${name}.png`] : undefined) ??
    frames[`${name}.png`] ??
    Object.entries(frames).find(([key]) => key.endsWith(`_${name}.png`))?.[1]
  );
}

/**
 * Item equipado: "carpeta", "carpeta#115" (todas las piezas con id 115) o
 * "carpeta#ch215-ls2-rs2" (id por sub-tipo, como un set de figuredata).
 */
export interface FigureItem {
  folder: string;
  parts: [type: string, id: string][] | null;
  id: string | null;
}

export function parseItem(item: string): FigureItem {
  const [folder, sel] = item.split("#");
  if (!sel) return { folder, parts: null, id: null };
  if (/^\d+$/.test(sel)) return { folder, parts: null, id: sel };
  const parts = sel
    .split("-")
    .map((tok) => /^([a-z]+)(\d+)$/.exec(tok))
    .filter((m): m is RegExpExecArray => !!m)
    .map((m) => [m[1], m[2]] as [string, string]);
  return { folder, parts: parts.length ? parts : null, id: null };
}

export const ITEM_PATTERN = /^[A-Za-z0-9_]+(#(\d+|[a-z]+\d+(-[a-z]+\d+)*))?$/;

export interface FigureSource {
  sheet: SpritesheetManifest;
  item?: FigureItem;
}

export interface FigurePiece {
  layer: number;
  /** Sub-tipo lógico (decide orden y tinte); el asset puede ser el del lado opuesto. */
  type: string;
  name: string;
  sprite: SpriteFrame;
  /** Esquina superior izquierda en coordenadas de figura (ancla = 0,0). */
  x: number;
  y: number;
  w: number;
  h: number;
  flip: boolean;
}

/** Todas las piezas de la carpeta, en orden de id (= índice de la parte dentro del set). */
function allParts(sheet: SpritesheetManifest): [string, string][] {
  const seen = new Map<string, [string, string]>();
  for (const name of Object.keys(sheet.manifest.assets)) {
    const a = parseAssetName(name);
    if (a && a.action === "std" && a.type !== "sd") seen.set(`${a.type}_${a.id}`, [a.type, a.id]);
  }
  return [...seen.values()].sort((x, y) => Number(x[1]) - Number(y[1]));
}

function selectedParts(sheet: SpritesheetManifest, item: FigureItem | undefined): [string, string][] {
  if (item?.parts) return item.parts;
  if (item?.id) return partTypes(sheet, item.id).map((type) => [type, item.id!]);
  // Las librerías base (hh_human_*) traen muchos sets: se elige uno. Un accesorio es un solo
  // set, a veces de varias partes del mismo tipo (lentes = montura + vidrio): van todas.
  if (!item?.folder.startsWith("hh_")) return allParts(sheet);
  const id = pickPartId(sheet);
  return id ? partTypes(sheet, id).map((type) => [type, id]) : [];
}

/**
 * Piezas a dibujar, ya ordenadas de atrás hacia adelante. Si la acción pedida no existe
 * para un sub-tipo se usa la pose de pie (std, frame 0). `hidden` son las capas que ocultan
 * los items puestos (hiddenLayers); además el pelo completo "hrb" reemplaza al corto "hr",
 * que es la versión que va debajo de un gorro.
 */
export function resolveFigure(
  sources: FigureSource[],
  opts: { direction?: number; action?: string; frame?: number; hidden?: Iterable<string> } = {},
): FigurePiece[] {
  const direction = (((opts.direction ?? 2) % 8) + 8) % 8;
  const flip = direction in MIRRORED;
  const source = MIRRORED[direction] ?? direction;
  const order = zOrder(direction);
  const hidden = new Set(opts.hidden ?? []);
  const pieces: (FigurePiece & { z: [number, number] })[] = [];

  sources.forEach(({ sheet, item }, layer) => {
    for (const [type, id] of selectedParts(sheet, item)) {
      if (type === "sd" || hidden.has(type)) continue;
      const assetType = flip ? FLIPPED_TYPE[type] ?? type : type;
      const still = `h_std_${assetType}_${id}_${source}_0`;
      const candidates = [
        `h_${opts.action ?? "std"}_${assetType}_${id}_${source}_${opts.frame ?? 0}`,
        still,
        // Al extractor se le escapan algunas imágenes de pie; la de "hablar" suele ser la misma
        `h_spk_${assetType}_${id}_${source}_0`,
      ];
      for (const name of candidates) {
        const meta = sheet.manifest.assets[name] ?? sheet.manifest.assets[still];
        const sprite = meta && lookupFrame(sheet, name);
        if (!sprite) continue;
        const offset = parseOffset(meta.offset);
        const w = sprite.sourceSize?.w ?? sprite.frame.w;
        const h = sprite.sourceSize?.h ?? sprite.frame.h;
        const x = flip ? 2 * FIGURE_CENTER_X + offset.x - w : -offset.x;
        pieces.push({ layer, type, name, sprite, x, y: -offset.y, w, h, flip, z: order.get(type) ?? [0, 0] });
        break;
      }
    }
  });

  const fullHair = pieces.some((p) => p.type === "hrb");
  return pieces
    .filter((p) => !(fullHair && p.type === "hr"))
    .sort((a, b) => a.z[0] - b.z[0] || a.z[1] - b.z[1]);
}
