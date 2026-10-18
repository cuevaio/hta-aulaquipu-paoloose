"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Minus, Plus, Trash2, Users } from "lucide-react";
import { api } from "@/lib/api";
import type { Level } from "@/lib/types";
import { useMutation, useQuery } from "@/components/providers";
import { Avatar } from "@/components/avatar";
import { Card, LEVEL_LABEL, Pill, Quipus, SectionTitle, Skeleton, btn, formatWhen, timeAgo } from "@/components/bits";
import { cn } from "@/lib/utils";

const DAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const HOURS = ["10:00", "15:00", "16:00", "17:00", "18:00"];

/** "Mié 16:00" → próxima fecha con ese día y hora. */
function nextSlot(label: string): string {
  const [day, time] = label.split(" ");
  const target = DAYS.indexOf(day) + 1; // getDay: lunes = 1
  const [h, m] = time.split(":").map(Number);
  const d = new Date();
  let add = (target - d.getDay() + 7) % 7;
  if (add === 0 && (d.getHours() > h || (d.getHours() === h && d.getMinutes() >= m))) add = 7;
  d.setDate(d.getDate() + add);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
}

export default function TutorPanelPage() {
  const router = useRouter();
  const panel = useQuery((u) => api.tutorPanel(u));
  const topics = useQuery(() => api.searchTopics(""));
  const { run, pending } = useMutation();

  const [newTopic, setNewTopic] = useState("");
  const [level, setLevel] = useState<Level>("intermedio");
  // Borradores locales: null = sin editar, se muestra lo guardado
  const [draftPrice, setDraftPrice] = useState<number | null>(null);
  const [draftAvailability, setDraftAvailability] = useState<string[] | null>(null);
  const [acceptFor, setAcceptFor] = useState<string | null>(null);
  const price = draftPrice ?? panel.data?.group_price_quipus ?? 20;
  const availability = draftAvailability ?? panel.data?.availability ?? [];
  const setPrice = (fn: (p: number) => number) => setDraftPrice(fn(price));
  const setAvailability = (fn: (a: string[]) => string[]) => setDraftAvailability(fn(availability));

  const declared = useMemo(() => new Set(panel.data?.topics.map((t) => t.topic_id)), [panel.data]);
  const available = topics.data?.filter((t) => !declared.has(t.id)) ?? [];
  const dirty =
    panel.data && (price !== panel.data.group_price_quipus || availability.join() !== panel.data.availability.join());

  const slots = availability.length ? availability : ["Mañana"];

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm font-bold text-accent-foreground">Quiero enseñar</p>
        <h1 className="font-heading text-3xl font-semibold">Tu panel de tutor</h1>
        <p className="mt-1 text-muted-foreground">Declara lo que sabes, fija tu precio y acepta pedidos. Cada clase te paga en quipus.</p>
      </div>

      {/* Pedidos entrantes primero: es lo que genera ingresos */}
      <section>
        <SectionTitle>Pedidos que puedes tomar</SectionTitle>
        {panel.loading && !panel.data && <Skeleton className="h-24" />}
        {panel.data?.incoming.length === 0 && (
          <Card className="text-sm text-muted-foreground">
            {panel.data.topics.length === 0
              ? "Declara al menos un tema abajo para empezar a recibir pedidos."
              : "No hay pedidos abiertos de tus temas por ahora. Vuelve más tarde."}
          </Card>
        )}
        <div className="grid grid-cols-1 gap-3 @3xl:grid-cols-2">
          {panel.data?.incoming.map(({ request, student, topic }) => (
            <Card key={request.id} className="space-y-3">
              <div className="flex items-start gap-3">
                <Avatar config={student.avatar_config} size={44} label={student.display_name} />
                <div className="min-w-0 flex-1">
                  <p className="font-extrabold">
                    {student.display_name} <span className="font-semibold text-muted-foreground">· {student.grade}º</span>
                  </p>
                  <p className="text-sm font-bold text-primary">{topic.name}</p>
                  <p className="text-sm text-muted-foreground">“{request.detail}”</p>
                </div>
                <Pill>{request.mode === "grupo" ? "Grupo" : "Individual"}</Pill>
              </div>
              <p className="text-xs text-muted-foreground">{timeAgo(request.created_at)}</p>
              {acceptFor === request.id ? (
                <div className="space-y-2 animate-in fade-in">
                  <p className="text-sm font-bold">¿Cuándo das la clase?</p>
                  <div className="flex flex-wrap gap-2">
                    {slots.map((s) => (
                      <button
                        key={s}
                        disabled={pending}
                        onClick={async () => {
                          const when = s === "Mañana" ? new Date(Date.now() + 86400_000).toISOString() : nextSlot(s);
                          const ok = await run((u) => api.acceptRequest(u, request.id, when), "¡Clase agendada! Los alumnos ya la ven.");
                          if (ok) setAcceptFor(null);
                        }}
                        className={cn(btn.mint, btn.sm)}
                      >
                        {s}
                      </button>
                    ))}
                    <button onClick={() => setAcceptFor(null)} className={cn(btn.ghost, btn.sm)}>
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setAcceptFor(request.id)} className={cn(btn.mint, btn.md, "w-full")}>
                  Aceptar · ganas hasta <Quipus amount={price} />
                </button>
              )}
            </Card>
          ))}
        </div>
      </section>

      {panel.data && panel.data.scheduled.length > 0 && (
        <section>
          <SectionTitle>Clases que vas a dar</SectionTitle>
          <div className="grid grid-cols-1 gap-3 @3xl:grid-cols-2">
            {panel.data.scheduled.map((g) => (
              <Card key={g.id} className="space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-heading text-lg font-semibold">{g.topic.name}</p>
                    <p className="flex items-center gap-1 text-sm text-muted-foreground">
                      <CalendarClock className="size-4" /> {formatWhen(g.scheduled_at)}
                    </p>
                  </div>
                  <Quipus amount={g.total_price_quipus} className="text-lg" />
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex -space-x-2">
                    {g.members.map((m) => (
                      <Avatar key={m.id} config={m.avatar_config} size={30} label={m.display_name} />
                    ))}
                  </div>
                  <span className="text-xs font-semibold text-muted-foreground">
                    <Users className="mr-1 inline size-3.5" />
                    {g.members.length} alumno{g.members.length === 1 ? "" : "s"} · {g.status === "forming" ? "armándose" : "confirmada"}
                  </span>
                </div>
                <button
                  disabled={pending || g.members.length === 0}
                  onClick={async () => {
                    const res = await run((u) => api.startGroupSession(u, g.id));
                    if (res) router.push(`/aula/${res.sessionId}`);
                  }}
                  className={cn(btn.primary, btn.sm, "w-full")}
                >
                  {g.status === "live" ? "Volver al aula" : "Abrir el aula"}
                </button>
              </Card>
            ))}
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 gap-6 @5xl:grid-cols-2">
        <Card>
          <SectionTitle>Lo que sé enseñar</SectionTitle>
          <div className="space-y-2">
            {panel.data?.topics.map((t) => (
              <div key={t.topic_id} className="flex items-center gap-2 rounded-2xl bg-muted px-3 py-2">
                <span className="flex-1 font-bold">{t.topic.name}</span>
                <select
                  value={t.level}
                  onChange={(e) => run((u) => api.declareTopic(u, t.topic_id, e.target.value as Level))}
                  className="rounded-xl bg-card px-2 py-1 text-sm font-semibold ring-1 ring-border"
                  aria-label={`Nivel en ${t.topic.name}`}
                >
                  {Object.entries(LEVEL_LABEL).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => run((u) => api.removeTopic(u, t.topic_id))}
                  className="rounded-xl p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  aria-label={`Quitar ${t.topic.name}`}
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-2 rounded-2xl border-2 border-dashed border-border p-3">
            <select
              value={newTopic}
              onChange={(e) => setNewTopic(e.target.value)}
              className="min-w-40 flex-1 rounded-xl bg-card px-3 py-2 text-sm font-semibold ring-1 ring-border"
              aria-label="Tema"
            >
              <option value="">Elige un tema…</option>
              {available.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <select
              value={level}
              onChange={(e) => setLevel(e.target.value as Level)}
              className="rounded-xl bg-card px-3 py-2 text-sm font-semibold ring-1 ring-border"
              aria-label="Nivel"
            >
              {Object.entries(LEVEL_LABEL).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
            <button
              disabled={!newTopic || pending}
              onClick={async () => {
                await run((u) => api.declareTopic(u, newTopic, level), "Tema agregado");
                setNewTopic("");
              }}
              className={cn(btn.primary, btn.sm)}
            >
              <Plus className="size-4" /> Agregar
            </button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Sin barrera de entrada: tu reputación se construye con cada clase.</p>
        </Card>

        <Card>
          <SectionTitle>Precio y horarios</SectionTitle>
          <p className="mb-2 text-sm font-bold">Precio total por clase grupal</p>
          <div className="flex items-center gap-3">
            <button onClick={() => setPrice((p) => Math.max(5, p - 1))} className={cn(btn.soft, "size-11")} aria-label="Bajar precio">
              <Minus className="size-4" />
            </button>
            <Quipus amount={price} className="min-w-20 justify-center text-3xl" iconClassName="size-7" />
            <button onClick={() => setPrice((p) => Math.min(200, p + 1))} className={cn(btn.soft, "size-11")} aria-label="Subir precio">
              <Plus className="size-4" />
            </button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Con 4 alumnos, cada uno paga {Math.floor(price / 4)} quipus. Piso sugerido: 5.
          </p>

          <p className="mt-5 mb-2 text-sm font-bold">¿Cuándo puedes enseñar?</p>
          <div className="overflow-x-auto">
            <div className="grid min-w-[22rem] grid-cols-[3rem_repeat(6,1fr)] gap-1 text-center text-xs font-bold">
              <span />
              {DAYS.map((d) => (
                <span key={d} className="py-1 text-muted-foreground">
                  {d}
                </span>
              ))}
              {HOURS.map((h) => (
                <div key={h} className="contents">
                  <span className="py-2 text-muted-foreground">{h}</span>
                  {DAYS.map((d) => {
                    const label = `${d} ${h}`;
                    const on = availability.includes(label);
                    return (
                      <button
                        key={label}
                        onClick={() => setAvailability((a) => (on ? a.filter((x) => x !== label) : [...a, label]))}
                        aria-pressed={on}
                        aria-label={label}
                        className={cn("rounded-lg py-2 transition-colors", on ? "bg-mint text-accent-foreground" : "bg-muted hover:bg-secondary")}
                      >
                        {on ? "✓" : ""}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
          <button
            disabled={!dirty || pending}
            onClick={async () => {
              await run((u) => api.setTutorSettings(u, price, availability), "Guardado");
              setDraftPrice(null);
              setDraftAvailability(null);
            }}
            className={cn(btn.primary, btn.md, "mt-4 w-full")}
          >
            Guardar precio y horarios
          </button>
        </Card>
      </div>
    </div>
  );
}
