"use client";

import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Barra "pídeselo a la IA" de las herramientas del profe (gráfico, pregunta). `onSubmit` devuelve
 * null si salió bien o el motivo para mostrarlo. `optional`: se puede enviar vacía (usa el tema).
 */
export function AiRequestBar({
  placeholder,
  label,
  onSubmit,
  optional = false,
  className,
}: {
  placeholder: string;
  label: string;
  onSubmit: (text: string) => Promise<string | null>;
  optional?: boolean;
  className?: string;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ready = optional || text.trim().length >= 3;

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (!ready || busy) return;
        setBusy(true);
        setError(null);
        const err = await onSubmit(text.trim());
        setBusy(false);
        if (err) setError(err);
        else setText("");
      }}
      className={cn("rounded-2xl bg-card/95 p-2 shadow-xl ring-1 ring-primary/30 backdrop-blur", className)}
    >
      <div className="flex gap-2">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary" aria-hidden>
          <Sparkles className="size-4" />
        </span>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={400}
          placeholder={placeholder}
          aria-label={placeholder}
          className="min-w-0 flex-1 rounded-xl bg-muted/60 px-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-primary"
        />
        <button
          type="submit"
          disabled={!ready || busy}
          className="flex shrink-0 items-center gap-1 rounded-xl bg-primary px-3 text-sm font-extrabold text-primary-foreground disabled:opacity-50"
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : null} {label}
        </button>
      </div>
      {error && <p className="mt-1.5 px-1 text-xs font-semibold text-coral">{error}</p>}
    </form>
  );
}
