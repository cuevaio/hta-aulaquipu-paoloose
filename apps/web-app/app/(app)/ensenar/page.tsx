"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Check, ChevronDown, Minus, Plus, Trash2, Users } from "lucide-react";
import { api } from "@/lib/api";
import type { Level, Topic } from "@/lib/types";
import { useMutation, useQuery } from "@/components/providers";
import { Avatar } from "@/components/avatar";
import { Card, LEVEL_LABEL, Pill, Quipus, SectionTitle, Skeleton, btn, formatWhen, timeAgo } from "@/components/bits";
import { cn } from "@/lib/utils";

const DAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const HOURS = ["10:00", "15:00", "16:00", "17:00", "18:00"];

const PRICE_MIN = 5; // límites del servidor (setTutorSettings): 5 a 500
const PRICE_MAX = 500;
const PRICE_STEP = 5;
const PRICE_CHIPS = [10, 20, 30, 50];
const DEFAULT_PRICE = 20;

/** Bloques simples que se traducen a horarios válidos ("Lun 16:00"). */
const BLOCKS: { label: string; slots: string[] }[] = [
  { label: "Tardes de semana", slots: ["Lun", "Mar", "Mié", "Jue", "Vie"].map((d) => `${d} 16:00`) },
  { label: "Noches de semana", slots: ["Lun", "Mar", "Mié", "Jue", "Vie"].map((d) => `${d} 18:00`) },
  { label: "Sábado en la mañana", slots: ["Sáb 10:00"] },
  { label: "Sábado en la tarde", slots: ["Sáb 15:00", "Sáb 16:00"] },
];

