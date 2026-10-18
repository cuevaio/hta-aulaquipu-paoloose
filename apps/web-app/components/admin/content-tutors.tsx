"use client";

import { useState } from "react";
import { Pause, Pencil, Play, Plus } from "lucide-react";
import { api } from "@/lib/api";
import { useMutation, useQuery } from "@/components/providers";
import { AiAvatar } from "@/components/avatar";
import { Card, ErrorBox, Pill, Skeleton, btn } from "@/components/bits";
import { Empty, Panel, inputCls } from "@/components/admin/admin-ui";
import type { AdminAiTutor, AdminTopic, AiTutorInput } from "@/lib/admin-types";
import { AI_VOICES } from "@/lib/admin-validate";
import { cn } from "@/lib/utils";

const VOICE_LABEL: Record<string, string> = { warm: "Cálida", bright: "Alegre", calm: "Tranquila" };

const blank = (): AiTutorInput => ({
  name: "",
  emoji: "🤖",
  color: "#7C6BF2",
  tagline: "",
  style: "paso a paso",
  focus: "",
  voice: "warm",
  price_quipus: 30,
  active: true,
  topic_ids: [],
});

const toInput = (t: AdminAiTutor): AiTutorInput => ({
  name: t.name,
  emoji: t.emoji,
  color: t.color,
  tagline: t.tagline,
  style: t.style,
  focus: t.focus,
  voice: t.voice || "warm",
  price_quipus: t.price_quipus,
  active: t.active,
  topic_ids: t.topic_ids,
});

/** Tutores IA: crear, editar persona, temas, precio y pausar. */
export function TutorsSection() {
  const tutors = useQuery((u) => api.admin.aiTutors(u));
  const topics = useQuery((u) => api.admin.topics(u));
  const [editing, setEditing] = useState<{ id: string | null; input: AiTutorInput } | null>(null);

  if (tutors.error && !tutors.data) return <ErrorBox message={tutors.error} />;

  return (
    <Panel title="Tutores IA" hint="Un tutor en pausa no aparece en los listados ni se puede reservar; las clases ya reservadas siguen. Los cambios de precio no afectan clases ya reservadas.">
      <div className="flex justify-end">
        <button onClick={() => setEditing({ id: null, input: blank() })} className={cn(btn.primary, btn.sm)}>
          <Plus className="size-4" /> Nuevo tutor IA
        </button>
      </div>
      {editing && (
        <TutorEditor key={editing.id ?? "new"} id={editing.id} initial={editing.input} topics={topics.data ?? []} onClose={() => setEditing(null)} />
      )}
      {!tutors.data && <Skeleton className="h-32" />}
      {tutors.data && !tutors.data.length && <Empty>No hay tutores IA. Crea el primero.</Empty>}
      <ul className="divide-y divide-border">
        {tutors.data?.map((t) => (
          <TutorRow key={t.id} tutor={t} onEdit={() => setEditing({ id: t.id, input: toInput(t) })} />
        ))}
      </ul>
    </Panel>
  );
}

function TutorRow({ tutor, onEdit }: { tutor: AdminAiTutor; onEdit: () => void }) {
  const { run, pending } = useMutation();
  return (
    <li className="flex flex-wrap items-center gap-3 py-3">
      <AiAvatar emoji={tutor.emoji} color={tutor.color} size={44} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-extrabold">{tutor.name}</p>
        <p className="truncate text-xs text-muted-foreground">
          {tutor.tagline || "Sin descripción"} · {tutor.price_quipus} quipus · {tutor.topic_ids.length} temas
        </p>
      </div>
      {!tutor.active && <Pill className="bg-gold/30 text-foreground">En pausa</Pill>}
      <button onClick={onEdit} className={cn(btn.ghost, btn.sm)} aria-label={`Editar ${tutor.name}`}>
        <Pencil className="size-4" />
      </button>
      <button
        onClick={() => run((u) => api.admin.saveAiTutor(u, tutor.id, { ...toInput(tutor), active: !tutor.active }), tutor.active ? `${tutor.name} en pausa` : `${tutor.name} activo`)}
        disabled={pending}
        className={cn(btn.ghost, btn.sm)}
      >
        {tutor.active ? (
          <>
            <Pause className="size-4" /> Pausar
          </>
        ) : (
          <>
            <Play className="size-4" /> Reanudar
          </>
        )}
      </button>
    </li>
  );
}

