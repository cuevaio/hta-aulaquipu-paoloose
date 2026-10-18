"use client";

import { useEffect, useImperativeHandle, useRef, useState } from "react";

// Clave de demostración pública de la documentación de Desmos; en producción va en NEXT_PUBLIC_DESMOS_API_KEY.
const API_KEY = process.env.NEXT_PUBLIC_DESMOS_API_KEY || "dcb31709b452b1cf9dc26972add0fda6";
const SRC = `https://www.desmos.com/api/v1.12/calculator.js?apiKey=${API_KEY}`;

interface DesmosCalculator {
  setExpression(e: { id: string; latex: string; color?: string }): void;
  removeExpressions(e: { id: string }[]): void;
  setMathBounds(b: { left: number; right: number; bottom: number; top: number }): void;
  graphpaperBounds: { mathCoordinates: { left: number; right: number; bottom: number; top: number } };
  resize(): void;
  destroy(): void;
}

declare global {
  interface Window {
    Desmos?: {
      GraphingCalculator(el: HTMLElement, opts?: Record<string, unknown>): DesmosCalculator;
    };
  }
}

let loading: Promise<void> | null = null;
function loadDesmos(): Promise<void> {
  if (window.Desmos) return Promise.resolve();
  if (loading) return loading;
  loading = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SRC;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      loading = null;
      reject(new Error("No se pudo cargar Desmos"));
    };
    document.head.appendChild(s);
  });
  return loading;
}

/** Corrige el doble escape que a veces escribe el modelo: dos barras invertidas seguidas pasan a una. */
function cleanLatex(latex: string) {
  return latex.replace(/\\\\/g, "\\");
}

/** Puntos "(a,b)" de una expresión; las curvas no aportan puntos. */
function pointsOf(latex: string): [number, number][] {
  const m = latex.trim().match(/^\(\s*(-?\d*\.?\d+)\s*,\s*(-?\d*\.?\d+)\s*\)$/);
  return m ? [[Number(m[1]), Number(m[2])]] : [];
}

/** Amplía la vista solo si algún punto queda fuera; nunca la reduce (no pelea con el zoom del alumno). */
function fitPoints(c: DesmosCalculator, pts: [number, number][]) {
  if (!pts.length) return;
  const b = c.graphpaperBounds.mathCoordinates;
  let { left, right, bottom, top } = b;
  const padX = (right - left) * 0.15;
  const padY = (top - bottom) * 0.15;
  for (const [x, y] of pts) {
    if (x < left || x > right) {
      left = Math.min(left, x - padX);
      right = Math.max(right, x + padX);
    }
    if (y < bottom || y > top) {
      bottom = Math.min(bottom, y - padY);
      top = Math.max(top, y + padY);
    }
  }
  if (left !== b.left || right !== b.right || bottom !== b.bottom || top !== b.top) c.setMathBounds({ left, right, bottom, top });
}

export interface DesmosHandle {
  /** `fit`: ajusta la vista para que se vean los puntos (solo para lo que pone el tutor). */
  setExpression(id: string, latex: string, color?: string, fit?: boolean): void;
  removeExpression(id: string): void;
}

/** Graficador Desmos. Mientras carga, las expresiones se encolan y se aplican al estar listo. */
export function DesmosGraph({ visible, ref }: { visible: boolean; ref?: React.Ref<DesmosHandle> }) {
  const el = useRef<HTMLDivElement>(null);
  const calc = useRef<DesmosCalculator | null>(null);
  const queue = useRef<((c: DesmosCalculator) => void)[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    loadDesmos()
      .then(() => {
        if (!alive || !el.current || !window.Desmos) return;
        calc.current = window.Desmos.GraphingCalculator(el.current, {
          language: "es",
          keypad: true,
          expressionsCollapsed: false,
          settingsMenu: false,
          border: false,
        });
        calc.current.setMathBounds({ left: -6, right: 10, bottom: -4, top: 12 });
        queue.current.forEach((fn) => fn(calc.current!));
        queue.current = [];
        setStatus("ready");
      })
      .catch(() => alive && setStatus("error"));
    return () => {
      alive = false;
      calc.current?.destroy();
      calc.current = null;
    };
  }, [attempt]);

  useEffect(() => {
    if (visible) calc.current?.resize();
  }, [visible]);

  useImperativeHandle(ref, () => {
    const run = (fn: (c: DesmosCalculator) => void) => (calc.current ? fn(calc.current) : queue.current.push(fn));
    return {
      setExpression: (id, latex, color, fit) =>
        run((c) => {
          const clean = cleanLatex(latex);
          c.setExpression({ id, latex: clean, color });
          if (fit) fitPoints(c, pointsOf(clean));
        }),
      removeExpression: (id) => run((c) => c.removeExpressions([{ id }])),
    };
  }, []);

  return (
    <div className="relative size-full">
      <div ref={el} className="size-full" />
      {status !== "ready" && (
        <div className="absolute inset-0 grid place-items-center bg-card text-sm font-semibold text-muted-foreground">
          {status === "loading" ? (
            "Cargando graficador…"
          ) : (
            <div className="flex flex-col items-center gap-3 px-6 text-center">
              <p>No se pudo cargar el graficador. Revisa tu conexión.</p>
              <button
                onClick={() => {
                  setStatus("loading");
                  setAttempt((n) => n + 1);
                }}
                className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white hover:brightness-95"
              >
                Reintentar
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
