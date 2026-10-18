"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, CalendarClock, Check, ChevronDown, Minus, Plus, Users, X } from "lucide-react";
import { api, type GroupCall } from "@/lib/api";
import type { Level, Topic, TutorPanel } from "@/lib/types";
import { useMutation, useQuery, useSession } from "@/components/providers";
import { Avatar } from "@/components/avatar";
import { Card, Pill, Quipus, SectionTitle, Skeleton, btn, friendlyWhen, timeAgo } from "@/components/bits";
import { cn } from "@/lib/utils";
import { LEVEL_FRIENDLY, groupBySubject, subjectOf } from "@/lib/subjects";

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

  // Borradores locales: null = sin editar, se muestra lo guardado
  const [draftPrice, setDraftPrice] = useState<number | null>(null);
  const [draftAvailability, setDraftAvailability] = useState<string[] | null>(null);
  const [acceptFor, setAcceptFor] = useState<string | null>(null);
  // Clase que el profe está llamando ahora (suena el timbre en sus alumnos)
  const [calling, setCalling] = useState<string | null>(null);
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
  const demandCount = useMemo(() => new Map(demand.map((d) => [d.topic.id, d.count])), [demand]);

  // Un precio "listo" = ya guardaste tus ajustes (hay horarios) o lo cambiaste del valor inicial
  const saved = panel.data;
  const hasTopics = !!saved && saved.topics.length > 0;
  const hasSchedule = !!saved && saved.availability.length > 0;
  const priceDone = !!saved && (saved.availability.length > 0 || saved.group_price_quipus !== DEFAULT_PRICE);
  const doneCount = [hasTopics, priceDone, hasSchedule].filter(Boolean).length;
  const firstPending = [hasTopics, priceDone, hasSchedule].findIndex((d) => !d) + 1; // 0 = todo listo
  const isOpen = (n: number) => manualOpen[n] ?? (!!saved && n === firstPending);
  const toggle = (n: number) => setManualOpen((m) => ({ ...m, [n]: !isOpen(n) }));

  // "Ahora mismo" primero: si hay alumnos esperando, la clase puede empezar ya
  const slots = ["Ahora mismo", ...(availability.length ? availability : ["Mañana"])];

  // Cola de pedidos: los de grupo del mismo tema se juntan en una sola clase (acceptRequest suma hasta 5)
  const queue = useMemo(() => {
    const incoming = panel.data?.incoming ?? [];
    const byTopic = new Map<string, typeof incoming>();
    const singles: typeof incoming = [];
    for (const item of incoming) {
      if (item.request.mode !== "grupo") singles.push(item);
      else byTopic.set(item.request.topic_id, [...(byTopic.get(item.request.topic_id) ?? []), item]);
    }
    const sortOld = (list: typeof incoming) => [...list].sort((x, y) => x.request.created_at.localeCompare(y.request.created_at));
    return [...byTopic.values(), ...singles.map((x) => [x])].map(sortOld);
  }, [panel.data]);

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
            {saved.topics.length > 0 && (
              <div className="space-y-2">
                {saved.topics.map((t) => (
                  <div key={t.topic_id} className="rounded-2xl bg-muted p-3">
                    <div className="flex items-center gap-2">
                      <span className="flex-1 font-extrabold">
                        {subjectOf(t.topic.name).emoji} {t.topic.name}
                      </span>
                      <button
                        onClick={() => run((u) => api.removeTopic(u, t.topic_id))}
                        className="rounded-xl p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        aria-label={`Ya no enseñar ${t.topic.name}`}
                      >
                        <X className="size-4" />
                      </button>
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-1.5" role="radiogroup" aria-label={`Qué tan bien sabes ${t.topic.name}`}>
                      {(Object.keys(LEVEL_FRIENDLY) as Level[]).map((lv) => (
                        <button
                          key={lv}
                          role="radio"
                          aria-checked={t.level === lv}
                          title={LEVEL_FRIENDLY[lv].hint}
                          onClick={() => t.level !== lv && run((u) => api.declareTopic(u, t.topic_id, lv))}
                          className={cn(
                            "rounded-xl px-2 py-2 text-xs font-extrabold transition-colors",
                            t.level === lv ? "bg-primary text-primary-foreground" : "bg-card hover:bg-secondary",
                          )}
                        >
                          <span aria-hidden>{LEVEL_FRIENDLY[lv].emoji}</span> {LEVEL_FRIENDLY[lv].label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <p className={cn("text-sm font-extrabold", saved.topics.length > 0 && "mt-5")}>
              {saved.topics.length ? "¿Sabes algo más? Toca para agregarlo" : "Toca los temas que sabes explicar"}
            </p>
            <div className="mt-2 space-y-3">
              {groupBySubject(available).map(({ subject, topics: list }) => (
                <div key={subject.id}>
                  <p className="mb-1.5 text-xs font-bold text-muted-foreground">
                    {subject.emoji} {subject.name}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {list.map((t) => {
                      const wanted = demandCount.get(t.id) ?? 0;
                      return (
                        <button
                          key={t.id}
                          disabled={pending}
                          onClick={() => {
                            // El paso sigue abierto: así se puede elegir el nivel o sumar otro tema
                            setManualOpen((m) => ({ ...m, 1: true }));
                            void run((u) => api.declareTopic(u, t.id, "intermedio"), `Ahora enseñas ${t.name} 💪`);
                          }}
                          className="flex items-center gap-1.5 rounded-2xl bg-card px-3 py-2 text-sm font-extrabold ring-1 ring-border transition-all hover:ring-2 hover:ring-mint active:scale-[0.98]"
                        >
                          <Plus className="size-3.5 text-accent-foreground" /> {t.name}
                          {wanted > 0 && (
                            <span className="rounded-full bg-coral/15 px-1.5 text-[11px] text-coral" title={`${wanted} alumno(s) lo buscan`}>
                              🔥 {wanted}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
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
                      <CalendarClock className="size-4" /> {friendlyWhen(g.scheduled_at)}
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
                {g.status === "live" ? (
                  <button
                    disabled={pending}
                    onClick={async () => {
                      const res = await run((u) => api.startGroupSession(u, g.id));
                      if (res) router.push(`/aula/${res.sessionId}`);
                    }}
                    className={cn(btn.primary, btn.sm, "w-full")}
                  >
                    Volver al aula
                  </button>
                ) : calling === g.id ? (
                  <CallPanel group={g} onStop={() => setCalling(null)} onEnter={(sessionId) => router.push(`/aula/${sessionId}`)} />
                ) : (
                  <button disabled={pending || g.members.length === 0} onClick={() => setCalling(g.id)} className={cn(btn.primary, btn.sm, "w-full")}>
                    <Bell className="size-4" /> Llamar a mis alumnos
                  </button>
                )}
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
          {queue.map((items) => {
            // Un grupo de la cola: hasta 5 alumnos entran a la misma clase; el resto sigue esperando
            const { request, student, topic } = items[0];
            const joined = items.slice(0, 5);
            const many = joined.length > 1;
            const hasMore = items.length > joined.length;
            return (
              <Card key={request.id} className="space-y-3">
                {many ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <div className="flex shrink-0 -space-x-2">
                        {joined.map((i) => (
                          <Avatar key={i.request.id} config={i.student.avatar_config} size={40} label={i.student.display_name} />
                        ))}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-extrabold">
                          {joined.length} alumnos esperan <span className="text-primary">{topic.name}</span>
                        </p>
                        <p className="truncate text-sm text-muted-foreground">{joined.map((i) => i.student.display_name.split(" ")[0]).join(", ")}</p>
                      </div>
                      <Pill>Grupo</Pill>
                    </div>
                    <ul className="space-y-1 text-sm text-muted-foreground">
                      {joined.map((i) => (
                        <li key={i.request.id} className="truncate">
                          <b className="text-foreground">{i.student.display_name.split(" ")[0]}:</b> “{i.request.detail}”
                        </li>
                      ))}
                    </ul>
                    {hasMore && <p className="text-xs font-semibold text-muted-foreground">Quedan {items.length - joined.length} más en cola para otra clase.</p>}
                  </div>
                ) : (
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
                )}
                <p className="text-xs text-muted-foreground">En cola {timeAgo(request.created_at)}</p>
                {acceptFor === request.id ? (
                  <div className="space-y-2 animate-in fade-in">
                    <p className="text-sm font-bold">¿Cuándo das la clase?</p>
                    <div className="flex flex-wrap gap-2">
                      {slots.map((s) => (
                        <button
                          key={s}
                          disabled={pending}
                          onClick={async () => {
                            const when =
                              s === "Ahora mismo" ? new Date().toISOString() : s === "Mañana" ? new Date(Date.now() + 86400_000).toISOString() : nextSlot(s);
                            const now = s === "Ahora mismo";
                            const ok = await run(
                              (u) => api.acceptRequest(u, request.id, when),
                              now
                                ? "¡Listo! Estamos llamando a tus alumnos."
                                : many
                                  ? "¡Clase agendada! Invitamos y avisamos a tus alumnos."
                                  : "¡Clase agendada! Avisamos a tu alumno.",
                            );
                            if (ok) {
                              setAcceptFor(null);
                              if (now) setCalling(ok.groupId);
                            }
                          }}
                          className={cn(s === "Ahora mismo" ? btn.primary : btn.mint, btn.sm)}
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
                      {many ? `Programar clase para los ${joined.length}` : "Aceptar"} · ganas <Quipus amount={price} />
                    </button>
                    <p className="text-center text-xs text-muted-foreground">
                      Ese es tu precio por la clase: {many ? "los alumnos se lo reparten" : "tu alumno lo paga"} y lo cobras al terminar. Todos reciben la invitación.
                    </p>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      </section>
    </div>
  );
}

/**
 * Llamada del profe a su clase: cada 3 s pregunta quién está conectado. Suena el timbre en los
 * alumnos conectados; la clase empieza cuando uno acepta (entonces el profe entra solo). Si nadie
 * está conectado, el profe lo ve aquí y la clase no avanza.
 */
function CallPanel({ group, onStop, onEnter }: { group: TutorPanel["scheduled"][number]; onStop: () => void; onEnter: (sessionId: string) => void }) {
  const { userId } = useSession();
  const [call, setCall] = useState<GroupCall | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    const tick = async () => {
      try {
        const res = await api.callGroup(userId, group.id);
        if (!alive) return;
        setCall(res);
        setError(null);
        if (res.liveSessionId) onEnter(res.liveSessionId);
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : "No pudimos llamar a tus alumnos.");
      }
    };
    void tick();
    const timer = setInterval(tick, 3000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [userId, group.id, onEnter]);

  const online = call?.members.filter((m) => m.online) ?? [];
  const nobody = !!call && online.length === 0;
  return (
    <div className="space-y-2 rounded-2xl bg-secondary p-3 animate-in fade-in" role="status" aria-live="polite">
      <p className="flex items-center gap-2 text-sm font-extrabold">
        <Bell className="bell-ring size-4 text-gold" aria-hidden /> {call?.liveSessionId ? "¡Aceptaron! Entrando al aula…" : "Llamando a tus alumnos…"}
      </p>
      <ul className="space-y-1">
        {(call?.members ?? group.members.map((m) => ({ id: m.id, name: m.display_name, online: false }))).map((m) => (
          <li key={m.id} className="flex items-center justify-between gap-2 text-sm">
            <span className="min-w-0 truncate font-bold">{m.name.split(" ")[0]}</span>
            <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-xs font-extrabold", m.online ? "bg-mint/30 text-accent-foreground" : "bg-coral/15 text-coral")}>
              {!call ? "…" : m.online ? "conectado · suena el timbre" : "no conectado"}
            </span>
          </li>
        ))}
      </ul>
      {error && <p className="text-xs font-semibold text-coral">{error}</p>}
      <p className="text-xs text-muted-foreground">
        {nobody
          ? "Ningún alumno está conectado ahora, así que la clase no puede empezar. Sigue en esta pantalla: apenas alguien se conecte le suena el timbre."
          : "La clase empieza formalmente cuando un alumno acepta. Entrarás al aula automáticamente."}
      </p>
      <button onClick={onStop} className={cn(btn.ghost, btn.sm)}>
        Dejar de llamar
      </button>
    </div>
  );
}

