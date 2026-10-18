"use client";

// Avatar paperdoll a partir de sprites públicos (/figure/<carpeta>/...).
// Si no hay sprites cargados, el llamador hace fallback al blob SVG.

import { useEffect, useState } from "react";
import { SmokePuff } from "@/components/smoke-puff";
import type { Pose } from "@/lib/campus/teacher-avatars";
import { SpriteFigure, type FigureLayer, type FigureView } from "@/components/sprite-figure";
import { parseItem, type SpritesheetManifest } from "@/lib/figure";
import { FRAME_STYLES } from "@/lib/skins";
import type { SkinMeta } from "@/lib/types";
import { cn } from "@/lib/utils";

export interface SpriteSpec {
  /** Tipo de figura (hh, hd, hr, ch, lg, sh, ha, fa…). */
  slot: string;
  /** Carpeta, opcionalmente con selección de piezas: "hh_human_hair#hr5-hrb5". */
  item: string;
}

export interface FigureColors {
  /** Ropa y accesorios en escala de grises. */
  accent?: string;
  skin?: string;
  hair?: string;
}

const DEFAULT_COLORS = { accent: "#7C6BF2", skin: "#FFCB98", hair: "#5C4332" };
const SKIN_TYPES = new Set(["bd", "bds", "hd", "lh", "rh", "lhs", "rhs", "fc"]);
const HAIR_TYPES = new Set(["hr", "hrb"]);
const FIXED_TINTS: Record<string, string> = { lg: "#3050A0", sh: "#333333" };
const UNTINTED = new Set(["ey"]);

interface LoadedSheet {
  sheet: SpritesheetManifest;
  image: HTMLImageElement;
  imageUrl: string;
  gray: boolean;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`no se pudo cargar ${url}`));
    img.src = url;
  });
}

/** Las piezas Habbo "coloreables" vienen en grises: se tiñen. Las que ya traen color, no. */
function isGrayscale(img: HTMLImageElement): boolean {
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return false;
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  let opaque = 0;
  let gray = 0;
  for (let i = 0; i < data.length; i += 4 * 7) {
    if (data[i + 3] < 200) continue;
    opaque++;
    if (Math.max(data[i], data[i + 1], data[i + 2]) - Math.min(data[i], data[i + 1], data[i + 2]) < 12) gray++;
  }
  return opaque > 0 && gray / opaque > 0.8;
}

// Una carga por carpeta para toda la página (muchos avatares comparten las mismas librerías)
const sheetCache = new Map<string, Promise<LoadedSheet | null>>();

function loadSheet(folder: string): Promise<LoadedSheet | null> {
  let p = sheetCache.get(folder);
  if (!p) {
    const url = `/figure/${folder}/${folder}.json`;
    p = (async () => {
      try {
        const res = await fetch(url);
        if (!res.ok) {
          console.warn(`[avatar] manifest no encontrado (${res.status}): ${url}`);
          return null;
        }
        const sheet = (await res.json()) as SpritesheetManifest;
        if (!Object.keys(sheet.manifest?.assets ?? {}).length || !sheet.spritesheet?.frames) {
          console.warn(`[avatar] manifest sin assets: ${url}`);
          return null;
        }
        const imageUrl = `/figure/${folder}/${folder}.png`;
        const image = await loadImage(imageUrl);
        return { sheet, image, imageUrl, gray: isGrayscale(image) };
      } catch (err) {
        console.warn(`[avatar] error cargando ${url}:`, err);
        return null;
      }
    })();
    sheetCache.set(folder, p);
  }
  return p;
}

let indexPromise: Promise<Record<string, string[]>> | null = null;

/** Capas que oculta cada carpeta (generado por scripts/figure-index.mjs). */
function loadHiddenIndex(): Promise<Record<string, string[]>> {
  indexPromise ??= fetch("/figure/figure-index.json")
    .then((r) => (r.ok ? r.json() : { hidden: {} }))
    .then((d: { hidden?: Record<string, string[]> }) => d.hidden ?? {})
    .catch(() => ({}));
  return indexPromise;
}

function tintsFor(loaded: LoadedSheet, colors: Required<FigureColors>): FigureLayer["tints"] {
  if (!loaded.gray) return undefined;
  const tints: Record<string, string> = {};
  for (const name of Object.keys(loaded.sheet.manifest.assets)) {
    const type = name.split("_")[2];
    if (!type || type in tints || UNTINTED.has(type)) continue;
    tints[type] = SKIN_TYPES.has(type)
      ? colors.skin
      : HAIR_TYPES.has(type)
        ? colors.hair
        : FIXED_TINTS[type] ?? colors.accent;
  }
  return tints;
}

/** La cara (ojos, boca) vive en otra librería que el cuerpo: se agrega sola. */
function withFace(specs: SpriteSpec[]): SpriteSpec[] {
  const folders = new Set(specs.map((s) => parseItem(s.item).folder));
  return folders.has("hh_human_body") && !folders.has("hh_human_face")
    ? [...specs, { slot: "fc", item: "hh_human_face" }]
    : specs;
}

