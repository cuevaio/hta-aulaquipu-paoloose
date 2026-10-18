"use client";

import { useEffect, useImperativeHandle, useRef, useState } from "react";

// Clave de demostración pública de la documentación de Desmos; en producción va en NEXT_PUBLIC_DESMOS_API_KEY.
const API_KEY = process.env.NEXT_PUBLIC_DESMOS_API_KEY || "dcb31709b452b1cf9dc26972add0fda6";
const SRC = `https://www.desmos.com/api/v1.12/calculator.js?apiKey=${API_KEY}`;

interface DesmosCalculator {
  setExpression(e: { id: string; latex: string; color?: string }): void;
  removeExpressions(e: { id: string }[]): void;
  setMathBounds(b: { left: number; right: number; bottom: number; top: number }): void;
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

export interface DesmosHandle {
  setExpression(id: string, latex: string, color?: string): void;
  removeExpression(id: string): void;
}

/** Graficador Desmos. Mientras carga, las expresiones se encolan y se aplican al estar listo. */
export function DesmosGraph({ visible, ref }: { visible: boolean; ref?: React.Ref<DesmosHandle> }) {
  const el = useRef<HTMLDivElement>(null);
  const calc = useRef<DesmosCalculator | null>(null);
  const queue = useRef<((c: DesmosCalculator) => void)[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

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
  }, []);

  useEffect(() => {
    if (visible) calc.current?.resize();
  }, [visible]);

  useImperativeHandle(ref, () => {
    const run = (fn: (c: DesmosCalculator) => void) => (calc.current ? fn(calc.current) : queue.current.push(fn));
    return {
      setExpression: (id, latex, color) => run((c) => c.setExpression({ id, latex, color })),
      removeExpression: (id) => run((c) => c.removeExpressions([{ id }])),
    };
  }, []);

  return (
    <div className="relative size-full">
      <div ref={el} className="size-full" />
      {status !== "ready" && (
        <div className="absolute inset-0 grid place-items-center bg-card text-sm font-semibold text-muted-foreground">
          {status === "loading" ? "Cargando graficador…" : "No se pudo cargar el graficador. Revisa tu conexión."}
        </div>
      )}
    </div>
  );
}
