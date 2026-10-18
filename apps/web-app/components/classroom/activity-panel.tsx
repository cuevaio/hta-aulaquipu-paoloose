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
  asTutor = false,
  answers = [],
  students = 0,
  children,
}: {
  quiz: QuizCard | null;
  tutorName: string;
  onPick: (index: number) => void;
  onDismiss: () => void;
  /** El profe ve la pregunta sin responderla, y las respuestas de sus alumnos al llegar. */
  asTutor?: boolean;
  answers?: { actor: string; name: string; correct: boolean }[];
  students?: number;
  /** Herramientas del profe (p. ej. generar una pregunta con IA), arriba del contenido. */
  children?: React.ReactNode;
}) {
  if (asTutor) {
    return (
      <div className="flex size-full flex-col gap-3 overflow-y-auto p-4">
        {children}
        {!quiz ? (
          <p className="m-auto max-w-xs text-center text-sm font-semibold text-muted-foreground">
            Genera una pregunta con IA: les llega a todos tus alumnos como tarjeta y la plataforma la califica.
          </p>
        ) : (
          <div className="mx-auto w-full max-w-xl space-y-3 rounded-3xl bg-navy p-4 text-white shadow-2xl ring-4 ring-gold/60">
            <p className="text-xs font-bold text-gold">Tu pregunta · la ven tus alumnos</p>
            <p className="font-heading text-lg font-semibold">{quiz.question}</p>
            <ol className="space-y-1.5">
              {quiz.options.map((opt, i) => (
                <li key={i} className="flex items-center gap-3 rounded-2xl bg-white/10 px-4 py-2.5 text-sm font-bold">
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-black/20 text-xs font-extrabold">{String.fromCharCode(65 + i)}</span>
                  {opt}
                </li>
              ))}
            </ol>
            <div className="rounded-2xl bg-white/10 p-3" aria-live="polite">
              <p className="text-xs font-extrabold text-white/70">
                Respuestas: {answers.length}
                {students ? ` de ${students}` : ""}
              </p>
              {answers.length === 0 ? (
                <p className="mt-1 animate-pulse text-sm font-semibold text-white/70">Esperando a que respondan…</p>
              ) : (
                <ul className="mt-1.5 flex flex-wrap gap-1.5">
                  {answers.map((a) => (
                    <li key={a.actor} className={cn("flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-extrabold", a.correct ? "bg-mint text-navy" : "bg-coral text-white")}>
                      {a.correct ? <Check className="size-3.5" /> : <X className="size-3.5" />} {a.name}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <button type="button" onClick={onDismiss} className={cn(btn.soft, btn.sm, "w-full text-navy")}>
              Cerrar la pregunta
            </button>
          </div>
        )}
      </div>
    );
  }

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
