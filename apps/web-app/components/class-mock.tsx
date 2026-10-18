import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

// Maqueta ligera de una clase (solo presentación, sin datos reales) para /info y /presentacion.
// Usa container queries: el diseño depende del ancho del contenedor, no de la pantalla.

const OPTIONS = [
  { label: "(0, 0)", correct: true },
  { label: "(1, 1)", correct: false },
  { label: "(0, 1)", correct: false },
];

function Parabola() {
  return (
    <svg viewBox="0 0 240 180" className="h-full w-full" role="img" aria-label="Gráfica de la parábola y igual a x al cuadrado">
      <g stroke="#f4efe3" strokeOpacity="0.1" strokeWidth="1">
        {[30, 60, 90, 120, 150, 180, 210].map((x) => (
          <path key={`v${x}`} d={`M${x} 10V170`} />
        ))}
        {[40, 70, 100, 130].map((y) => (
          <path key={`h${y}`} d={`M10 ${y}H230`} />
        ))}
      </g>
      <g stroke="#b9b5c9" strokeWidth="1.5">
        <path d="M10 150H230" />
        <path d="M120 10V170" />
      </g>
      <path d="M72 14 C 92 118, 108 150, 120 150 C 132 150, 148 118, 168 14" fill="none" stroke="#d9b25f" strokeWidth="3" strokeLinecap="round" />
      <circle cx="120" cy="150" r="4.5" fill="#15142c" stroke="#d9b25f" strokeWidth="2.5" />
      <text x="178" y="34" fontSize="13" fontWeight="700" fill="#f4efe3">
        y = x²
      </text>
    </svg>
  );
}

export function ClassMock({ className }: { className?: string }) {
  return (
    <div className={cn("@container overflow-hidden rounded-2xl bg-ink-2 shadow-2xl shadow-black/40 ring-1 ring-cream/10", className)}>
      <div className="flex items-center gap-2 border-b border-cream/10 px-4 py-2.5 text-xs font-bold text-cream-dim">
        <span className="size-2 rounded-full bg-aurum" aria-hidden />
        En vivo · Parábolas con tu tutor
      </div>
      <div className="grid gap-4 p-4 @2xl:grid-cols-[1fr_1fr]">
        <div className="flex flex-col gap-3">
          <div className="flex items-start gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-aurum text-xs font-extrabold text-ink" aria-hidden>
              IA
            </span>
            <p className="rounded-2xl rounded-tl-sm bg-ink-3 px-4 py-3 text-sm leading-snug text-cream">
              Grafiquemos y = x². Mira dónde se detiene la curva antes de subir otra vez.
            </p>
          </div>
          <div className="h-44 rounded-xl bg-ink p-2 ring-1 ring-cream/10 @2xl:h-full @2xl:min-h-44">
            <Parabola />
          </div>
        </div>
        <div className="flex flex-col justify-center rounded-xl bg-ink p-4 ring-1 ring-cream/10">
          <p className="text-xs font-bold tracking-wide text-aurum uppercase">Actividad</p>
          <p className="mt-1 mb-3 font-heading text-lg leading-snug text-cream">¿Cuál es el vértice de y = x²?</p>
          <ul className="space-y-2">
            {OPTIONS.map((o) => (
              <li
                key={o.label}
                className={cn(
                  "flex items-center justify-between rounded-lg px-3 py-2 text-sm font-bold",
                  o.correct ? "bg-aurum/15 text-aurum ring-1 ring-aurum/70" : "text-cream-dim ring-1 ring-cream/15",
                )}
              >
                {o.label}
                {o.correct && <Check className="size-4" aria-label="Respuesta correcta" />}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
