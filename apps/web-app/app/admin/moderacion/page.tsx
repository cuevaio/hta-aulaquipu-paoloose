"use client";

import { useState } from "react";
import { Ban, CheckCheck, Clock, Search, ShieldCheck, UserX } from "lucide-react";
import { api } from "@/lib/api";
import { useMutation, useQuery } from "@/components/providers";
import { Card, ErrorBox, Pill, Skeleton, Quipus, btn, timeAgo } from "@/components/bits";
import { Empty, PageHeader, Panel, fmt, inputCls } from "@/components/admin/admin-ui";
import type { ChatReport, ModUser, StuckSession } from "@/lib/admin-types";
import { STUCK_AFTER_MIN } from "@/lib/admin-types";
import { cn } from "@/lib/utils";

/** Moderación: reportes del chat, clases atascadas y suspensión de cuentas. */
export default function AdminModerationPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Moderación" subtitle="Atiende los reportes del chat, cierra clases atascadas y suspende o reactiva cuentas. Todo queda en la auditoría." />
      <ReportsPanel />
      <StuckPanel />
      <UsersPanel />
    </div>
  );
}

function ReportsPanel() {
  const reports = useQuery((u) => api.admin.chatReports(u));
  return (
    <Panel title="Reportes del chat" hint="Mensajes que los alumnos reportaron en el campus. Resolver lo quita de la bandeja; suspender además bloquea la cuenta.">
      {reports.error && !reports.data && <ErrorBox message={reports.error} />}
      {!reports.data && !reports.error && <Skeleton className="h-24" />}
      {reports.data && !reports.data.length && <Empty>No hay reportes pendientes.</Empty>}
      <ul className="space-y-2">
        {reports.data?.map((r) => (
          <ReportRow key={r.id} report={r} />
        ))}
      </ul>
    </Panel>
  );
}

function ReportRow({ report }: { report: ChatReport }) {
  const { run, pending } = useMutation();
  return (
    <li className="space-y-2 rounded-2xl bg-muted/50 p-3">
      <p className="rounded-xl bg-card px-3 py-2 text-sm break-words ring-1 ring-border">“{report.text}”</p>
      <p className="text-xs text-muted-foreground">
        <b className="text-foreground">{report.reported_name}</b> fue reportado por {report.reporter_name} · {timeAgo(report.created_at)}
        {report.reported_suspended && " · ya está suspendido"}
      </p>
      <div className="flex flex-wrap gap-2">
        <button onClick={() => run((u) => api.admin.resolveReport(u, report.id, false), "Reporte resuelto")} disabled={pending} className={cn(btn.soft, btn.sm)}>
          <CheckCheck className="size-4" /> Resolver
        </button>
        {!report.reported_suspended && (
          <button
            onClick={() => confirm(`¿Suspender a ${report.reported_name} y resolver el reporte?`) && run((u) => api.admin.resolveReport(u, report.id, true), `${report.reported_name} suspendido`)}
            disabled={pending}
            className={cn(btn.danger, btn.sm)}
          >
            <Ban className="size-4" /> Suspender y resolver
          </button>
        )}
      </div>
    </li>
  );
}

function StuckPanel() {
  const stuck = useQuery((u) => api.admin.stuckSessions(u));
  return (
    <Panel
      title="Clases atascadas"
      hint={`Clases en vivo desde hace más de ${STUCK_AFTER_MIN} minutos. Cerrarlas no cobra nada y libera los quipus retenidos a los alumnos; el pedido vuelve a quedar abierto.`}
    >
      {stuck.error && !stuck.data && <ErrorBox message={stuck.error} />}
      {!stuck.data && !stuck.error && <Skeleton className="h-20" />}
      {stuck.data && !stuck.data.length && <Empty>No hay clases atascadas.</Empty>}
      <ul className="space-y-2">
        {stuck.data?.map((s) => (
          <StuckRow key={s.id} s={s} />
        ))}
      </ul>
    </Panel>
  );
}

