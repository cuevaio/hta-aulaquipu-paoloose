"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useQuery } from "@/components/providers";
import { Card } from "@/components/bits";
import { cn } from "@/lib/utils";

export const inputCls =
  "h-11 w-full rounded-2xl bg-card px-4 text-sm font-semibold ring-1 ring-border outline-none placeholder:text-muted-foreground/60 focus:ring-2 focus:ring-primary";

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-heading text-2xl font-semibold md:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Kpi({
  label,
  value,
  sub,
  tone = "default",
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  tone?: "default" | "gold" | "mint" | "coral";
}) {
  return (
    <div
      className={cn(
        "rounded-3xl p-4 ring-1 ring-border",
        tone === "default" && "bg-card",
        tone === "gold" && "bg-gold/20 ring-gold/40",
        tone === "mint" && "bg-mint/20 ring-mint/40",
        tone === "coral" && "bg-coral/15 ring-coral/40",
      )}
    >
      <p className="text-xs font-bold tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className="mt-1 font-heading text-3xl font-semibold tabular-nums md:text-4xl">{value}</p>
      {sub && <p className="mt-0.5 text-xs font-semibold text-muted-foreground">{sub}</p>}
    </div>
  );
}

/** Barra horizontal simple, solo CSS. */
export function BarRow({ label, value, max, suffix, tone = "primary" }: { label: string; value: number; max: number; suffix?: string; tone?: "primary" | "mint" | "coral" | "gold" }) {
  const pct = max > 0 ? Math.max(3, Math.round((value / max) * 100)) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="min-w-0 truncate font-bold">{label}</span>
        <span className="shrink-0 font-extrabold tabular-nums">
          {value}
          {suffix}
        </span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-muted" role="presentation">
        <div
          className={cn("h-full rounded-full", tone === "primary" && "bg-primary", tone === "mint" && "bg-mint", tone === "coral" && "bg-coral", tone === "gold" && "bg-gold")}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function Panel({ title, hint, children, className }: { title: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <Card className={cn("space-y-3", className)}>
      <div>
        <h2 className="font-heading text-lg font-semibold">{title}</h2>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      {children}
    </Card>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-2xl bg-muted/60 p-3 text-sm text-muted-foreground">{children}</p>;
}

/** Sección que otro módulo del panel llenará más adelante. */
export function ComingSoon({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <>
      <PageHeader title={title} subtitle={subtitle} />
      <Empty>Esta sección se activa en la siguiente entrega del panel.</Empty>
    </>
  );
}

export const fmt = (n: number) => new Intl.NumberFormat("es-PE").format(n);

/** Métricas del panel con recarga automática cada `everyMs` (por defecto 30 s). */
export function useAdminMetrics(everyMs = 30_000) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), everyMs);
    return () => clearInterval(id);
  }, [everyMs]);
  const q = useQuery((u) => api.admin.metrics(u), [tick]);
  return { ...q, refresh: () => setTick((t) => t + 1) };
}
