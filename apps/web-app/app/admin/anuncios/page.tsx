"use client";

import { useState } from "react";
import { Megaphone, Pencil, Plus, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { useMutation, useQuery } from "@/components/providers";
import { Card, ErrorBox, Pill, Skeleton, btn, formatWhen } from "@/components/bits";
import { Empty, PageHeader, Panel, inputCls } from "@/components/admin/admin-ui";
import type { Announcement, AnnouncementInput } from "@/lib/admin-types";
import { ANNOUNCEMENT_MAX } from "@/lib/admin-types";
import { cn } from "@/lib/utils";

/** datetime-local usa la hora local sin zona: se convierte desde/hacia ISO. */
const toLocalInput = (iso: string) => {
  const d = new Date(iso);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};

const blank = (): AnnouncementInput => ({ text: "", active: true, starts_at: new Date().toISOString(), ends_at: null });

/** Anuncios: texto corto que se muestra como banner en el campus mientras esté vigente. */
export default function AdminAnnouncementsPage() {
  const list = useQuery((u) => api.admin.announcements(u));
  const [editing, setEditing] = useState<{ id: string | null; input: AnnouncementInput } | null>(null);

  return (
    <div className="space-y-6">
      <PageHeader title="Anuncios" subtitle="Aparecen como un banner arriba del campus para todos los alumnos. Cada alumno puede cerrarlo y no vuelve a verlo." />
      <Panel title="Anuncios" hint="Se muestran hasta 3 a la vez, los más recientes primero.">
        <div className="flex justify-end">
          <button onClick={() => setEditing({ id: null, input: blank() })} className={cn(btn.primary, btn.sm)}>
            <Plus className="size-4" /> Nuevo anuncio
          </button>
        </div>
        {editing && <Editor key={editing.id ?? "new"} id={editing.id} initial={editing.input} onClose={() => setEditing(null)} />}
        {list.error && !list.data && <ErrorBox message={list.error} />}
        {!list.data && !list.error && <Skeleton className="h-24" />}
        {list.data && !list.data.length && <Empty>No hay anuncios. Crea uno para avisar algo a todo el campus.</Empty>}
        <ul className="space-y-2">
          {list.data?.map((a) => (
            <Row key={a.id} a={a} onEdit={() => setEditing({ id: a.id, input: { text: a.text, active: a.active, starts_at: a.starts_at, ends_at: a.ends_at } })} />
          ))}
        </ul>
      </Panel>
    </div>
  );
}

function Row({ a, onEdit }: { a: Announcement; onEdit: () => void }) {
  const { run, pending } = useMutation();
  const [nowMs] = useState(() => Date.now());
  const live = a.active && Date.parse(a.starts_at) <= nowMs && (!a.ends_at || Date.parse(a.ends_at) > nowMs);
  const state = !a.active ? "Pausado" : live ? "Vigente" : a.ends_at && Date.parse(a.ends_at) <= nowMs ? "Terminado" : "Programado";
  return (
    <li className="flex flex-wrap items-center gap-3 rounded-2xl bg-muted/50 p-3">
      <Megaphone className="size-5 shrink-0 text-primary" />
      <div className="min-w-0 flex-1">
        <p className="font-bold break-words">{a.text}</p>
        <p className="text-xs text-muted-foreground">
          {formatWhen(a.starts_at)} → {a.ends_at ? formatWhen(a.ends_at) : "sin fin"}
        </p>
      </div>
      <Pill className={cn(live ? "bg-mint/30 text-accent-foreground" : "bg-muted text-muted-foreground")}>{state}</Pill>
      <button onClick={onEdit} className={cn(btn.ghost, btn.sm)} aria-label="Editar anuncio">
        <Pencil className="size-4" />
      </button>
      <button
        onClick={() => confirm("¿Eliminar este anuncio?") && run((u) => api.admin.deleteAnnouncement(u, a.id), "Anuncio eliminado")}
        disabled={pending}
        className={cn(btn.ghost, btn.sm, "text-destructive")}
        aria-label="Eliminar anuncio"
      >
        <Trash2 className="size-4" />
      </button>
    </li>
  );
}

function Editor({ id, initial, onClose }: { id: string | null; initial: AnnouncementInput; onClose: () => void }) {
  const { run, pending } = useMutation();
  const [f, setF] = useState<AnnouncementInput>(initial);
  const set = <K extends keyof AnnouncementInput>(k: K, v: AnnouncementInput[K]) => setF((x) => ({ ...x, [k]: v }));

  const startOk = !Number.isNaN(Date.parse(f.starts_at));
  const endOk = !f.ends_at || (!Number.isNaN(Date.parse(f.ends_at)) && Date.parse(f.ends_at) > Date.parse(f.starts_at));
  const textLen = f.text.trim().length;
  const valid = startOk && endOk && textLen >= 1 && textLen <= ANNOUNCEMENT_MAX;

  const save = async () => {
    const res = await run((u) => api.admin.saveAnnouncement(u, id, f), id ? "Anuncio actualizado" : "Anuncio creado");
    if (res) onClose();
  };

  return (
    <Card className="space-y-4 bg-secondary/50">
      <h3 className="font-heading text-base font-semibold">{id ? "Editar anuncio" : "Nuevo anuncio"}</h3>
      <label className="block space-y-1 text-sm font-bold">
        <span className="flex items-baseline justify-between">
          Texto
          <span className={cn("text-xs font-semibold tabular-nums", textLen > ANNOUNCEMENT_MAX ? "text-destructive" : "text-muted-foreground")}>
            {textLen}/{ANNOUNCEMENT_MAX}
          </span>
        </span>
        <textarea value={f.text} onChange={(e) => set("text", e.target.value)} rows={2} placeholder="Mañana hay feria de ciencias en el patio" className={cn(inputCls, "h-auto py-3 font-medium")} aria-invalid={textLen > ANNOUNCEMENT_MAX} />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm font-bold">
          Empieza
          <input type="datetime-local" value={startOk ? toLocalInput(f.starts_at) : ""} onChange={(e) => e.target.value && set("starts_at", new Date(e.target.value).toISOString())} className={inputCls} />
        </label>
        <label className="space-y-1 text-sm font-bold">
          Termina (opcional)
          <input type="datetime-local" value={f.ends_at && !Number.isNaN(Date.parse(f.ends_at)) ? toLocalInput(f.ends_at) : ""} onChange={(e) => set("ends_at", e.target.value ? new Date(e.target.value).toISOString() : null)} className={inputCls} aria-invalid={!endOk} />
        </label>
      </div>
      <label className="flex items-center gap-2 text-sm font-bold">
        <input type="checkbox" checked={f.active} onChange={(e) => set("active", e.target.checked)} className="size-4" />
        Activo
      </label>
      {!endOk && <p className="text-xs font-semibold text-destructive">El anuncio debe terminar después de empezar.</p>}
      <div className="flex gap-2">
        <button onClick={save} disabled={!valid || pending} className={cn(btn.primary, btn.md)}>
          {pending ? "Guardando…" : "Guardar"}
        </button>
        <button onClick={onClose} className={cn(btn.ghost, btn.md)}>
          Cancelar
        </button>
      </div>
    </Card>
  );
}