function TutorEditor({ id, initial, topics, onClose }: { id: string | null; initial: AiTutorInput; topics: AdminTopic[]; onClose: () => void }) {
  const { run, pending } = useMutation();
  const [f, setF] = useState<AiTutorInput>(initial);
  const set = <K extends keyof AiTutorInput>(k: K, v: AiTutorInput[K]) => setF((x) => ({ ...x, [k]: v }));
  const toggle = (topicId: string) => set("topic_ids", f.topic_ids.includes(topicId) ? f.topic_ids.filter((x) => x !== topicId) : [...f.topic_ids, topicId]);

  const valid = f.name.trim().length >= 2 && f.emoji.trim().length > 0 && /^#[0-9a-fA-F]{6}$/.test(f.color) && f.price_quipus >= 1 && f.price_quipus <= 500;

  const save = async () => {
    const res = await run((u) => api.admin.saveAiTutor(u, id, f), id ? "Tutor IA actualizado" : "Tutor IA creado");
    if (res) onClose();
  };

  return (
    <Card className="space-y-4 bg-secondary/50">
      <div className="flex items-center gap-3">
        <AiAvatar emoji={f.emoji || "🤖"} color={/^#[0-9a-fA-F]{6}$/.test(f.color) ? f.color : "#7C6BF2"} size={48} />
        <h3 className="font-heading text-base font-semibold">{id ? "Editar tutor IA" : "Nuevo tutor IA"}</h3>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm font-bold">
          Nombre
          <input value={f.name} onChange={(e) => set("name", e.target.value)} maxLength={30} className={inputCls} />
        </label>
        <label className="space-y-1 text-sm font-bold">
          Precio (quipus)
          <input value={f.price_quipus} onChange={(e) => set("price_quipus", Number(e.target.value.replace(/\D/g, "").slice(0, 3)) || 0)} inputMode="numeric" className={inputCls} aria-invalid={f.price_quipus < 1} />
        </label>
        <label className="space-y-1 text-sm font-bold">
          Emoji
          <input value={f.emoji} onChange={(e) => set("emoji", e.target.value)} maxLength={8} className={inputCls} />
        </label>
        <label className="space-y-1 text-sm font-bold">
          Color
          <span className="flex gap-2">
            <input type="color" value={/^#[0-9a-fA-F]{6}$/.test(f.color) ? f.color : "#7C6BF2"} onChange={(e) => set("color", e.target.value)} className="h-11 w-14 shrink-0 rounded-2xl bg-card p-1 ring-1 ring-border" aria-label="Elegir color" />
            <input value={f.color} onChange={(e) => set("color", e.target.value)} maxLength={7} className={inputCls} />
          </span>
        </label>
        <label className="space-y-1 text-sm font-bold sm:col-span-2">
          Descripción corta
          <input value={f.tagline} onChange={(e) => set("tagline", e.target.value)} maxLength={60} placeholder="Matemática con paciencia andina" className={inputCls} />
        </label>
        <label className="space-y-1 text-sm font-bold">
          Estilo de enseñanza
          <input value={f.style} onChange={(e) => set("style", e.target.value)} maxLength={60} placeholder="paso a paso" className={inputCls} />
        </label>
        <label className="space-y-1 text-sm font-bold">
          Especialidad
          <input value={f.focus} onChange={(e) => set("focus", e.target.value)} maxLength={40} placeholder="matemática" className={inputCls} />
        </label>
        <label className="space-y-1 text-sm font-bold">
          Voz
          <select value={f.voice} onChange={(e) => set("voice", e.target.value)} className={inputCls}>
            {AI_VOICES.map((v) => (
              <option key={v} value={v}>
                {VOICE_LABEL[v]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 self-end pb-3 text-sm font-bold">
          <input type="checkbox" checked={f.active} onChange={(e) => set("active", e.target.checked)} className="size-4" />
          Activo (reservable)
        </label>
      </div>
      <fieldset className="space-y-2">
        <legend className="text-sm font-bold">Temas que enseña ({f.topic_ids.length})</legend>
        <div className="flex max-h-44 flex-wrap gap-1.5 overflow-y-auto">
          {topics.map((t) => (
            <label key={t.id} className={cn("cursor-pointer rounded-full px-3 py-1 text-xs font-bold ring-1 ring-border", f.topic_ids.includes(t.id) ? "bg-primary text-primary-foreground" : "bg-card")}>
              <input type="checkbox" className="sr-only" checked={f.topic_ids.includes(t.id)} onChange={() => toggle(t.id)} />
              {t.name}
            </label>
          ))}
        </div>
        {!topics.length && <p className="text-xs text-muted-foreground">Cargando temas…</p>}
      </fieldset>
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
