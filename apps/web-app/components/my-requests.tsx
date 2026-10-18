"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { api } from "@/lib/api";
import { useQuery } from "@/components/providers";
import { Card, Pill, SectionTitle, Skeleton } from "@/components/bits";
import { cn } from "@/lib/utils";

const STATUS_LABEL = { open: "Buscando match", matched: "Con match", fulfilled: "Completado", cancelled: "Cancelado" };

/** Pedidos de ayuda del usuario con su estado; los abiertos llevan a la pantalla de match. */
export function MyRequests({ title, action, limit = 4, hideWhenEmpty }: { title: string; action?: React.ReactNode; limit?: number; hideWhenEmpty?: boolean }) {
  const requests = useQuery((u) => api.myRequests(u));
  if (hideWhenEmpty && requests.data?.length === 0) return null;
  return (
    <section id="pedidos" className="scroll-mt-4">
      <SectionTitle action={action}>{title}</SectionTitle>
      {requests.loading && !requests.data && <Skeleton className="h-20" />}
      {requests.data?.length === 0 && (
        <Card className="text-center text-sm text-muted-foreground">
          Aún no pides nada. <Link href="/aprender" className="font-bold text-primary">Publica tu primer pedido</Link>.
        </Card>
      )}
      <div className="space-y-2">
        {requests.data?.slice(0, limit).map((r) => (
          <Link
            key={r.id}
            href={r.status === "open" ? `/match/${r.id}` : "/home"}
            className="flex items-center gap-3 rounded-2xl bg-card p-4 ring-1 ring-border transition-colors hover:ring-primary"
          >
            <div className="min-w-0 flex-1">
              <p className="font-extrabold">{r.topic.name}</p>
              <p className="truncate text-sm text-muted-foreground">“{r.detail}”</p>
            </div>
            <Pill className={cn(r.status === "open" && "bg-gold/30 text-gold-foreground")}>{STATUS_LABEL[r.status]}</Pill>
            {r.status === "open" && <ArrowRight className="size-4 text-muted-foreground" />}
          </Link>
        ))}
      </div>
    </section>
  );
}
