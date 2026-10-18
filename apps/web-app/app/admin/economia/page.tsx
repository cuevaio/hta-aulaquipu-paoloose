"use client";

import { ErrorBox, Skeleton } from "@/components/bits";
import { BarRow, Empty, Kpi, PageHeader, Panel, fmt, useAdminMetrics } from "@/components/admin/admin-ui";

/** Economía: cuántos quipus entran, cuántos salen y quién los gana. */
export default function AdminEconomyPage() {
  const { data: m, error } = useAdminMetrics();
  if (error && !m) return <ErrorBox message={error} />;
  if (!m) return <Skeleton className="h-96" />;

  const e = m.economy;
  const into = e.minted + e.granted;
  const out = e.spent_ai + e.spent_shop + e.adjusted;
  const max = Math.max(1, into, out);
  const earnMax = Math.max(1, ...e.top_earners.map((x) => x.earned));

  return (
    <div className="space-y-6">
      <PageHeader title="Economía" subtitle="Salud de los quipus: lo que la plataforma crea, lo que se gasta y cómo se mueve entre alumnos." />

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="En circulación" value={fmt(e.circulation)} tone="gold" sub="suma de todos los saldos" />
        <Kpi label="Entró (bienvenida + regalos)" value={fmt(into)} tone="mint" />
        <Kpi label="Salió (IA, tienda, ajustes)" value={fmt(out)} tone="coral" />
        <Kpi label="Alumnos sin saldo" value={fmt(e.zero_balance_users)} sub={`de ${fmt(m.users.total)}`} tone={e.zero_balance_users ? "gold" : "default"} />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Entra vs sale" hint="Los quipus que crea la plataforma contra los que se consumen.">
          <div className="space-y-3">
            <BarRow label="Bienvenida (mint)" value={e.minted} max={max} tone="mint" />
            <BarRow label="Regalos del panel" value={e.granted} max={max} tone="mint" />
            <BarRow label="Clases con IA" value={e.spent_ai} max={max} tone="coral" />
            <BarRow label="Tienda" value={e.spent_shop} max={max} tone="coral" />
            <BarRow label="Descuentos del panel" value={e.adjusted} max={max} tone="coral" />
          </div>
        </Panel>

        <Panel title="Quienes más ganan enseñando" hint="Quipus recibidos por clases con alumnos.">
          {e.top_earners.length ? (
            <div className="space-y-3">
              {e.top_earners.map((t) => (
                <BarRow key={t.profile_id} label={t.display_name} value={t.earned} max={earnMax} tone="gold" />
              ))}
            </div>
          ) : (
            <Empty>Aún no hay clases pagadas entre alumnos.</Empty>
          )}
          <p className="text-xs text-muted-foreground">
            Movido entre alumnos en clases: <b>{fmt(e.spent_sessions)}</b> quipus (no se crean ni se destruyen, cambian de mano).
          </p>
        </Panel>
      </div>
    </div>
  );
}
