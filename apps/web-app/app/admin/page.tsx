"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { ErrorBox, Pill, Skeleton, Stars, timeAgo } from "@/components/bits";
import { BarRow, Empty, Kpi, Panel, fmt, useAdminMetrics } from "@/components/admin/admin-ui";

/** Resumen: tracción en vivo + demanda sin oferta + calidad. Se recarga solo cada 30 s. */
export default function AdminSummaryPage() {
  const { data: m, error, loading, refresh } = useAdminMetrics();
  // Reloj para el "actualizado hace…" sin depender de la recarga
  const [, setClock] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setClock((c) => c + 1), 10_000);
    return () => clearInterval(id);
  }, []);

  if (error && !m) return <ErrorBox message={error} />;
  if (!m) return <Skeleton className="h-96" />;

  const classesTotal = m.classes.human_total + m.classes.ai_total;
  const classesToday = m.classes.human_today + m.classes.ai_today;
  const topMax = Math.max(1, ...m.top_topics.map((t) => t.requests));

  return (
    <div className="space-y-6">
      <section className="hero-sky rounded-[2rem] p-5 text-white md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="inline-flex items-center gap-2 text-xs font-bold tracking-wider text-white/70 uppercase">
            <span className="relative flex size-2.5">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-70" />
              <span className="relative inline-flex size-2.5 rounded-full bg-success" />
            </span>
            Tracción en vivo
          </p>
          <button
            onClick={refresh}
            className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-white/80 hover:bg-white/20"
            aria-label="Actualizar ahora"
          >
            <RefreshCw className={loading ? "size-3.5 animate-spin" : "size-3.5"} />
            Actualizado {timeAgo(m.generated_at)} · cada 30 s
          </button>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <BigStat label="Alumnos registrados" value={fmt(m.users.total)} sub={`+${m.users.last24h} en 24 h`} />
          <BigStat label="Activos hoy" value={fmt(m.active_today)} sub={m.users.total ? `${Math.round((m.active_today / m.users.total) * 100)} % de la comunidad` : undefined} />
          <BigStat label="Clases completadas" value={fmt(classesTotal)} sub={`${classesToday} hoy · ${m.classes.live_now} en vivo`} />
          <BigStat label="Quipus en circulación" value={fmt(m.economy.circulation)} sub="dinero de juego" gold />
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Clases con alumnos" value={fmt(m.classes.human_total)} sub={`${m.classes.human_today} hoy`} />
        <Kpi label="Clases con IA" value={fmt(m.classes.ai_total)} sub={`${m.classes.ai_today} hoy`} />
        <Kpi label="Clases cortas (< 5 min)" value={fmt(m.short_classes.count)} tone={m.short_classes.count ? "coral" : "default"} sub="revisar calidad" />
        <Kpi label="Temas sin tutor" value={fmt(m.demand_gaps.length)} tone={m.demand_gaps.length ? "gold" : "default"} sub="con pedidos abiertos" />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Temas más pedidos" hint="Pedidos de aprendizaje acumulados.">
          {m.top_topics.length ? (
            <div className="space-y-3">
              {m.top_topics.map((t) => (
                <BarRow key={t.topic_id} label={t.name} value={t.requests} max={topMax} />
              ))}
            </div>
          ) : (
            <Empty>Aún no hay pedidos.</Empty>
          )}
        </Panel>

        <Panel title="Demanda sin oferta" hint="Temas con pedidos abiertos y ningún tutor que los enseñe: hay que reclutar.">
          {m.demand_gaps.length ? (
            <ul className="divide-y divide-border">
              {m.demand_gaps.map((g) => (
                <li key={g.topic_id} className="flex items-center justify-between gap-3 py-2">
                  <span className="font-bold">{g.name}</span>
                  <Pill className="bg-gold/25 text-gold-foreground">
                    {g.open_requests} {g.open_requests === 1 ? "pedido" : "pedidos"}
                  </Pill>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>Todos los temas con pedidos tienen al menos un tutor.</Empty>
          )}
        </Panel>

        <Panel title="Ranking de tutores" hint="Promedio de estrellas (mínimo 1 reseña).">
          {m.tutor_ranking.length ? (
            <ol className="divide-y divide-border">
              {m.tutor_ranking.map((t, i) => (
                <li key={t.tutor_id} className="flex items-center gap-3 py-2">
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-secondary text-xs font-extrabold">{i + 1}</span>
                  <span className="min-w-0 flex-1 truncate font-bold">{t.display_name}</span>
                  <Stars value={Number(t.avg_stars)} count={t.sessions} />
                  <span className="text-xs text-muted-foreground">{t.reviews} reseñas</span>
                </li>
              ))}
            </ol>
          ) : (
            <Empty>Todavía no hay reseñas de tutores.</Empty>
          )}
        </Panel>

        <Panel title="Clases cortas" hint="Clases completadas en menos de 5 minutos.">
          {m.short_classes.items.length ? (
            <ul className="divide-y divide-border">
              {m.short_classes.items.map((c) => (
                <li key={c.session_id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className="min-w-0 truncate font-bold">{c.topic ?? "Tema libre"}</span>
                  <span className="shrink-0 text-muted-foreground">
                    {c.tutor_kind === "ai" ? "IA" : "Alumno"} · {c.minutes} min · {timeAgo(c.ended_at)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>Ninguna clase terminó antes de los 5 minutos.</Empty>
          )}
        </Panel>
      </div>

      <Panel title="Reseñas bajas recientes" hint="1 o 2 estrellas, con el comentario privado del alumno (solo visible para administradores).">
        {m.low_reviews.length ? (
          <ul className="divide-y divide-border">
            {m.low_reviews.map((r) => (
              <li key={r.id} className="space-y-1 py-3">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <Stars value={r.stars} />
                  <span className="font-bold">{r.tutor_name ?? "Tutor"}</span>
                  {r.is_ai && <Pill>IA</Pill>}
                  <span className="text-muted-foreground">
                    {r.topic ?? "Tema libre"} · {timeAgo(r.created_at)}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">{r.feedback ? `“${r.feedback}”` : "Sin comentario."}</p>
              </li>
            ))}
          </ul>
        ) : (
          <Empty>No hay reseñas de 1 o 2 estrellas.</Empty>
        )}
      </Panel>
    </div>
  );
}

function BigStat({ label, value, sub, gold }: { label: string; value: string; sub?: string; gold?: boolean }) {
  return (
    <div className="rounded-2xl bg-white/10 p-3 md:p-4">
      <p className="text-xs font-bold text-white/60">{label}</p>
      <p className={`mt-1 font-heading text-3xl font-semibold tabular-nums md:text-4xl ${gold ? "text-gold" : ""}`}>{value}</p>
      {sub && <p className="mt-0.5 text-xs font-semibold text-white/60">{sub}</p>}
    </div>
  );
}
