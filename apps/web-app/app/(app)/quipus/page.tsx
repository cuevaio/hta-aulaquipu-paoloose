"use client";

import { useMemo, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Lightbulb, ShieldCheck, Wifi } from "lucide-react";
import { api } from "@/lib/api";
import type { LedgerLine } from "@/lib/types";
import { useQuery, useSession } from "@/components/providers";
import { Card, Quipus, SectionTitle, Skeleton } from "@/components/bits";
import { cn } from "@/lib/utils";

const KIND_ICON: Record<LedgerLine["kind"], string> = {
  mint: "🎁",
  session_payment: "🎓",
  ai_session: "🤖",
  skin_purchase: "🛍️",
  refund: "↩️",
  grant: "🎉",
  adjust: "🧾",
};

const TIPS = [
  "Enseñar es la forma de ganar quipus: lo que sabes vale para otros.",
  "En grupo pagas menos por la misma clase. Compara antes de reservar.",
  "Lo reservado ya está comprometido: cuenta solo con tu saldo para gastar.",
  "Antes de comprar una skin, piensa si prefieres usar esos quipus para aprender algo.",
  "Gastar en aprender es una inversión: lo que aprendes lo puedes enseñar después.",
];

type Filter = "todo" | "entradas" | "salidas";

/** Últimos 4 dígitos estables a partir del id del perfil (solo para mostrar en la tarjeta). */
function cardDigits(id: string): string {
  let h = 2166136261;
  for (const ch of id) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  return String(h % 10000).padStart(4, "0");
}

function dayLabel(iso: string): string {
  const d = new Date(iso);
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day(new Date()) - day(d)) / 86_400_000);
  if (diff === 0) return "Hoy";
  if (diff === 1) return "Ayer";
  return new Intl.DateTimeFormat("es-PE", { weekday: "long", day: "numeric", month: "long" }).format(d);
}

function inThisMonth(iso: string): boolean {
  const d = new Date(iso);
  const n = new Date();
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth();
}

