"use client";

import { useState } from "react";
import { EyeOff, GitMerge, Pencil, Search } from "lucide-react";
import { api } from "@/lib/api";
import { useMutation, useQuery } from "@/components/providers";
import { Card, ErrorBox, Pill, Skeleton, btn } from "@/components/bits";
import { Empty, Panel, inputCls } from "@/components/admin/admin-ui";
import type { AdminTopic } from "@/lib/admin-types";
import { cn } from "@/lib/utils";

/** Temas: renombrar, ocultar (flagged) y unir duplicados. */
export function TopicsSection() {
  const topics = useQuery((u) => api.admin.topics(u));
  const [filter, setFilter] = useState("");
  const [merging, setMerging] = useState<AdminTopic | null>(null);

  if (topics.error && !topics.data) return <ErrorBox message={topics.error} />;
  const q = filter.trim().toLowerCase();
  const shown = topics.data?.filter((t) => !q || t.name.toLowerCase().includes(q));

  return (
    <Panel title="Temas" hint="Los temas ocultos no aparecen en la búsqueda ni en los listados, pero sus datos se conservan. Unir mueve todo al tema que elijas y borra el duplicado.">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Buscar tema" aria-label="Buscar tema" className={cn(inputCls, "pl-10")} />
      </div>
      {merging && topics.data && <MergeDialog source={merging} topics={topics.data} onClose={() => setMerging(null)} />}
      {!topics.data && <Skeleton className="h-40" />}
      {shown && !shown.length && <Empty>No hay temas con ese nombre.</Empty>}
      <ul className="divide-y divide-border">
        {shown?.map((t) => (
          <TopicRow key={t.id} topic={t} onMerge={() => setMerging(t)} />
        ))}
      </ul>
    </Panel>
  );
}

function TopicRow({ topic, onMerge }: { topic: AdminTopic; onMerge: () => void }) {
  const { run, pending } = useMutation();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(topic.name);
  const hidden = topic.status === "flagged";

  const save = async () => {
    if (name.trim() === topic.name) return setEditing(false);
    const ok = await run(async (u) => (await api.admin.updateTopic(u, topic.id, { name }), true), "Tema renombrado");
    if (ok) setEditing(false);
  };

  return (
    <li className="flex flex-wrap items-center gap-3 py-3">
      <div className="min-w-0 flex-1">
        {editing ? (
          <div className="flex gap-2">
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} aria-label="Nombre del tema" className={cn(inputCls, "h-9")} onKeyDown={(e) => e.key === "Enter" && save()} />
            <button onClick={save} disabled={pending || name.trim().length < 2} className={cn(btn.primary, btn.sm)}>
              Guardar
            </button>
            <button
              onClick={() => {
                setName(topic.name);
                setEditing(false);
              }}
              className={cn(btn.ghost, btn.sm)}
            >
              Cancelar
            </button>
          </div>
        ) : (
          <p className={cn("truncate font-extrabold", hidden && "text-muted-foreground line-through")}>{topic.name}</p>
        )}
        <p className="text-xs text-muted-foreground">
          {topic.requests} pedidos ({topic.open_requests} abiertos) · {topic.tutors} tutores · {topic.ai_tutors} IA{topic.has_guide ? " · con guía" : ""}
        </p>
      </div>
      {hidden && <Pill className="bg-coral/20 text-foreground">Oculto</Pill>}
      {!editing && (
        <>
          <button onClick={() => setEditing(true)} className={cn(btn.ghost, btn.sm)} aria-label={`Renombrar ${topic.name}`}>
            <Pencil className="size-4" />
          </button>
          <button
            onClick={() => run((u) => api.admin.updateTopic(u, topic.id, { status: hidden ? "active" : "flagged" }), hidden ? "Tema visible otra vez" : "Tema oculto")}
            disabled={pending}
            className={cn(btn.ghost, btn.sm)}
            aria-label={hidden ? `Mostrar ${topic.name}` : `Ocultar ${topic.name}`}
          >
            <EyeOff className="size-4" /> {hidden ? "Mostrar" : "Ocultar"}
          </button>
          <button onClick={onMerge} className={cn(btn.ghost, btn.sm)} aria-label={`Unir ${topic.name} en otro tema`}>
            <GitMerge className="size-4" /> Unir
          </button>
        </>
      )}
    </li>
  );
}

function MergeDialog({ source, topics, onClose }: { source: AdminTopic; topics: AdminTopic[]; onClose: () => void }) {
  const { run, pending } = useMutation();
  const [targetId, setTargetId] = useState("");
  const target = topics.find((t) => t.id === targetId);

  const merge = async () => {
    const res = await run((u) => api.admin.mergeTopics(u, source.id, targetId), `“${source.name}” se unió en “${target?.name}”`);
    if (res) onClose();
  };

  return (
    <Card className="space-y-3 bg-secondary/50">
      <h3 className="font-heading text-base font-semibold">Unir “{source.name}” en otro tema</h3>
      <p className="text-sm text-muted-foreground">
        Los {source.requests} pedidos, {source.tutors} tutores humanos, {source.ai_tutors} tutores IA, clases y grupos pasan al tema destino (sin duplicar tutores). Si el destino no tiene guía IA, hereda la de este. Luego “{source.name}” se borra. No se puede deshacer.
      </p>
      <label className="block space-y-1 text-sm font-bold">
        Tema destino
        <select value={targetId} onChange={(e) => setTargetId(e.target.value)} className={inputCls}>
          <option value="">Elige un tema</option>
          {topics
            .filter((t) => t.id !== source.id)
            .map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
        </select>
      </label>
      <div className="flex gap-2">
        <button onClick={merge} disabled={!targetId || pending} className={cn(btn.danger, btn.md)}>
          {pending ? "Uniendo…" : "Unir temas"}
        </button>
        <button onClick={onClose} className={cn(btn.ghost, btn.md)}>
          Cancelar
        </button>
      </div>
    </Card>
  );
}
