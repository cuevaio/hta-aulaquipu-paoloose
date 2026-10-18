"use client";

import { useEffect, useState } from "react";
import { Avatar } from "@/components/avatar";
import type { TutorAvatarState } from "@/components/classroom/ai-tutor-avatar";
import { teacherAvatar, type Pose } from "@/lib/campus/teacher-avatars";

/** Cuadros por segundo de la animación de hablar (dos cuadros de boca, como en Habbo). */
const TALK_MS = 170;
const WAVE_MS = 320;

/** Pose de Habbo según lo que hace el tutor. `tick` alterna los cuadros de las animaciones. */
function poseFor(state: TutorAvatarState, tick: number): Pose {
  switch (state) {
    case "speaking":
      return { action: "spk", frame: tick % 2 };
    case "celebrating":
      return { action: "wav", frame: tick % 2 };
    case "surprised":
      return { action: "wav", frame: 1 };
    case "writing":
    case "graphing":
      // Señala hacia las herramientas mientras escribe o grafica
      return { action: "sig", frame: 0 };
    default:
      return { action: "std", frame: 0 };
  }
}

/** Tres cuartos mirando a su derecha, hacia las herramientas (la vista de frente de Habbo queda descentrada). */
const DIRECTION = 2;

/**
 * El profe IA en la llamada: el mismo personaje sprite del campus, de cuerpo entero sobre un
 * escenario con su color. Habla moviendo la boca (y se mece con la voz), saluda al celebrar,
 * señala al escribir o graficar y piensa con un globito.
 */
export function TeacherStage({
  id,
  name,
  color,
  state,
  level = 0,
  size = 80,
}: {
  id: string;
  name: string;
  color: string;
  state: TutorAvatarState;
  level?: number;
  size?: number;
}) {
  const [tick, setTick] = useState(0);
  const animated = state === "speaking" || state === "celebrating";

  useEffect(() => {
    if (!animated || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setTick((n) => n + 1), state === "speaking" ? TALK_MS : WAVE_MS);
    return () => clearInterval(t);
  }, [animated, state]);

  const bob = state === "speaking" ? Math.min(1, level) * 5 : 0;

  return (
    <div
      className="absolute inset-0 overflow-hidden"
      style={{ background: `radial-gradient(120% 90% at 50% 100%, ${color}66, ${color}22 55%, transparent 80%)` }}
    >
      {/* Piso y sombra: el profe está parado en un escenario, no recortado en un círculo */}
      <span aria-hidden className="absolute inset-x-0 bottom-0 h-1/4 bg-gradient-to-t from-black/25 to-transparent" />
      <span aria-hidden className="absolute bottom-8 left-1/2 h-3 w-24 -translate-x-1/2 rounded-[50%] bg-black/35 blur-[2px]" />
      {/* Posición (centrado) y movimiento (respirar / mecerse con la voz) en capas distintas */}
      <div className="absolute bottom-9 left-1/2 -translate-x-1/2">
        <div className={state === "idle" || state === "listening" ? "float" : undefined}>
          <div style={{ transform: `translateY(${-bob}px)`, transition: "transform 90ms linear" }}>
            <Avatar config={teacherAvatar(id, color)} pose={poseFor(state, tick)} direction={DIRECTION} size={size} bare label={`${name}, tutor IA`} />
          </div>
        </div>
      </div>
      {state === "thinking" && (
        <span className="absolute top-8 right-4 flex gap-1 rounded-full bg-white px-2.5 py-1.5 shadow-md" aria-label={`${name} está pensando`}>
          {[0, 1, 2].map((i) => (
            <span key={i} className="size-1.5 animate-bounce rounded-full bg-navy/70" style={{ animationDelay: `${i * 120}ms` }} />
          ))}
        </span>
      )}
      {(state === "writing" || state === "graphing") && (
        <span className="absolute top-8 right-4 rounded-full bg-white px-2 py-1 text-sm shadow-md" aria-hidden>
          {state === "writing" ? "✏️" : "📈"}
        </span>
      )}
    </div>
  );
}
