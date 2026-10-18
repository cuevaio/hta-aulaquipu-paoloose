"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { CalendarClock, CheckCircle2, Clock, Sparkles, Star, Users, X } from "lucide-react";
import { api, type BookingResult } from "@/lib/api";
import type { AiTutor, GroupOption, TutorOption } from "@/lib/types";
import { useMutation, useQuery, useSession } from "@/components/providers";
import { AiAvatar, Avatar } from "@/components/avatar";
import { ErrorBox, Pill, Quipus, Skeleton, btn, friendlyWhen } from "@/components/bits";
import { LEVEL_FRIENDLY, subjectOf } from "@/lib/subjects";
import { cn } from "@/lib/utils";

/** Una forma de aprender el tema: unirse a un grupo, una clase con un alumno tutor o con IA. */
type Option =
  | { key: string; kind: "group"; price: number; when: string; group: GroupOption }
  | { key: string; kind: "tutor"; price: number; when: string; tutor: TutorOption }
  | { key: string; kind: "ai"; price: number; when: string; ai: AiTutor };

const first = (name: string) => name.split(" ")[0];

export default function MatchPage() {
  const { requestId } = useParams<{ requestId: string }>();
  const router = useRouter();
  const { me } = useSession();
  const { data, error, loading } = useQuery((u) => api.match(u, requestId), [requestId]);
  const { run, pending } = useMutation();
  // Si venimos del perfil de un tutor (?tutor=<id>), esa opción va primero
  const preferred = useSearchParams().get("tutor");
  const [confirming, setConfirming] = useState<Option | null>(null);
  const [booked, setBooked] = useState<(BookingResult & { title: string }) | null>(null);

  if (error) return <ErrorBox message={error} />;
  if (loading && !data)
    return (
      <div className="space-y-4">
        <Skeleton className="h-24" />
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
      </div>
    );
  if (!data) return null;

  // Saldo disponible: descuenta clases ya reservadas que aún no se cobran
  const balance = me?.available ?? 0;
  // Sin horario elegido, la clase con tutor se agenda para mañana (book_human en la base)
  const tutorWhen = data.request.preferred_at ? friendlyWhen(data.request.preferred_at) : "Mañana";

  const human: Option[] = [
    ...data.groups.map((g): Option => ({
      key: `g-${g.group.id}`,
      kind: "group",
      price: g.share_quipus,
      when: friendlyWhen(g.group.scheduled_at),
      group: g,
    })),
    ...data.tutors.map((t): Option => ({ key: `t-${t.profile.id}`, kind: "tutor", price: t.group_price_quipus, when: tutorWhen, tutor: t })),
  ].sort((a, b) => a.price - b.price);
  const ai = data.aiTutors.map((a): Option => ({ key: `a-${a.id}`, kind: "ai", price: a.price_quipus, when: "Ahora mismo", ai: a }));

  const preferredOpt = preferred ? human.find((o) => o.kind === "tutor" && o.tutor.profile.id === preferred) : undefined;
  // Recomendado: el tutor que elegiste; si no, la opción humana más barata que te alcanza; si no, la IA
  const recommended =
    preferredOpt ?? human.find((o) => o.price <= balance) ?? ai.find((o) => o.price <= balance) ?? human[0] ?? ai[0];
  const rest = [...human, ...ai].filter((o) => o !== recommended);

  const confirm = async (o: Option) => {
    if (o.kind === "ai") {
      const res = await run((u) => api.book(u, { kind: "ai", aiTutorId: o.ai.id, requestId }));
      if (res?.sessionId) router.push(`/aula/${res.sessionId}`);
      return;
    }
    const res =
      o.kind === "group"
        ? await run((u) => api.book(u, { kind: "group", groupId: o.group.group.id }), "¡Te uniste al grupo!")
        : await run((u) => api.book(u, { kind: "human", tutorId: o.tutor.profile.id, requestId }), "¡Clase reservada!");
    if (res) {
      setConfirming(null);
      setBooked({
        ...res,
        title: o.kind === "group" ? `Grupo de ${data.topic.name}` : `${data.topic.name} con ${first(o.tutor.profile.display_name)}`,
      });
    }
  };

  const enterNow = async () => {
    if (!booked?.groupId) return;
    const res = await run((u) => api.startGroupSession(u, booked.groupId!));
    if (res) router.push(`/aula/${res.sessionId}`);
  };

  if (booked) {
    return (
      <div className="mx-auto max-w-md pt-6 text-center animate-in fade-in zoom-in-95">
        <CheckCircle2 className="mx-auto size-16 text-success" />
        <h1 className="mt-4 font-heading text-3xl font-semibold">¡Clase reservada! 🎉</h1>
        <p className="mt-1 text-lg font-bold">{booked.title}</p>
        <p className="mt-2 flex items-center justify-center gap-1.5 text-muted-foreground">
          <CalendarClock className="size-4" /> {friendlyWhen(booked.scheduledAt)}
        </p>
        <p className="mt-4 rounded-2xl bg-secondary p-3 text-sm text-secondary-foreground">
          Todavía no te cobramos nada: los quipus se descuentan cuando termine la clase. La encuentras en tu Tablero.
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <button onClick={enterNow} disabled={pending} className={cn(btn.primary, btn.lg)}>
            Entrar al aula ahora
          </button>
          <Link href="/home#clases" className={cn(btn.soft, btn.md)}>
            Ver mis clases
          </Link>
        </div>
      </div>
    );
  }

  const subject = subjectOf(data.topic.name);

  return (
    <div className="space-y-6 pb-6">
      <div>
        <p className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-sm font-extrabold text-primary">
          {subject.emoji} {data.topic.name}
          {data.topicWasCreated && <span className="font-semibold">· tema nuevo</span>}
        </p>
        <h1 className="mt-3 font-heading text-3xl font-semibold">Elige cómo aprender</h1>
        <p className="mt-1 text-muted-foreground">
          Tienes <Quipus amount={balance} className="text-base" /> disponibles. Solo pagas cuando termina la clase.
        </p>
      </div>

      {preferred && !preferredOpt && (
        <p className="rounded-2xl bg-secondary p-3 text-sm font-semibold text-secondary-foreground">
          El tutor que elegiste no enseña este tema ahora. Estas son otras opciones.
        </p>
      )}

      {recommended && (
        <section>
          <p className="mb-2 flex items-center gap-1.5 text-sm font-extrabold text-accent-foreground">
            <Star className="size-4 fill-gold text-gold" /> {preferredOpt ? "La que elegiste" : "Recomendado para ti"}
          </p>
          <OptionCard o={recommended} balance={balance} highlight onPick={() => setConfirming(recommended)} />
        </section>
      )}

      {rest.length > 0 && (
        <section className="space-y-3">
          <p className="text-sm font-extrabold text-muted-foreground">Otras opciones</p>
          {rest.map((o) => (
            <OptionCard key={o.key} o={o} balance={balance} onPick={() => setConfirming(o)} />
          ))}
        </section>
      )}

      {confirming && (
        <ConfirmSheet
          o={confirming}
          topic={data.topic.name}
          balance={balance}
          pending={pending}
          onClose={() => setConfirming(null)}
          onConfirm={() => confirm(confirming)}
        />
      )}
    </div>
  );
}

