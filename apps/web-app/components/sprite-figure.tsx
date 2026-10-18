"use client";

// Render de paperdoll Habbo desde spritesheet manifests (formato open-hotel) en un <canvas>.
// Las reglas de armado (offsets, espejo, orden) viven en lib/figure.ts; aquí se recorta
// cada pieza del atlas, se tiñe con su color y se dibuja.

import { useEffect, useMemo, useRef, useState } from "react";
import { FIGURE_CENTER_X, resolveFigure, type FigureItem, type FigurePiece, type SpritesheetManifest } from "@/lib/figure";

// Recuadros lógicos respecto del ancla: figura entera (gorro → zapatos) o busto (cabeza y hombros).
const VIEWS = {
  full: { w: 64, h: 96, y: -84 },
  bust: { w: 50, h: 50, y: -88 },
} as const;

export type FigureView = keyof typeof VIEWS;

const WALK_FRAMES = 4;
const WALK_FRAME_MS = 140;

export interface FigureLayer {
  slot: string;
  imageUrl: string;
  image: HTMLImageElement;
  sheet: SpritesheetManifest;
  /** Qué piezas de la carpeta usar; sin esto se elige el id base. */
  item?: FigureItem;
  /** Capas que este item oculta en toda la figura (hiddenLayers de figuredata). */
  hidden?: string[];
  /** Color por sub-tipo para teñir (multiplicar) las piezas en escala de grises. */
  tints?: Partial<Record<string, string>>;
}

const pieceCache = new Map<string, HTMLCanvasElement>();

/** Pieza recortada del atlas (sin rotar ni recortar) y teñida, a su tamaño original. */
function pieceCanvas(layer: FigureLayer, piece: FigurePiece, tint: string | undefined): HTMLCanvasElement {
  const key = `${layer.imageUrl}|${piece.name}|${tint ?? ""}`;
  const cached = pieceCache.get(key);
  if (cached) return cached;

  const { frame: r, rotated, spriteSourceSize: ss } = piece.sprite;
  const canvas = document.createElement("canvas");
  canvas.width = piece.w;
  canvas.height = piece.h;
  const ctx = canvas.getContext("2d")!;
  const ox = ss?.x ?? 0;
  const oy = ss?.y ?? 0;
  if (rotated) {
    // TexturePacker guarda la pieza girada 90° horaria (región h × w): se gira de vuelta.
    ctx.setTransform(0, -1, 1, 0, ox, oy + r.h);
    ctx.drawImage(layer.image, r.x, r.y, r.h, r.w, 0, 0, r.h, r.w);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  } else {
    ctx.drawImage(layer.image, r.x, r.y, r.w, r.h, ox, oy, r.w, r.h);
  }
  if (tint) {
    // multiply tiñe; destination-in devuelve la transparencia original
    const shape = document.createElement("canvas");
    shape.width = piece.w;
    shape.height = piece.h;
    shape.getContext("2d")!.drawImage(canvas, 0, 0);
    ctx.globalCompositeOperation = "multiply";
    ctx.fillStyle = tint;
    ctx.fillRect(0, 0, piece.w, piece.h);
    ctx.globalCompositeOperation = "destination-in";
    ctx.drawImage(shape, 0, 0);
    ctx.globalCompositeOperation = "source-over";
  }
  pieceCache.set(key, canvas);
  return canvas;
}

export function SpriteFigure({
  layers,
  action = "std",
  direction = 2,
  frame = 0,
  width = 100,
  height = 140,
  view = "full",
  walking = false,
  className,
}: {
  layers: FigureLayer[];
  /** Camina: alterna los 4 cuadros de "wlk" (si una pieza no los trae, queda en su pose de pie). */
  walking?: boolean;
  action?: string;
  direction?: number;
  frame?: number;
  width?: number;
  height?: number;
  view?: FigureView;
  className?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (!walking || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => setStep((s) => (s + 1) % WALK_FRAMES), WALK_FRAME_MS);
    return () => clearInterval(id);
  }, [walking]);

  const pose = walking ? "wlk" : action;
  const cell = walking ? step : frame;
  const pieces = useMemo(
    () =>
      resolveFigure(
        layers.map((l) => ({ sheet: l.sheet, item: l.item })),
        { direction, action: pose, frame: cell, hidden: layers.flatMap((l) => l.hidden ?? []) },
      ),
    [layers, direction, pose, cell],
  );

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    const ctx = canvas.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Escala uniforme: la figura entera cabe y queda centrada en el recuadro
    const v = VIEWS[view];
    const scale = Math.min(width / v.w, height / v.h) * dpr;
    const dx = (canvas.width - v.w * scale) / 2 - (FIGURE_CENTER_X - v.w / 2) * scale;
    const dy = (canvas.height - v.h * scale) / 2 - v.y * scale;

    for (const piece of pieces) {
      const layer = layers[piece.layer];
      const img = pieceCanvas(layer, piece, layer.tints?.[piece.type]);
      const x = dx + piece.x * scale;
      const y = dy + piece.y * scale;
      const w = piece.w * scale;
      const h = piece.h * scale;
      if (piece.flip) {
        ctx.save();
        ctx.translate(x + w, y);
        ctx.scale(-1, 1);
        ctx.drawImage(img, 0, 0, w, h);
        ctx.restore();
      } else {
        ctx.drawImage(img, x, y, w, h);
      }
    }
  }, [pieces, layers, width, height, view]);

  return <canvas ref={ref} className={className} style={{ width, height, imageRendering: "pixelated" }} />;
}