function StuckRow({ s }: { s: StuckSession }) {
  const { run, pending } = useMutation();
  const close = () => {
    if (!confirm("¿Cerrar esta clase sin cobrar? No se puede deshacer.")) return;
    void run((u) => api.admin.cancelSession(u, s.id), "Clase cerrada sin cobro; se liberaron los quipus retenidos");
  };
  return (
    <li className="flex flex-wrap items-center gap-3 rounded-2xl bg-muted/50 p-3">
      <Clock className="size-5 shrink-0 text-coral" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-bold">
          {s.topic ?? "Tema libre"} · {s.tutor_kind === "ai" ? "IA" : "Humano"} · {s.tutor_name}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {s.student_names.join(", ") || "Sin alumnos"} · en vivo hace {fmt(s.minutes)} min · retenidos {fmt(s.held)} quipus
        </p>
      </div>
      <button onClick={close} disabled={pending} className={cn(btn.danger, btn.sm)}>
        Cerrar con reembolso
      </button>
    </li>
  );
}

function UsersPanel() {
  const [query, setQuery] = useState("");
  const q = query.trim();
  const users = useQuery((u) => api.admin.moderationUsers(u, q), [q]);
  const [suspending, setSuspending] = useState<ModUser | null>(null);

  return (
    <Panel title="Cuentas" hint="Busca por nombre o usuario. Sin búsqueda se muestran las cuentas suspendidas. Una cuenta suspendida no puede entrar ni usar la API.">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Nombre o usuario (mínimo 2 letras)" aria-label="Buscar cuenta" className={cn(inputCls, "pl-10")} />
      </div>
      {suspending && <SuspendForm user={suspending} onClose={() => setSuspending(null)} />}
      {users.error && !users.data && <ErrorBox message={users.error} />}
      {!users.data && !users.error && <Skeleton className="h-20" />}
      {users.data && !users.data.length && <Empty>{q.length >= 2 ? "No encontramos cuentas con esa búsqueda." : "No hay cuentas suspendidas."}</Empty>}
      <ul className="divide-y divide-border">
        {users.data?.map((u) => (
          <UserRow key={u.id} user={u} onSuspend={() => setSuspending(u)} />
        ))}
      </ul>
    </Panel>
  );
}

function UserRow({ user, onSuspend }: { user: ModUser; onSuspend: () => void }) {
  const { run, pending } = useMutation();
  const suspended = !!user.suspended_at;
  return (
    <li className="flex flex-wrap items-center gap-3 py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate font-extrabold">
          {user.display_name} <span className="font-medium text-muted-foreground">@{user.username}</span>
        </p>
        <p className="text-xs text-muted-foreground">
          {user.grade}.º grado · {user.school ?? "Sin colegio"} · <Quipus amount={user.balance} /> · {fmt(user.sessions)} clases completadas
        </p>
        {suspended && (
          <p className="text-xs font-semibold text-destructive">
            Suspendido {timeAgo(user.suspended_at!)}: {user.suspended_reason}
          </p>
        )}
      </div>
      {suspended ? (
        <>
          <Pill className="bg-coral/20 text-foreground">Suspendido</Pill>
          <button onClick={() => run((u) => api.admin.reactivateUser(u, user.id), `${user.display_name} reactivado`)} disabled={pending} className={cn(btn.soft, btn.sm)}>
            <ShieldCheck className="size-4" /> Reactivar
          </button>
        </>
      ) : (
        <button onClick={onSuspend} className={cn(btn.ghost, btn.sm, "text-destructive")}>
          <UserX className="size-4" /> Suspender
        </button>
      )}
    </li>
  );
}

function SuspendForm({ user, onClose }: { user: ModUser; onClose: () => void }) {
  const { run, pending } = useMutation();
  const [reason, setReason] = useState("");
  const valid = reason.trim().length >= 3 && reason.trim().length <= 140;
  const save = async () => {
    const res = await run(async (u) => (await api.admin.suspendUser(u, user.id, reason.trim()), true), `${user.display_name} suspendido`);
    if (res) onClose();
  };
  return (
    <Card className="space-y-3 bg-secondary/50">
      <h3 className="font-heading text-base font-semibold">Suspender a {user.display_name}</h3>
      <label className="block space-y-1 text-sm font-bold">
        Motivo (obligatorio)
        <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={140} placeholder="Lenguaje ofensivo en el chat" className={inputCls} />
      </label>
      <div className="flex gap-2">
        <button onClick={save} disabled={!valid || pending} className={cn(btn.danger, btn.md)}>
          {pending ? "Suspendiendo…" : "Suspender cuenta"}
        </button>
        <button onClick={onClose} className={cn(btn.ghost, btn.md)}>
          Cancelar
        </button>
      </div>
    </Card>
  );
}