export default function BankPage() {
  const { me } = useSession();
  const { data, loading } = useQuery((u) => api.ledger(u));
  const [filter, setFilter] = useState<Filter>("todo");

  const balance = me?.balance ?? 0;
  const available = me?.available ?? 0;
  const reserved = Math.max(0, balance - available);

  const month = useMemo(() => {
    const lines = (data ?? []).filter((l) => inThisMonth(l.created_at));
    const sum = (dir: LedgerLine["direction"]) => lines.filter((l) => l.direction === dir).reduce((a, l) => a + l.amount, 0);
    return { entradas: sum("in"), salidas: sum("out") };
  }, [data]);

  const groups = useMemo(() => {
    const all = data ?? [];
    const list = filter === "entradas" ? all.filter((l) => l.direction === "in") : filter === "salidas" ? all.filter((l) => l.direction === "out") : all;
    const out: { day: string; items: LedgerLine[] }[] = [];
    for (const l of list) {
      const day = dayLabel(l.created_at);
      const last = out.at(-1);
      if (last && last.day === day) last.items.push(l);
      else out.push({ day, items: [l] });
    }
    return out;
  }, [data, filter]);

  if (!me) return <Skeleton className="h-96" />;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <p className="text-sm font-bold text-primary">🏦 Tesorería</p>
        <h1 className="font-heading text-3xl font-semibold">Tu banco de quipus</h1>
      </div>

      {/* Tarjeta estudiante */}
      <div className="relative aspect-[1.6/1] w-full max-w-sm overflow-hidden rounded-[1.5rem] bg-[linear-gradient(135deg,#2b2550_0%,#5b4bdb_55%,#2fd3a3_130%)] p-5 text-white shadow-[0_18px_40px_-12px_rgba(43,37,80,0.6)]">
        <div className="absolute -top-16 -right-16 size-48 rounded-full bg-white/10" aria-hidden />
        <div className="absolute -bottom-20 -left-10 size-56 rounded-full bg-white/5" aria-hidden />
        <div className="relative flex h-full flex-col justify-between">
          <div className="flex items-start justify-between">
            <span className="font-heading text-lg font-semibold">
              Aula<span className="text-mint">Quipu</span>
            </span>
            <span className="text-[10px] font-extrabold tracking-widest text-white/70 uppercase">Tarjeta estudiante</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="h-8 w-11 rounded-md bg-[linear-gradient(135deg,#ffe08a,#c9a227)] ring-1 ring-black/10" aria-hidden />
            <Wifi className="size-5 rotate-90 text-white/70" aria-hidden />
          </div>
          <p className="font-mono text-lg tracking-[0.2em]" aria-label={`Tarjeta terminada en ${cardDigits(me.profile.id)}`}>
            •••• •••• •••• {cardDigits(me.profile.id)}
          </p>
          <div className="flex items-end justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[9px] font-bold tracking-wider text-white/60 uppercase">Titular</p>
              <p className="truncate text-sm font-extrabold uppercase">{me.profile.display_name}</p>
            </div>
            <div className="text-right">
              <p className="text-[9px] font-bold tracking-wider text-white/60 uppercase">Para gastar</p>
              <Quipus amount={available} className="text-xl text-gold" iconClassName="size-5" />
            </div>
          </div>
        </div>
      </div>

      {/* Cuentas */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4">
          <p className="text-xs font-bold text-muted-foreground">💳 Para gastar</p>
          <Quipus amount={available} className="mt-1 text-2xl" iconClassName="size-5" />
          <p className="mt-1 text-[11px] text-muted-foreground">Lo que puedes usar ahora</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-bold text-muted-foreground">⏳ Reservado</p>
          <Quipus amount={reserved} className="mt-1 text-2xl text-muted-foreground" iconClassName="size-5" />
          <p className="mt-1 text-[11px] text-muted-foreground">Clases que se cobran al terminar</p>
        </Card>
      </div>

      {/* Resumen del mes */}
      <Card>
        <SectionTitle>Este mes</SectionTitle>
        <div className="grid grid-cols-2 gap-2 text-center">
          <div className="rounded-2xl bg-mint/15 p-3">
            <p className="text-xs font-bold text-muted-foreground">Entró</p>
            <Quipus amount={month.entradas} sign={month.entradas ? "+" : undefined} className="text-lg text-accent-foreground" />
          </div>
          <div className="rounded-2xl bg-coral/10 p-3">
            <p className="text-xs font-bold text-muted-foreground">Salió</p>
            <Quipus amount={month.salidas} sign={month.salidas ? "−" : undefined} className="text-lg text-coral" />
          </div>
        </div>
      </Card>

      {/* Consejo */}
      <p className="flex items-start gap-2 rounded-2xl bg-gold/20 p-3 text-sm text-gold-foreground">
        <Lightbulb className="mt-0.5 size-4 shrink-0" />
        <span>
          <b>Consejo:</b> {TIPS[(data?.length ?? 0) % TIPS.length]}
        </span>
      </p>

      {/* Movimientos */}
      <section>
        <SectionTitle>Movimientos</SectionTitle>
        <div className="mb-3 flex gap-1 rounded-2xl bg-muted p-1" role="tablist">
          {(
            [
              ["todo", "Todo"],
              ["entradas", "Entradas"],
              ["salidas", "Salidas"],
            ] as const
          ).map(([f, label]) => (
            <button
              key={f}
              role="tab"
              aria-selected={filter === f}
              onClick={() => setFilter(f)}
              className={cn("flex-1 rounded-xl px-3 py-1.5 text-sm font-extrabold", filter === f ? "bg-card shadow-sm" : "text-muted-foreground")}
            >
              {label}
            </button>
          ))}
        </div>
        {loading && !data && <Skeleton className="h-64" />}
        {data && groups.length === 0 && <Card className="text-center text-sm text-muted-foreground">No hay movimientos aquí todavía.</Card>}
        <div className="space-y-4">
          {groups.map((g) => (
            <div key={g.day}>
              <p className="mb-1.5 text-xs font-extrabold tracking-wide text-muted-foreground uppercase">{g.day}</p>
              <Card className="divide-y divide-border p-0">
                {g.items.map((l) => (
                  <div key={l.id} className="flex items-center gap-3 px-4 py-3">
                    <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-muted text-lg" aria-hidden>
                      {KIND_ICON[l.kind]}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-bold">{l.description}</p>
                      <p className="flex items-center gap-1 text-xs text-muted-foreground">
                        {l.direction === "in" ? <ArrowDownLeft className="size-3" /> : <ArrowUpRight className="size-3" />}
                        {new Intl.DateTimeFormat("es-PE", { hour: "numeric", minute: "2-digit" }).format(new Date(l.created_at))} · #{l.id}
                      </p>
                    </div>
                    <Quipus
                      amount={l.amount}
                      sign={l.direction === "in" ? "+" : "−"}
                      className={l.direction === "in" ? "text-accent-foreground" : "text-coral"}
                    />
                  </div>
                ))}
              </Card>
            </div>
          ))}
        </div>
      </section>

      <p className="flex items-start gap-2 rounded-2xl bg-secondary p-3 text-xs text-secondary-foreground">
        <ShieldCheck className="mt-0.5 size-4 shrink-0" />
        Los quipus son dinero de juego: no se compran ni se cambian por soles. Cada movimiento queda registrado y tu saldo es la suma de todos.
      </p>
    </div>
  );
}
