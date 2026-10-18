"use client";

import { api } from "@/lib/api";
import { useQuery } from "@/components/providers";
import { ErrorBox, Skeleton, timeAgo } from "@/components/bits";
import { Empty, PageHeader } from "@/components/admin/admin-ui";

const LABEL: Record<string, string> = {
  "credits.grant": "Regaló quipus",
  "credits.adjust": "Descontó quipus",
  "ai_tutor.price": "Cambió el precio de un tutor IA",
  "promotion.create": "Creó una promoción",
  "promotion.update": "Editó una promoción",
  "promotion.delete": "Eliminó una promoción",
};

function summary(payload: Record<string, unknown>) {
  const entries = Object.entries(payload).filter(([, v]) => v !== null && v !== undefined && v !== "");
  return entries.map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`).join(" · ");
}

/** Auditoría: las últimas 100 acciones de administradores. */
export default function AdminAuditPage() {
  const { data, error } = useQuery((u) => api.admin.audit(u));
  return (
    <>
      <PageHeader title="Auditoría" subtitle="Las últimas 100 acciones del panel: quién, qué y cuándo." />
      {error && !data && <ErrorBox message={error} />}
      {!data && !error && <Skeleton className="h-64" />}
      {data && !data.length && <Empty>Todavía no hay acciones registradas.</Empty>}
      {data && data.length > 0 && (
        <ul className="divide-y divide-border overflow-hidden rounded-3xl bg-card ring-1 ring-border">
          {data.map((r) => (
            <li key={r.id} className="space-y-0.5 px-4 py-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-bold">{LABEL[r.action] ?? r.action}</p>
                <p className="text-xs text-muted-foreground" title={new Date(r.created_at).toLocaleString("es-PE")}>
                  {r.admin_name ?? "Admin"} · {timeAgo(r.created_at)}
                </p>
              </div>
              {r.target && <p className="truncate font-mono text-xs text-muted-foreground">{r.target}</p>}
              <p className="text-xs break-words text-muted-foreground">{summary(r.payload)}</p>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
