"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Clock, User, Users } from "lucide-react";
import { api } from "@/lib/api";
import type { RequestMode } from "@/lib/types";
import { useMutation } from "@/components/providers";
import { Card, btn } from "@/components/bits";
import { cn } from "@/lib/utils";

const EXAMPLES = [
  "No entiendo lo de las fracciones",
  "Necesito ecuaciones para el viernes",
  "¿Cómo saco el 15% de descuento?",
  "Me pierdo con la pendiente de una recta",
  "Ayuda con comprensión lectora",
];

function slot(label: string): string | null {
  const d = new Date();
  if (label === "Hoy en la tarde") d.setHours(17, 0, 0, 0);
  else if (label === "Mañana") {
    d.setDate(d.getDate() + 1);
    d.setHours(16, 0, 0, 0);
  } else if (label === "Este fin de semana") {
    d.setDate(d.getDate() + ((6 - d.getDay() + 7) % 7 || 7));
    d.setHours(10, 0, 0, 0);
  } else return null;
  return d.toISOString();
}

const SLOTS = ["Lo antes posible", "Hoy en la tarde", "Mañana", "Este fin de semana"];

export default function NewRequestPage() {
  const router = useRouter();
  const { run, pending } = useMutation();
  const [text, setText] = useState("");
  const [mode, setMode] = useState<RequestMode>("grupo");
  const [when, setWhen] = useState(SLOTS[0]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await run((u) => api.createRequest(u, { text, mode, preferredAt: slot(when) }));
    if (res) router.push(`/match/${res.requestId}`);
  };

  return (
    <form onSubmit={submit} className="mx-auto max-w-2xl space-y-6">
      <div>
        <p className="text-sm font-bold text-primary">Quiero aprender</p>
        <h1 className="font-heading text-3xl font-semibold">¿Qué se te está complicando?</h1>
        <p className="mt-1 text-muted-foreground">Escríbelo como se lo dirías a un amigo. Nosotros encontramos el tema.</p>
      </div>

      <Card className="space-y-3 p-4">
        <label htmlFor="pedido" className="sr-only">
          Lo que quieres aprender
        </label>
        <textarea
          id="pedido"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Ej.: no entiendo cómo sumar fracciones con distinto denominador…"
          rows={4}
          maxLength={280}
          className="w-full resize-none rounded-2xl bg-muted p-4 text-base font-semibold outline-none placeholder:font-medium placeholder:text-muted-foreground focus:ring-4 focus:ring-ring/20"
          autoFocus
        />
        <div className="flex flex-wrap gap-2">
          {EXAMPLES.map((ex) => (
            <button
              type="button"
              key={ex}
              onClick={() => setText(ex)}
              className="rounded-full bg-secondary px-3 py-1.5 text-xs font-bold text-secondary-foreground hover:bg-primary hover:text-white"
            >
              {ex}
            </button>
          ))}
        </div>
      </Card>

      <div>
        <p className="mb-2 font-extrabold">¿Cómo prefieres aprender?</p>
        <div className="grid grid-cols-2 gap-3">
          {(
            [
              { v: "grupo", icon: Users, title: "En grupo", body: "Más barato: el precio se reparte entre 3 a 5.", tag: "Recomendado" },
              { v: "individual", icon: User, title: "Individual", body: "Solo tú y tu tutor. Pagas la clase completa." },
            ] as const
          ).map((o) => (
            <button
              type="button"
              key={o.v}
              onClick={() => setMode(o.v)}
              aria-pressed={mode === o.v}
              className={cn(
                "relative flex flex-col gap-2 rounded-3xl bg-card p-4 text-left ring-1 ring-border transition-all",
                mode === o.v && "ring-2 ring-primary bg-primary/5",
              )}
            >
              {"tag" in o && (
                <span className="absolute top-3 right-3 rounded-full bg-mint px-2 py-0.5 text-[10px] font-black text-accent-foreground">
                  {o.tag}
                </span>
              )}
              <o.icon className={cn("size-6", mode === o.v ? "text-primary" : "text-muted-foreground")} />
              <span className="font-extrabold">{o.title}</span>
              <span className="text-sm text-muted-foreground">{o.body}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 flex items-center gap-1.5 font-extrabold">
          <Clock className="size-4" /> ¿Cuándo?
        </p>
        <div className="flex flex-wrap gap-2">
          {SLOTS.map((s) => (
            <button
              type="button"
              key={s}
              onClick={() => setWhen(s)}
              aria-pressed={when === s}
              className={cn(
                "rounded-full px-4 py-2 text-sm font-bold ring-1 ring-border",
                when === s ? "bg-navy text-white ring-navy" : "bg-card",
              )}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <button type="submit" disabled={pending || text.trim().length < 3} className={cn(btn.primary, btn.lg, "w-full")}>
        {pending ? "Buscando match…" : "Buscar quién me enseñe"}
      </button>
    </form>
  );
}