/** Paso colapsable del checklist: al completarse queda compacto pero se puede reabrir. */
function Step({
  n,
  title,
  done,
  summary,
  open,
  onToggle,
  children,
}: {
  n: number;
  title: string;
  done: boolean;
  summary?: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <Card className="p-0">
      <button onClick={onToggle} aria-expanded={open} className="flex w-full items-center gap-3 p-4 text-left @xl:p-5">
        <span
          className={cn(
            "grid size-8 shrink-0 place-items-center rounded-full text-sm font-extrabold",
            done ? "bg-mint text-accent-foreground" : "bg-secondary text-secondary-foreground",
          )}
        >
          {done ? <Check className="size-4" /> : n}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-heading text-lg font-semibold">{title}</span>
          {summary && !open && <span className="block truncate text-sm text-muted-foreground">{summary}</span>}
        </span>
        <ChevronDown className={cn("size-5 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open && <div className="px-4 pb-4 @xl:px-5 @xl:pb-5">{children}</div>}
    </Card>
  );
}

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
  // Pedidos abiertos de otros alumnos: muestran la demanda real, incluso de temas aún no declarados
  const feed = useQuery((u) => api.openRequestsFeed(u));
  const { run, pending } = useMutation();

  const [newTopic, setNewTopic] = useState("");
  const [level, setLevel] = useState<Level>("intermedio");
  // Borradores locales: null = sin editar, se muestra lo guardado
  const [draftPrice, setDraftPrice] = useState<number | null>(null);
  const [draftAvailability, setDraftAvailability] = useState<string[] | null>(null);
  const [acceptFor, setAcceptFor] = useState<string | null>(null);
  // Pasos abiertos/cerrados a mano; sin tocar, se abre el que aún falta
  const [manualOpen, setManualOpen] = useState<Record<number, boolean>>({});
  const [fine, setFine] = useState(false);
  const price = draftPrice ?? panel.data?.group_price_quipus ?? DEFAULT_PRICE;
  const availability = draftAvailability ?? panel.data?.availability ?? [];
  const setPrice = (fn: (p: number) => number) => setDraftPrice(Math.min(PRICE_MAX, Math.max(PRICE_MIN, fn(price))));
  const setAvailability = (fn: (a: string[]) => string[]) => setDraftAvailability(fn(availability));

  const declared = useMemo(() => new Set(panel.data?.topics.map((t) => t.topic_id)), [panel.data]);
  const available = topics.data?.filter((t) => !declared.has(t.id)) ?? [];
  const dirty =
    panel.data && (price !== panel.data.group_price_quipus || availability.join() !== panel.data.availability.join());

  // Demanda por tema (solo temas que aún no enseñas), de mayor a menor
  const demand = useMemo(() => {
    const byTopic = new Map<string, { topic: Topic; count: number }>();
    for (const { request, topic } of feed.data ?? []) {
      if (declared.has(topic.id)) continue;
      const cur = byTopic.get(request.topic_id) ?? { topic, count: 0 };
      cur.count += 1;
      byTopic.set(request.topic_id, cur);
    }
    return [...byTopic.values()].sort((a, b) => b.count - a.count);
  }, [feed.data, declared]);

  // Un precio "listo" = ya guardaste tus ajustes (hay horarios) o lo cambiaste del valor inicial
  const saved = panel.data;
  const hasTopics = !!saved && saved.topics.length > 0;
  const hasSchedule = !!saved && saved.availability.length > 0;
  const priceDone = !!saved && (saved.availability.length > 0 || saved.group_price_quipus !== DEFAULT_PRICE);
  const doneCount = [hasTopics, priceDone, hasSchedule].filter(Boolean).length;
  const firstPending = [hasTopics, priceDone, hasSchedule].findIndex((d) => !d) + 1; // 0 = todo listo
  const isOpen = (n: number) => manualOpen[n] ?? (!!saved && n === firstPending);
  const toggle = (n: number) => setManualOpen((m) => ({ ...m, [n]: !isOpen(n) }));

  const slots = availability.length ? availability : ["Mañana"];

  const saveSettings = async () => {
    await run((u) => api.setTutorSettings(u, price, availability), "Guardado");
    setDraftPrice(null);
    setDraftAvailability(null);
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-bold text-accent-foreground">Quiero enseñar</p>
        <h1 className="font-heading text-3xl font-semibold">Tu panel de tutor</h1>
        <p className="mt-1 text-muted-foreground">Prepara tu perfil en 3 pasos y empieza a ganar quipus dando clases.</p>
        {saved && (
          <div className="mt-3" aria-label={`${doneCount} de 3 pasos listos`}>
            <div className="flex items-center justify-between text-sm font-bold">
              <span>{doneCount === 3 ? "¡Todo listo!" : `${doneCount} de 3 listos`}</span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-mint transition-all" style={{ width: `${(doneCount / 3) * 100}%` }} />
            </div>
          </div>
        )}
      </div>

      {/* Demanda real: temas que otros alumnos piden y tú aún no enseñas */}
      {demand.length > 0 && (
        <section>
          <SectionTitle>Alumnos que buscan ayuda ahora</SectionTitle>
          <div className="space-y-2">
            {demand.slice(0, 3).map(({ topic, count }) => (
              <Card key={topic.id} className="flex items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <p className="font-extrabold">
                    {count} alumno{count === 1 ? " busca" : "s buscan"} {topic.name}
                  </p>
                  <p className="text-sm text-muted-foreground">¿Lo sabes? Agrégalo y verás sus pedidos.</p>
                </div>
                <button
                  disabled={pending}
                  onClick={() => run((u) => api.declareTopic(u, topic.id, "intermedio"), `Ahora enseñas ${topic.name}`)}
                  className={cn(btn.mint, btn.sm, "shrink-0")}
                >
                  Enseñar este tema
                </button>
              </Card>
            ))}
          </div>
        </section>
      )}

      {panel.loading && !panel.data && <Skeleton className="h-40" />}

      {saved && (
        <div className="space-y-3">
          {/* ① Qué sabes enseñar */}
          <Step
            n={1}
            title="Qué sabes enseñar"
            done={hasTopics}
            summary={hasTopics ? saved.topics.map((t) => t.topic.name).join(", ") : undefined}
            open={isOpen(1)}
            onToggle={() => toggle(1)}
          >
            <div className="space-y-2">
              {saved.topics.map((t) => (
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
          </Step>

          {/* ② Tu precio */}
          <Step
            n={2}
            title="Tu precio"
            done={priceDone}
            summary={`${price} quipus por clase grupal`}
            open={isOpen(2)}
            onToggle={() => toggle(2)}
          >
            <p className="mb-2 text-sm font-bold">Precio total por clase</p>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Precios rápidos">
              {PRICE_CHIPS.map((c) => (
                <button
                  key={c}
                  onClick={() => setDraftPrice(c)}
                  aria-pressed={price === c}
                  className={cn(btn.soft, btn.sm, price === c && "bg-primary text-primary-foreground")}
                >
                  {c}
                </button>
              ))}
            </div>
            <div className="mt-3 flex items-center gap-3">
              <button onClick={() => setPrice((p) => p - PRICE_STEP)} className={cn(btn.soft, "size-11")} aria-label="Bajar precio">
                <Minus className="size-4" />
              </button>
              <Quipus amount={price} className="min-w-20 justify-center text-3xl" iconClassName="size-7" />
              <button onClick={() => setPrice((p) => p + PRICE_STEP)} className={cn(btn.soft, "size-11")} aria-label="Subir precio">
                <Plus className="size-4" />
              </button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Los alumnos del grupo se reparten ese precio: con 4 alumnos, cada uno paga {Math.floor(price / 4)} quipus y tú recibes{" "}
              {price} en total. Va de {PRICE_MIN} a {PRICE_MAX}.
            </p>
            <button disabled={!dirty || pending} onClick={saveSettings} className={cn(btn.primary, btn.md, "mt-4 w-full")}>
              Guardar
            </button>
          </Step>

          {/* ③ Tus horarios */}
          <Step
            n={3}
            title="Tus horarios"
            done={hasSchedule}
            summary={hasSchedule ? `${saved.availability.length} horario${saved.availability.length === 1 ? "" : "s"} elegidos` : undefined}
            open={isOpen(3)}
            onToggle={() => toggle(3)}
          >
            <p className="mb-2 text-sm font-bold">¿Cuándo puedes enseñar?</p>
            <div className="flex flex-wrap gap-2">
              {BLOCKS.map((b) => {
                const on = b.slots.every((x) => availability.includes(x));
                return (
                  <button
                    key={b.label}
                    aria-pressed={on}
                    onClick={() =>
                      setAvailability((a) => (on ? a.filter((x) => !b.slots.includes(x)) : [...new Set([...a, ...b.slots])]))
                    }
                    className={cn(btn.soft, btn.sm, on && "bg-mint text-accent-foreground")}
                  >
                    {on && <Check className="size-4" />} {b.label}
                  </button>
                );
              })}
            </div>
            <button onClick={() => setFine((f) => !f)} aria-expanded={fine} className="mt-3 text-sm font-bold text-primary underline-offset-2 hover:underline">
              {fine ? "Ocultar ajuste fino" : "Ajustar hora por hora"}
            </button>
            {fine && (
              <div className="mt-2 overflow-x-auto">
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
            )}
            <button disabled={!dirty || pending} onClick={saveSettings} className={cn(btn.primary, btn.md, "mt-4 w-full")}>
              Guardar
            </button>
          </Step>
        </div>
      )}

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

      {/* ④ Pedidos para ti: al final, cuando el perfil ya está listo */}
      <section>
        <SectionTitle action={saved && saved.incoming.length > 0 ? <Pill>{saved.incoming.length}</Pill> : undefined}>
          <span className="text-muted-foreground">4 ·</span> Pedidos para ti
        </SectionTitle>
        {saved?.incoming.length === 0 && (
          <Card className="text-sm text-muted-foreground">
            {saved.topics.length === 0
              ? "Elige qué sabes enseñar (paso 1) y aquí verás los pedidos de tus temas."
              : demand.length > 0
                ? "Aún no hay pedidos de tus temas. Mira arriba qué temas piden los alumnos y súmalos."
                : "Aún no hay pedidos de tus temas. Cuando llegue uno aparecerá aquí."}
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
                <div className="space-y-1.5">
                  <button onClick={() => setAcceptFor(request.id)} className={cn(btn.mint, btn.md, "w-full")}>
                    Aceptar · ganas <Quipus amount={price} />
                  </button>
                  <p className="text-center text-xs text-muted-foreground">
                    Ese es tu precio por la clase: los alumnos del grupo se lo reparten y lo cobras al terminar.
                  </p>
                </div>
              )}
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
