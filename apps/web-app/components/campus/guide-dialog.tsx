"use client";

import { useState } from "react";
import { Minus } from "lucide-react";
import { FURNI_SIZE, furniSrc } from "@/lib/campus/furni";
import { GUIDE_TOPICS, type Guide, type GuideTopic } from "@/lib/campus/guides";
import { cn } from "@/lib/utils";

/** La mascota dibujada a escala para que llene un recuadro de `box` px. */
export function GuideSprite({ guide, box, className }: { guide: Guide; box: number; className?: string }) {
  const [w, h] = FURNI_SIZE[guide.sprite];
  const k = Math.min(box / w, box / h);
  return (
    // eslint-disable-next-line @next/next/no-img-element -- sprite diminuto, sin optimizar
    <img
      src={furniSrc(guide.sprite)}
      alt={`${guide.name}, ${guide.species.toLowerCase()}`}
      width={Math.round(w * k)}
      height={Math.round(h * k)}
      className={cn("max-w-none [image-rendering:pixelated]", className)}
    />
  );
}

/**
 * Mascota abierta en una tarjeta flotante en la esquina: no tapa el mapa ni bloquea el teclado.
 * Eliges qué quieres hacer y te lleva (o te responde, si no hay a dónde ir). Minimizarla la deja
 * en su versión chica (la mascota sola, ver campus-shell).
 */
export function GuidePanel({ guide, onMinimize, onPick }: { guide: Guide; onMinimize: () => void; onPick: (topic: GuideTopic) => void }) {
  const [answer, setAnswer] = useState<string | null>(null);

  return (
    <section
      aria-label={`Hablar con ${guide.name}`}
      onKeyDown={(e) => e.key === "Escape" && onMinimize()}
      className="absolute bottom-24 left-3 z-[54] w-[min(20rem,calc(100vw-1.5rem))] rounded-[1.5rem] bg-card/95 p-3 shadow-2xl ring-1 ring-black/10 backdrop-blur animate-in fade-in slide-in-from-bottom-2 lg:left-4"
    >
      <div className="flex items-start gap-3">
        <div className="grid size-16 shrink-0 place-items-end justify-center rounded-2xl bg-secondary pb-1">
          <GuideSprite guide={guide} box={58} className="float" />
        </div>
        <p className="min-w-0 flex-1 rounded-2xl rounded-tl-sm bg-secondary px-3 py-2 text-sm leading-snug font-semibold" aria-live="polite">
          {answer ?? guide.greeting}
        </p>
        <button
          onClick={onMinimize}
          className="-mt-1 -mr-1 rounded-full p-1.5 text-muted-foreground hover:bg-muted"
          aria-label="Minimizar"
          title="Minimizar"
        >
          <Minus className="size-4" />
        </button>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        {guide.topics.map((id, i) => {
          const t = GUIDE_TOPICS[id];
          return (
            <button
              key={id}
              onClick={() => (t.go ? onPick(t) : setAnswer(t.say))}
              className={cn(
                "flex items-center gap-2 rounded-xl bg-muted/60 px-2.5 py-2 text-left text-sm font-extrabold ring-1 ring-border transition hover:bg-gold/25 hover:ring-gold focus-visible:bg-gold/25 focus-visible:ring-gold",
                // Con un número impar de opciones, la última ocupa todo el ancho
                guide.topics.length % 2 === 1 && i === guide.topics.length - 1 && "col-span-2",
              )}
            >
              <span className="text-xl">{t.emoji}</span>
              {t.label}
            </button>
          );
        })}
      </div>
    </section>
  );
}
