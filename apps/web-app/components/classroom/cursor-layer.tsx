"use client";

import { useEffect, useRef, useState } from "react";
import type { ClassroomTool } from "@/lib/classroom/events";
import type { ClassroomTransport } from "@/lib/classroom/transport";

const SEND_EVERY_MS = 50;
const STALE_MS = 4000;
const COLORS = ["#E5484D", "#2D70B3", "#388C46", "#6042A6", "#FA7E19", "#D6409F", "#0E9F9F", "#8D6E00"];

/** Color fijo por persona (el mismo en todas las pantallas). */
function colorOf(actor: string): string {
  let h = 0;
  for (let i = 0; i < actor.length; i++) h = (h * 31 + actor.charCodeAt(i)) >>> 0;
  return COLORS[h % COLORS.length];
}

interface Remote {
  x: number;
  y: number;
  tool: ClassroomTool | null;
  at: number;
}

/**
 * Cursores en vivo sobre el área de trabajo: el tuyo se envía (posición relativa al área, así se ve
 * bien aunque las pantallas tengan otro tamaño) y los de los demás se dibujan con su color y nombre.
 * Solo se ve el cursor de quien está en la misma pestaña que tú. Se monta dentro del contenedor.
 */
export function CursorLayer({
  transport,
  myActor,
  tool,
  names,
}: {
  transport: ClassroomTransport | null;
  myActor: string;
  tool: ClassroomTool;
  names: Record<string, string>;
}) {
  const layer = useRef<HTMLDivElement>(null);
  const [remotes, setRemotes] = useState<Record<string, Remote>>({});
  const toolRef = useRef(tool);

  useEffect(() => {
    toolRef.current = tool;
  }, [tool]);

  // Enviar el propio (con un tope de ~20 por segundo)
  useEffect(() => {
    const area = layer.current?.parentElement;
    if (!area || !transport || transport.kind !== "livekit") return;
    let last = 0;
    const move = (e: PointerEvent) => {
      const now = Date.now();
      if (now - last < SEND_EVERY_MS) return;
      last = now;
      const r = area.getBoundingClientRect();
      if (!r.width || !r.height) return;
      transport.publish({ type: "cursor", actor: myActor, x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height, tool: toolRef.current });
    };
    const leave = () => transport.publish({ type: "cursor", actor: myActor, x: -1, y: -1, tool: toolRef.current });
    area.addEventListener("pointermove", move, { passive: true });
    area.addEventListener("pointerleave", leave);
    return () => {
      area.removeEventListener("pointermove", move);
      area.removeEventListener("pointerleave", leave);
    };
  }, [transport, myActor]);

  // Recibir los de los demás y olvidar los que dejaron de moverse
  useEffect(() => {
    if (!transport) return;
    const off = transport.subscribe((e) => {
      if (e.type !== "cursor" || e.actor === myActor) return;
      setRemotes((m) => ({ ...m, [e.actor]: { x: e.x, y: e.y, tool: e.tool, at: Date.now() } }));
    });
    const prune = setInterval(() => {
      setRemotes((m) => {
        const now = Date.now();
        const next = Object.fromEntries(Object.entries(m).filter(([, r]) => now - r.at < STALE_MS));
        return Object.keys(next).length === Object.keys(m).length ? m : next;
      });
    }, 1000);
    return () => {
      off();
      clearInterval(prune);
    };
  }, [transport, myActor]);

  return (
    <div ref={layer} className="pointer-events-none absolute inset-0 z-30 overflow-hidden [container-type:size]" aria-hidden>
      {Object.entries(remotes)
        .filter(([, r]) => r.tool === tool && r.x >= 0 && r.y >= 0)
        .map(([actor, r]) => {
          const color = colorOf(actor);
          return (
            <div
              key={actor}
              className="absolute top-0 left-0 transition-transform duration-75 ease-linear"
              style={{ transform: `translate(calc(${r.x * 100}cqw - 2px), calc(${r.y * 100}cqh - 2px))` }}
            >
              <svg width="18" height="18" viewBox="0 0 18 18" className="drop-shadow">
                <path d="M2 2l5.5 14 2-5.5L15 8.5z" fill={color} stroke="white" strokeWidth="1.5" strokeLinejoin="round" />
              </svg>
              <span className="ml-3 -mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-extrabold whitespace-nowrap text-white shadow" style={{ background: color }}>
                {names[actor] ?? "Alguien"}
              </span>
            </div>
          );
        })}
    </div>
  );
}