export function useSpriteLayers(specs: SpriteSpec[], colors: FigureColors = {}): FigureLayer[] | null {
  const items = withFace(specs).map((s) => s.item);
  const key = JSON.stringify([items, colors.accent, colors.skin, colors.hair]);
  const [state, setState] = useState<{ key: string; layers: FigureLayer[] } | null>(null);

  useEffect(() => {
    const [list, accent, skin, hair] = JSON.parse(key) as [string[], string?, string?, string?];
    if (!list.length) return;
    const palette = {
      accent: accent ?? DEFAULT_COLORS.accent,
      skin: skin ?? DEFAULT_COLORS.skin,
      hair: hair ?? DEFAULT_COLORS.hair,
    };
    let alive = true;
    Promise.all([loadHiddenIndex(), ...list.map((item) => loadSheet(parseItem(item).folder))]).then(([hidden, ...loaded]) => {
      const index = hidden as Record<string, string[]>;
      const layers: FigureLayer[] = [];
      loaded.forEach((l, i) => {
        if (!l) return;
        const sheet = l as LoadedSheet;
        const item = parseItem(list[i]);
        layers.push({
          slot: item.folder,
          imageUrl: sheet.imageUrl,
          image: sheet.image,
          sheet: sheet.sheet,
          item,
          hidden: index[item.folder],
          tints: tintsFor(sheet, palette),
        });
      });
      if (!layers.length) console.warn(`[avatar] NINGÚN layer cargó para: ${list.join(", ")}`);
      if (alive) setState({ key, layers });
    });
    return () => {
      alive = false;
    };
  }, [key]);

  // Mientras carga una combinación nueva se sigue mostrando la anterior (sin parpadeo)
  return state?.layers ?? null;
}

export function SpriteAvatar({
  specs,
  frame = "basico",
  size = 64,
  className,
  speaking,
  label,
  bare = false,
  colors,
  view,
  walking = false,
  direction = 2,
  puff = false,
  pose,
}: {
  /** Pose fija de Habbo (std, spk, wav, sig, respect…) y cuadro; sin esto, de pie. */
  pose?: Pose;
  specs: SpriteSpec[];
  /** Nube de humo al cambiar de look; la figura nueva aparece con la nube ya densa. */
  puff?: boolean;
  /** Dirección Habbo 0–7 (2 = de frente, tres cuartos a la derecha). */
  direction?: number;
  /** Muestra la animación de caminar (ver SpriteFigure). */
  walking?: boolean;
  colors?: FigureColors;
  frame?: NonNullable<SkinMeta["frame"]>;
  size?: number;
  className?: string;
  speaking?: boolean;
  label?: string;
  /** Sin círculo: figura entera más alta que `size`, que crece hacia arriba (campus). */
  bare?: boolean;
  /** Recorte dentro del círculo; por defecto busto en tamaños chicos y cuerpo entero en grandes. */
  view?: FigureView;
}) {
  const loaded = useSpriteLayers(specs, colors);

  // Nube al cambiar de look (no en la primera carga): se detecta en el render, sin efectos
  const lookKey = JSON.stringify([specs.map((s) => s.item), colors?.accent, colors?.skin, colors?.hair]);
  const [prevLook, setPrevLook] = useState(lookKey);
  const [puffs, setPuffs] = useState(0);
  if (lookKey !== prevLook) {
    setPrevLook(lookKey);
    if (puff) setPuffs((n) => n + 1);
  }

  // La figura nueva se muestra a media nube; sin puff (o la primera vez) aparece enseguida
  const [layers, setShown] = useState<FigureLayer[] | null>(null);
  useEffect(() => {
    if (!loaded) return;
    const t = setTimeout(() => setShown(loaded), puff && puffs > 0 ? 260 : 0);
    return () => clearTimeout(t);
  }, [loaded, puff, puffs]);
  const ready = layers && layers.length > 0;

  return (
    <div
      role="img"
      aria-label={label ?? "Avatar"}
      className={cn(
        "relative shrink-0",
        !bare && "overflow-hidden rounded-full bg-muted",
        !bare && FRAME_STYLES[frame],
        speaking && "speaking",
        className,
      )}
      style={{ width: size, height: size }}
    >
      {puffs > 0 && (
        <SmokePuff
          key={puffs}
          size={bare ? size * 1.5 : size}
          // Figura de pie (bare): su centro queda ~1.1 tamaños sobre la base; en el círculo, al medio
          style={{ left: "50%", top: bare ? -size * 0.1 : "50%" }}
        />
      )}
      {ready &&
        (bare ? (
          <SpriteFigure
            layers={layers}
            walking={walking}
            action={pose?.action}
            frame={pose?.frame}
            direction={direction}
            width={size * 1.6}
            height={size * 2.25}
            className="pointer-events-none absolute bottom-0 left-1/2 max-w-none -translate-x-1/2"
          />
        ) : (
          <SpriteFigure
            layers={layers}
            walking={walking}
            action={pose?.action}
            frame={pose?.frame}
            direction={direction}
            width={size}
            height={size}
            view={view ?? (size >= 100 ? "full" : "bust")}
          />
        ))}
    </div>
  );
}
