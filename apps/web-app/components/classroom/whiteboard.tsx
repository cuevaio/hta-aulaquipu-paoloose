"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Eraser, ImagePlus, ImageOff, Trash2 } from "lucide-react";
import type { Point, Stroke } from "@/lib/classroom/events";
import { cn } from "@/lib/utils";

const COLORS = ["#1E1B3A", "#7C6BF2", "#2FD3A3", "#FF8A65", "#E5484D", "#FFC94D"];

/** Reduce la foto a 1600 px como máximo (JPEG): pesa poco y viaja rápido por la sala. */
async function compressImage(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = url;
    });
    const scale = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement("canvas");
    c.width = Math.round(img.naturalWidth * scale);
    c.height = Math.round(img.naturalHeight * scale);
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.85);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Cuaderno compartido: lienzo de dibujo libre con una foto opcional de fondo. Los trazos se guardan
 * normalizados (0..1) al rectángulo de la foto si hay una y, si no, al cuadrado centrado, para verse
 * igual, sin deformarse, en cualquier pantalla.
 */
/** Radio del borrador en píxeles CSS: un trazo se borra si el borrador pasa a esta distancia. */
const ERASE_RADIUS = 14;

/**
 * Marco al que se normalizan los trazos: la foto (tal como se dibuja, ajustada al lienzo) cuando hay una
 * y, si no, el cuadrado centrado. Así una marca queda sobre el mismo punto de la foto en cualquier tamaño.
 */
function frameOf(width: number, height: number, image: HTMLImageElement | null) {
  if (image && image.complete && image.naturalWidth) {
    const scale = Math.min(width / image.naturalWidth, height / image.naturalHeight);
    const w = image.naturalWidth * scale;
    const h = image.naturalHeight * scale;
    return { ox: (width - w) / 2, oy: (height - h) / 2, w, h };
  }
  const size = Math.min(width, height);
  return { ox: (width - size) / 2, oy: (height - size) / 2, w: size, h: size };
}

/** Distancia de un punto (px,py) al segmento a-b. */
function distToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2)) : 0;
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

