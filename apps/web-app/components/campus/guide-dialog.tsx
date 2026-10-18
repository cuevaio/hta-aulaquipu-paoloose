"use client";

import { useState } from "react";
import { X } from "lucide-react";
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

/** Hablar con una mascota: eliges qué quieres hacer y te lleva (o te responde, si no hay a dónde ir). */
export function GuideDialog({ guide, onClose, onPick }: { guide: Guide; onClose: () => void; onPick: (topic: GuideTopic) => void }) {
  const [answer, setAnswer] = useState<string | null>(null);

  return (
    <div
      className="absolute inset-0 z-[80] flex items-end justify-center bg-navy/40 p-3 pb-24 backdrop-blur-[2px] sm:items-center sm:pb-3"
      role="dialog"
      aria-modal="true"
      aria-label={`Hablar con ${guide.name}`}
      data-panel
      onKeyDown={(e) => e.key === "Escape" && onClose()}
      onPointerDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="relative w-full max-w-sm rounded-[1.75rem] bg-card p-4 shadow-2xl animate-in fade-in slide-in-from-bottom-4">
        <button onClick={onClose} className="absolute top-3 right-3 rounded-full p-2 text-muted-foreground hover:bg-muted" aria-label="Cerrar">
          <X className="size-4" />
        </button>

        <div className="flex items-end gap-3 pr-8">
          <div className="grid size-20 shrink-0 place-items-end justify-center rounded-2xl bg-secondary pb-1">
            <GuideSprite guide={guide} box={72} className="float" />
          </div>
          <p className="mb-2 min-w-0 flex-1 rounded-2xl rounded-bl-sm bg-secondary px-3 py-2 text-sm leading-snug font-semibold" aria-live="polite">
            {answer ?? guide.greeting}
          </p>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          {guide.topics.map((id, i) => {
            const t = GUIDE_TOPICS[id];
            return (
              <button
                key={id}
                autoFocus={i === 0}
                onClick={() => (t.go ? onPick(t) : setAnswer(t.say))}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-2xl bg-muted/60 px-2 py-3 text-sm font-extrabold ring-1 ring-border transition hover:bg-gold/25 hover:ring-gold focus-visible:bg-gold/25 focus-visible:ring-gold",
                  // Con un número impar de opciones, la última ocupa todo el ancho
                  guide.topics.length % 2 === 1 && i === guide.topics.length - 1 && "col-span-2",
                )}
              >
                <span className="text-2xl">{t.emoji}</span>
                {t.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
