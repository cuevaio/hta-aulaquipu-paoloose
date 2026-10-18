"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Eraser, ImagePlus, Trash2 } from "lucide-react";
import type { Point, Stroke } from "@/lib/classroom/events";
import { cn } from "@/lib/utils";

const COLORS = ["#1E1B3A", "#7C6BF2", "#2FD3A3", "#FF8A65", "#E5484D", "#FFC94D"];

/**
 * Pizarra compartida: los trazos se guardan normalizados a un cuadrado centrado (0..1)
 * para verse igual, sin deformarse, en cualquier pantalla.
 */
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

function square(width: number, height: number) {
  const size = Math.min(width, height);
  return { size, ox: (width - size) / 2, oy: (height - size) / 2 };
}

export function Whiteboard({
  strokes,
  onStroke,
  onClear,
  target,
  background,
  onBackground,
  visible,
}: {
  strokes: Stroke[];
  onStroke: (s: Stroke) => void;
  onClear: () => void;
  target: "board" | "notebook";
  background?: string | null;
  onBackground?: (dataUrl: string) => void;
  visible: boolean;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const img = useRef<HTMLImageElement | null>(null);
  const current = useRef<Point[] | null>(null);
  const [color, setColor] = useState(COLORS[1]);
  const [eraser, setEraser] = useState(false);

  const draw = useCallback(() => {
    const c = canvas.current;
    if (!c) return;
    const ctx = c.getContext("2d")!;
    const { width, height } = c;
    ctx.clearRect(0, 0, width, height);
    if (img.current && img.current.complete && img.current.naturalWidth) {
      const scale = Math.min(width / img.current.naturalWidth, height / img.current.naturalHeight);
      const w = img.current.naturalWidth * scale;
      const h = img.current.naturalHeight * scale;
      ctx.drawImage(img.current, (width - w) / 2, (height - h) / 2, w, h);
    }
    const all = current.current ? [...strokes, { id: "live", color: eraser ? "#ffffff" : color, width: eraser ? 24 : 4, points: current.current, target }] : strokes;
    const { size, ox, oy } = square(width, height);
    for (const s of all) {
      if (s.points.length < 2) continue;
      ctx.strokeStyle = s.color;
      ctx.lineWidth = s.width * (window.devicePixelRatio || 1);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      s.points.forEach((p, i) => (i ? ctx.lineTo(ox + p.x * size, oy + p.y * size) : ctx.moveTo(ox + p.x * size, oy + p.y * size)));
      ctx.stroke();
    }
  }, [strokes, color, eraser, target]);

  useEffect(() => {
    const c = canvas.current;
    const w = wrap.current;
    if (!c || !w) return;
    const ro = new ResizeObserver(() => {
      const dpr = window.devicePixelRatio || 1;
      c.width = w.clientWidth * dpr;
      c.height = w.clientHeight * dpr;
      draw();
    });
    ro.observe(w);
    return () => ro.disconnect();
  }, [draw]);

  useEffect(() => {
    if (!background) {
      img.current = null;
      draw();
      return;
    }
    const i = new Image();
    i.onload = () => {
      img.current = i;
      draw();
    };
    i.src = background;
  }, [background, draw]);

  useEffect(() => {
    if (visible) draw();
  }, [visible, draw]);

  useEffect(draw, [draw]);

  const point = (e: React.PointerEvent): Point => {
    const r = canvas.current!.getBoundingClientRect();
    const { size, ox, oy } = square(r.width, r.height);
    return { x: (e.clientX - r.left - ox) / size, y: (e.clientY - r.top - oy) / size };
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
        <button onClick={onClear} className="flex items-center gap-1 rounded-xl px-2 py-1.5 text-xs font-bold text-muted-foreground hover:bg-muted" aria-label="Limpiar trazos">
          <Trash2 className="size-4" /> Limpiar
        </button>
      </div>
      <div ref={wrap} className="relative flex-1 bg-white">
        <canvas
          ref={canvas}
          className="absolute inset-0 size-full touch-none cursor-crosshair"
          onPointerDown={(e) => {
            (e.target as HTMLElement).setPointerCapture(e.pointerId);
            current.current = [point(e)];
          }}
          onPointerMove={(e) => {
            if (!current.current) return;
            current.current.push(point(e));
            draw();
          }}
          onPointerUp={() => {
            const pts = current.current;
            current.current = null;
            if (pts && pts.length > 1)
              onStroke({ id: `s-${Date.now()}`, color: eraser ? "#ffffff" : color, width: eraser ? 24 : 4, points: pts, target });
          }}
        />
        {onBackground && !background && (
          <p className="pointer-events-none absolute inset-0 grid place-items-center px-6 text-center text-sm font-semibold text-muted-foreground">
            Sube una foto de tu ejercicio y márcala encima.
          </p>
        )}
      </div>
    </div>
  );
}