export function Whiteboard({
  strokes,
  onStroke,
  onErase,
  onClear,
  target,
  background,
  onBackground,
  onRemoveBackground,
  visible,
}: {
  strokes: Stroke[];
  onStroke: (s: Stroke) => void;
  /** Ids de los trazos que el borrador acaba de tocar. */
  onErase: (ids: string[]) => void;
  onClear: () => void;
  target: "board" | "notebook";
  background?: string | null;
  onBackground?: (dataUrl: string) => void;
  onRemoveBackground?: () => void;
  visible: boolean;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const img = useRef<HTMLImageElement | null>(null);
  const current = useRef<Point[] | null>(null);
  const erased = useRef<Set<string>>(new Set());
  const [color, setColor] = useState(COLORS[1]);
  const [eraser, setEraser] = useState(false);
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);

  const draw = useCallback(() => {
    const c = canvas.current;
    if (!c) return;
    const ctx = c.getContext("2d")!;
    const { width, height } = c;
    ctx.clearRect(0, 0, width, height);
    const { ox, oy, w, h } = frameOf(width, height, img.current);
    if (img.current && img.current.complete && img.current.naturalWidth) ctx.drawImage(img.current, ox, oy, w, h);
    const dpr = window.devicePixelRatio || 1;
    const live = current.current && !eraser ? [{ id: "live", color, width: 4, points: current.current, target }] : [];
    for (const s of [...strokes, ...live]) {
      if (!s.points.length) continue;
      ctx.strokeStyle = s.color;
      ctx.fillStyle = s.color;
      ctx.lineWidth = s.width * dpr;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      if (s.points.length === 1) {
        // Un toque suelto deja un punto
        ctx.beginPath();
        ctx.arc(ox + s.points[0].x * w, oy + s.points[0].y * h, (s.width * dpr) / 2, 0, Math.PI * 2);
        ctx.fill();
        continue;
      }
      ctx.beginPath();
      s.points.forEach((p, i) => (i ? ctx.lineTo(ox + p.x * w, oy + p.y * h) : ctx.moveTo(ox + p.x * w, oy + p.y * h)));
      ctx.stroke();
    }
  }, [strokes, color, eraser, target]);

  // El observador se crea una sola vez y llama siempre a la versión más reciente de draw
  const drawRef = useRef(draw);
  useEffect(() => {
    drawRef.current = draw;
    draw();
  }, [draw]);

  // Solo se redimensiona el lienzo si el tamaño (o la densidad de píxeles) cambió: asignar width/height lo borra
  const fit = useCallback(() => {
    const c = canvas.current;
    const w = wrap.current;
    if (!c || !w) return;
    const dpr = window.devicePixelRatio || 1;
    const cw = Math.round(w.clientWidth * dpr);
    const ch = Math.round(w.clientHeight * dpr);
    if (c.width !== cw || c.height !== ch) {
      c.width = cw;
      c.height = ch;
    }
    drawRef.current();
  }, []);

  useEffect(() => {
    const w = wrap.current;
    if (!w) return;
    const ro = new ResizeObserver(fit);
    ro.observe(w);
    fit();
    return () => ro.disconnect();
  }, [fit]);

  useEffect(() => {
    if (!background) {
      img.current = null;
      drawRef.current();
      return;
    }
    const i = new Image();
    i.onload = () => {
      img.current = i;
      drawRef.current();
    };
    i.src = background;
  }, [background]);

  useEffect(() => {
    if (visible) fit();
  }, [visible, fit]);

  /** Punto en coordenadas CSS del lienzo y su versión normalizada al marco actual. */
  const locate = (e: React.PointerEvent) => {
    const r = canvas.current!.getBoundingClientRect();
    const px = e.clientX - r.left;
    const py = e.clientY - r.top;
    const { ox, oy, w, h } = frameOf(r.width, r.height, img.current);
    return { px, py, p: { x: (px - ox) / w, y: (py - oy) / h } as Point, rect: r };
  };

  /** Borra los trazos que el borrador toca en (px,py); devuelve true si quitó alguno. */
  const eraseAt = (px: number, py: number, rect: DOMRect) => {
    const { ox, oy, w, h } = frameOf(rect.width, rect.height, img.current);
    const hit: string[] = [];
    for (const s of strokes) {
      if (erased.current.has(s.id) || !s.points.length) continue;
      const xs = s.points.map((p) => ox + p.x * w);
      const ys = s.points.map((p) => oy + p.y * h);
      const reach = ERASE_RADIUS + s.width / 2;
      const touched =
        s.points.length === 1
          ? Math.hypot(px - xs[0], py - ys[0]) <= reach
          : xs.slice(1).some((_, i) => distToSegment(px, py, xs[i], ys[i], xs[i + 1], ys[i + 1]) <= reach);
      if (touched) hit.push(s.id);
    }
    if (!hit.length) return;
    hit.forEach((id) => erased.current.add(id));
    onErase(hit);
  };

  const finish = (commit: boolean) => {
    const pts = current.current;
    current.current = null;
    erased.current.clear();
    if (commit && pts && pts.length && !eraser)
      onStroke({ id: `s-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, color, width: 4, points: pts, target });
    else drawRef.current();
  };

  return (
    <div className="flex size-full flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
        {COLORS.map((c) => (
          <button
            key={c}
            onClick={() => {
              setColor(c);
              setEraser(false);
            }}
            className={cn("size-7 rounded-full ring-2 ring-offset-2 transition-transform", !eraser && color === c ? "scale-110 ring-primary" : "ring-transparent")}
            style={{ background: c }}
            aria-label={`Color ${c}`}
          />
        ))}
        <button
          onClick={() => setEraser((x) => !x)}
          className={cn("grid size-8 place-items-center rounded-xl", eraser ? "bg-primary text-white" : "hover:bg-muted")}
          aria-label="Borrador"
          aria-pressed={eraser}
        >
          <Eraser className="size-4" />
        </button>
        <span className="flex-1" />
        {onBackground && (
          <label className="flex cursor-pointer items-center gap-1.5 rounded-xl bg-secondary px-3 py-1.5 text-xs font-bold text-secondary-foreground hover:brightness-95">
            <ImagePlus className="size-4" /> {background ? "Cambiar foto" : "Subir foto del cuaderno"}
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                if (f.size > 8 * 1024 * 1024) {
                  alert("La foto pesa más de 8 MB. Prueba con una más liviana.");
                  return;
                }
                void compressImage(f).then(onBackground).catch(() => {});
              }}
            />
          </label>
        )}
        {onRemoveBackground && background && (
          <button
            onClick={onRemoveBackground}
            className="flex items-center gap-1 rounded-xl px-2 py-1.5 text-xs font-bold text-muted-foreground hover:bg-muted"
            aria-label="Quitar foto"
          >
            <ImageOff className="size-4" /> Quitar foto
          </button>
        )}
        <button onClick={onClear} className="flex items-center gap-1 rounded-xl px-2 py-1.5 text-xs font-bold text-muted-foreground hover:bg-muted" aria-label="Limpiar trazos">
          <Trash2 className="size-4" /> Limpiar
        </button>
      </div>
      <div ref={wrap} className="relative flex-1 bg-white">
        <canvas
          ref={canvas}
          className={cn("absolute inset-0 size-full touch-none", eraser ? "cursor-none" : "cursor-crosshair")}
          onPointerDown={(e) => {
            (e.target as HTMLElement).setPointerCapture(e.pointerId);
            const { px, py, p, rect } = locate(e);
            current.current = [p];
            if (eraser) {
              setCursor({ x: px, y: py });
              eraseAt(px, py, rect);
            } else draw();
          }}
          onPointerMove={(e) => {
            const { px, py, p, rect } = locate(e);
            if (eraser) setCursor({ x: px, y: py });
            if (!current.current) return;
            if (eraser) eraseAt(px, py, rect);
            else {
              current.current.push(p);
              draw();
            }
          }}
          onPointerUp={() => finish(true)}
          onPointerCancel={() => finish(false)}
          onPointerLeave={() => setCursor(null)}
        />
        {eraser && cursor && (
          <div
            className="pointer-events-none absolute rounded-full border-2 border-primary bg-primary/10"
            style={{ width: ERASE_RADIUS * 2, height: ERASE_RADIUS * 2, left: cursor.x - ERASE_RADIUS, top: cursor.y - ERASE_RADIUS }}
          />
        )}
        {onBackground && !background && (
          <p className="pointer-events-none absolute inset-0 grid place-items-center px-6 text-center text-sm font-semibold text-muted-foreground">
            Dibuja aquí con libertad o sube una foto de tu cuaderno y márcala encima.
          </p>
        )}
      </div>
    </div>
  );
}
