"use client";

import { ArrowDownLeft, ArrowUpRight, ShieldCheck } from "lucide-react";
import { api } from "@/lib/api";
import { useQuery, useSession } from "@/components/providers";
import { Card, Quipus, SectionTitle, Skeleton, timeAgo } from "@/components/bits";
import { cn } from "@/lib/utils";

export default function LedgerPage() {
  const { me } = useSession();
  const { data, loading } = useQuery((u) => api.ledger(u));

  const earned = data?.filter((l) => l.direction === "in" && l.kind !== "mint").reduce((a, l) => a + l.amount, 0) ?? 0;
  const spent = data?.filter((l) => l.direction === "out").reduce((a, l) => a + l.amount, 0) ?? 0;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="hero-sky rounded-[2rem] p-6 text-white">
        <p className="text-xs font-bold tracking-wider text-white/60 uppercase">Saldo actual</p>
        <div>
          {me ? <Quipus amount={me.balance} className="text-5xl text-gold" iconClassName="size-10" /> : <Skeleton className="h-12 w-32 bg-white/10" />}
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-white/10 p-3">
            <p className="text-xs font-bold text-white/60">Ganado enseñando</p>
            <Quipus amount={earned} className="text-xl text-mint" sign="+" />
          </div>
          <div className="rounded-2xl bg-white/10 p-3">
            <p className="text-xs font-bold text-white/60">Gastado aprendiendo y en la tienda</p>
            <Quipus amount={spent} className="text-xl text-coral" sign="−" />
          </div>
        </div>
      </div>

      <p className="flex items-start gap-2 rounded-2xl bg-secondary p-3 text-sm text-secondary-foreground">
        <ShieldCheck className="mt-0.5 size-4 shrink-0" />
        Los quipus son dinero de juego: no se compran ni se cambian por soles. Tu saldo es la suma de todos estos movimientos.
      </p>

      <section>
        <SectionTitle>Movimientos</SectionTitle>
        {loading && !data && <Skeleton className="h-64" />}
        <Card className="divide-y divide-border p-0">
          {data?.map((l) => (
            <div key={l.id} className="flex items-center gap-3 px-4 py-3">
              <span
                className={cn(
                  "grid size-10 shrink-0 place-items-center rounded-2xl",
                  l.direction === "in" ? "bg-mint/25 text-accent-foreground" : "bg-coral/15 text-coral",
                )}
              >
                {l.direction === "in" ? <ArrowDownLeft className="size-5" /> : <ArrowUpRight className="size-5" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold">{l.description}</p>
                <p className="text-xs text-muted-foreground">
                  {timeAgo(l.created_at)} · #{l.id}
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
      </section>
    </div>
  );
}