function optionTitle(o: Option) {
  if (o.kind === "group") {
    const names = o.group.members.map((m) => first(m.display_name));
    return names.length ? `Únete a ${names.join(" y ")}` : "Únete al grupo";
  }
  if (o.kind === "tutor") return `Clase con ${first(o.tutor.profile.display_name)}`;
  return `Clase con ${o.ai.name}`;
}

function OptionCard({ o, balance, highlight, onPick }: { o: Option; balance: number; highlight?: boolean; onPick: () => void }) {
  const short = o.price > balance;
  const cta = o.kind === "group" ? "Unirme" : o.kind === "ai" ? "Empezar ya" : "Reservar";

  return (
    <div
      className={cn(
        "flex flex-col gap-4 rounded-3xl bg-card p-4 ring-1 ring-border @xl:flex-row @xl:items-center",
        highlight && "ring-2 ring-primary shadow-[0_4px_0_0_oklch(0.52_0.2_282/0.25)]",
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        {o.kind === "group" ? (
          <div className="flex shrink-0 -space-x-3">
            {o.group.members.slice(0, 3).map((m) => (
              <Avatar key={m.id} config={m.avatar_config} size={44} label={m.display_name} />
            ))}
            <span className="grid size-11 place-items-center rounded-full border-2 border-dashed border-primary bg-primary/10 text-xs font-black text-primary">
              Tú
            </span>
          </div>
        ) : o.kind === "tutor" ? (
          <Avatar config={o.tutor.profile.avatar_config} equipped={o.tutor.equipped} size={52} label={o.tutor.profile.display_name} />
        ) : (
          <AiAvatar emoji={o.ai.persona.emoji} color={o.ai.persona.color} size={52} />
        )}
        <div className="min-w-0">
          <p className="truncate font-heading text-lg font-semibold">{optionTitle(o)}</p>
          <div className="mt-1 flex flex-wrap gap-1.5 text-xs font-bold">
            <Pill>
              <Clock className="size-3" /> {o.when}
            </Pill>
            {o.kind === "group" && (
              <Pill>
                <Users className="size-3" /> {o.group.members.length + 1} chicos
                {o.group.tutor ? ` · con ${first(o.group.tutor.profile.display_name)}` : ""}
              </Pill>
            )}
            {o.kind === "tutor" && (
              <>
                <Pill>
                  <Star className="size-3 fill-gold text-gold" />
                  {o.tutor.stats.estrellas_promedio > 0 ? o.tutor.stats.estrellas_promedio.toFixed(1) : "Nuevo"}
                  {o.tutor.stats.sesiones_completadas > 0 && ` · ${o.tutor.stats.sesiones_completadas} clases`}
                </Pill>
                <Pill>
                  {LEVEL_FRIENDLY[o.tutor.level].emoji} {LEVEL_FRIENDLY[o.tutor.level].label} · {o.tutor.profile.grade}º
                </Pill>
              </>
            )}
            {o.kind === "ai" && (
              <Pill className="bg-primary/10 text-primary">
                <Sparkles className="size-3" /> Tutor IA · {o.ai.persona.tagline}
              </Pill>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 @xl:flex-col @xl:items-end">
        <span className="text-right leading-tight">
          <Quipus amount={o.price} className="text-2xl" iconClassName="size-5" />
          <span className="block text-xs font-semibold text-muted-foreground">{o.kind === "group" ? "tu parte" : "la clase"}</span>
        </span>
        {short ? (
          <Link href="/ensenar" className={cn(btn.soft, btn.md, "shrink-0")}>
            Te faltan {o.price - balance}
          </Link>
        ) : (
          <button onClick={onPick} className={cn(highlight ? btn.primary : btn.soft, btn.md, "shrink-0")}>
            {cta}
          </button>
        )}
      </div>
    </div>
  );
}

function ConfirmSheet({
  o,
  topic,
  balance,
  pending,
  onClose,
  onConfirm,
}: {
  o: Option;
  topic: string;
  balance: number;
  pending: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const rows: [string, React.ReactNode][] = [
    ["Tema", topic],
    ["Con", o.kind === "group" ? `${o.group.members.length + 1} chicos${o.group.tutor ? ` y ${first(o.group.tutor.profile.display_name)}` : ""}` : o.kind === "tutor" ? o.tutor.profile.display_name : `${o.ai.name} (IA)`],
    ["Cuándo", o.when],
    ["Pagas", <Quipus key="p" amount={o.price} className="text-base" />],
    ["Te quedan", <Quipus key="q" amount={balance - o.price} className="text-base" />],
  ];
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-navy/40 backdrop-blur-sm @xl:items-center" role="dialog" aria-modal aria-label="Confirmar clase">
      <button className="absolute inset-0" aria-label="Cerrar" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-t-[2rem] bg-card p-6 shadow-2xl animate-in slide-in-from-bottom-6 @xl:rounded-[2rem]">
        <button onClick={onClose} className="absolute top-4 right-4 rounded-full p-1.5 hover:bg-muted" aria-label="Cerrar">
          <X className="size-4" />
        </button>
        <p className="font-heading text-2xl font-semibold">{optionTitle(o)}</p>
        <dl className="mt-4 divide-y divide-border rounded-2xl bg-muted/60 px-4">
          {rows.map(([k, v]) => (
            <div key={k} className="flex items-center justify-between gap-4 py-2.5 text-sm">
              <dt className="font-semibold text-muted-foreground">{k}</dt>
              <dd className="text-right font-extrabold">{v}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-center text-xs text-muted-foreground">Se cobra recién al terminar la clase.</p>
        <button onClick={onConfirm} disabled={pending} className={cn(btn.primary, btn.lg, "mt-4 w-full")}>
          {pending ? "Un momento…" : o.kind === "ai" ? "Empezar la clase" : "Confirmar"}
        </button>
      </div>
    </div>
  );
}
