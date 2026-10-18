"use client";

import { Check, Sparkles, X } from "lucide-react";
import { btn } from "@/components/bits";
import { cn } from "@/lib/utils";

export interface QuizCard {
  id: string;
  question: string;
  options: string[];
  picked: number | null;
  result: { correct: boolean; correctIndex: number; explanation: string } | null;
}

/**
 * Pestaña "Actividad": el espacio interactivo del tutor. Hoy muestra tarjetas de opción múltiple;
 * aquí caben otras actividades más adelante. La clave de respuestas nunca llega a la web.
 */
export function ActivityPanel({
  quiz,
  tutorName,
  onPick,
  onDismiss,
}: {
  quiz: QuizCard | null;
  tutorName: string;
  onPick: (index: number) => void;
  onDismiss: () => void;
}) {
  if (!quiz) {
    return (
      <div className="grid size-full place-items-center p-6 text-center">
        <div className="max-w-xs">
          <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-secondary text-secondary-foreground">
            <Sparkles className="size-7" />
          </span>
          <p className="mt-4 font-heading text-lg font-semibold">Actividad</p>
          <p className="mt-1 text-sm font-semibold text-muted-foreground">Aquí aparecerán las actividades que te proponga {tutorName}.</p>
        </div>
      </div>
    );
  }

  const r = quiz.result;
  return (
    <div className="grid size-full place-items-center overflow-y-auto p-4">
      <div
        role="group"
        aria-label="Pregunta de opción múltiple"
        className="w-full max-w-xl rounded-3xl bg-navy p-4 text-white shadow-2xl ring-4 ring-gold/60 animate-in fade-in zoom-in-95"
      >
        <p className="text-xs font-bold text-gold">{tutorName} te pregunta · elige una opción</p>
        <p className="mt-1 font-heading text-lg font-semibold">{quiz.question}</p>
        <div className="mt-3 flex flex-col gap-2">
          {quiz.options.map((opt, i) => {
            const isRight = !!r && i === r.correctIndex;
            const isWrongPick = !!r && quiz.picked === i && !r.correct;
            return (
              <button
                key={i}
                type="button"
                onClick={() => onPick(i)}
                disabled={quiz.picked !== null}
                aria-pressed={quiz.picked === i}
                className={cn(
                  "flex min-h-12 w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-base font-bold transition-colors",
                  isRight
                    ? "bg-mint text-navy"
                    : isWrongPick
                      ? "bg-coral text-white"
                      : quiz.picked === i
                        ? "bg-white/25 text-white"
                        : "bg-white/10 hover:bg-white/20 disabled:opacity-60",
                )}
              >
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-black/20 text-sm font-extrabold">
                  {String.fromCharCode(65 + i)}
                </span>
                <span className="min-w-0 flex-1">{opt}</span>
                {isRight && <Check className="size-5 shrink-0" />}
                {isWrongPick && <X className="size-5 shrink-0" />}
              </button>
            );
          })}
        </div>
        {r ? (
          <div className="mt-3">
            <p className={cn("font-heading text-lg font-semibold", r.correct ? "text-success" : "text-coral")}>
              {r.correct ? "¡Correcto!" : "Casi, esta vez no."}
            </p>
            {r.explanation && <p className="mt-1 text-sm font-semibold text-white/80">{r.explanation}</p>}
            <button type="button" onClick={onDismiss} className={cn(btn.mint, btn.md, "mt-3 w-full")}>
              Seguir
            </button>
          </div>
        ) : (
          quiz.picked !== null && <p className="mt-3 animate-pulse text-sm font-bold text-white/70">{tutorName} está revisando tu respuesta…</p>
        )}
      </div>
    </div>
  );
}
