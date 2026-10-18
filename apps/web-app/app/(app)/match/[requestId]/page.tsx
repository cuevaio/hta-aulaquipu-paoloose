"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { CalendarClock, CheckCircle2, Sparkles, Users, Wand2 } from "lucide-react";
import { api, type BookingResult } from "@/lib/api";
import type { GroupOption, TutorOption } from "@/lib/types";
import { useMutation, useQuery, useSession } from "@/components/providers";
import { Avatar } from "@/components/avatar";
import { AiTutorCard } from "@/components/ai-tutor-card";
import { Card, ErrorBox, LEVEL_LABEL, Pill, Quipus, SectionTitle, Skeleton, Stars, btn, formatWhen } from "@/components/bits";
import { cn } from "@/lib/utils";

export default function MatchPage() {
  const { requestId } = useParams<{ requestId: string }>();
  const router = useRouter();
  const { me } = useSession();
  const { data, error, loading } = useQuery((u) => api.match(u, requestId), [requestId]);
  const { run, pending } = useMutation();
  const [armed, setArmed] = useState<string | null>(null);
  const [booked, setBooked] = useState<(BookingResult & { title: string }) | null>(null);

  if (error) return <ErrorBox message={error} />;
  if (loading && !data)
    return (
      <div className="space-y-4">
        <Skeleton className="h-24" />
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
      </div>
    );
  if (!data) return null;

  // Saldo disponible: descuenta clases ya reservadas que aún no se cobran
  const balance = me?.available ?? 0;

  const bookGroup = async (g: GroupOption) => {
    const res = await run((u) => api.book(u, { kind: "group", groupId: g.group.id }), "¡Te uniste al grupo!");
    if (res) setBooked({ ...res, title: `Grupo de ${data.topic.name}` });
  };
  const bookTutor = async (t: TutorOption) => {
    const res = await run((u) => api.book(u, { kind: "human", tutorId: t.profile.id, requestId }), "¡Clase reservada!");
    if (res) setBooked({ ...res, title: `${data.topic.name} con ${t.profile.display_name.split(" ")[0]}` });
  };
  const enterNow = async () => {
    if (!booked?.groupId) return;
    const res = await run((u) => api.startGroupSession(u, booked.groupId!));
    if (res) router.push(`/aula/${res.sessionId}`);
  };

  if (booked) {
    return (
      <div className="mx-auto max-w-md pt-6 text-center">
        <CheckCircle2 className="mx-auto size-16 text-mint" />
        <h1 className="mt-4 font-heading text-3xl font-semibold">¡Listo!</h1>
        <p className="mt-1 text-lg font-bold">{booked.title}</p>
        <p className="mt-2 flex items-center justify-center gap-1.5 text-muted-foreground">
          <CalendarClock className="size-4" /> {formatWhen(booked.scheduledAt)}
        </p>
        <p className="mt-4 rounded-2xl bg-secondary p-3 text-sm text-secondary-foreground">
          Aún no te cobramos: los quipus se descuentan cuando termine la clase.
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <button onClick={enterNow} disabled={pending} className={cn(btn.primary, btn.lg)}>
            Entrar al aula ahora (demo)
          </button>
          <Link href="/campus" className={cn(btn.soft, btn.md)}>
            Volver al campus
          </Link>
        </div>
      </div>
    );
  }

  const nothingHuman = data.groups.length === 0 && data.tutors.length === 0;

  return (
    <div className="space-y-8">
      <div className="rounded-[2rem] bg-card p-5 ring-1 ring-border @3xl:p-6">
        <p className="flex items-center gap-1.5 text-sm font-bold text-primary">
          <Wand2 className="size-4" /> Entendimos que quieres aprender
        </p>
        <h1 className="mt-1 font-heading text-3xl font-semibold">{data.topic.name}</h1>
        <p className="mt-1 text-muted-foreground">“{data.request.detail}”</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Pill>{data.request.mode === "grupo" ? "En grupo" : "Individual"}</Pill>
          {data.topicWasCreated && <Pill className="bg-gold/30 text-gold-foreground">Tema nuevo propuesto por ti</Pill>}
        </div>
      </div>

      {data.groups.length > 0 && (
        <section>
          <SectionTitle>
            <span className="flex items-center gap-2">
              <Users className="size-5 text-primary" /> Hay un grupo armándose
            </span>
          </SectionTitle>
          <div className="space-y-3">
            {data.groups.map((g) => {
              const key = `g-${g.group.id}`;
              const short = balance < g.share_quipus;
              return (
                <Card key={key} className={cn("space-y-4", armed === key && "ring-2 ring-primary")}>
                  <button className="flex w-full flex-wrap items-center gap-4 text-left" onClick={() => setArmed(armed === key ? null : key)}>
                    <div className="flex -space-x-3">
                      {g.members.map((m) => (
                        <Avatar key={m.id} config={m.avatar_config} size={44} label={m.display_name} />
                      ))}
                      {me && (
                        <div className="grid size-11 place-items-center rounded-full border-2 border-dashed border-primary bg-primary/10 text-xs font-black text-primary">
                          Tú
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-extrabold">
                        {g.members.map((m) => m.display_name.split(" ")[0]).join(", ")} y tú
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {g.tutor ? `Con ${g.tutor.profile.display_name}` : "Tutor por confirmar"} · {formatWhen(g.group.scheduled_at)}
                      </p>
                    </div>
                    <div className="text-right">
                      <Quipus amount={g.share_quipus} className="text-xl" />
                      <p className="text-xs text-muted-foreground">
                        por persona · <s>{g.group.total_price_quipus}</s>
                      </p>
                    </div>
                  </button>
                  {armed === key && (
                    <ConfirmRow short={short} need={g.share_quipus} balance={balance} pending={pending} onConfirm={() => bookGroup(g)} label="Unirme al grupo" />
                  )}
                </Card>
              );
            })}
          </div>
        </section>
      )}

      {data.tutors.length > 0 && (
        <section>
          <SectionTitle>Tutores alumnos recomendados</SectionTitle>
          <div className="grid grid-cols-1 gap-3 @3xl:grid-cols-2">
            {data.tutors.map((t, i) => {
              const key = `t-${t.profile.id}`;
              const short = balance < t.group_price_quipus;
              return (
                <Card key={key} className={cn("space-y-4", armed === key && "ring-2 ring-primary")}>
                  <button className="flex w-full items-center gap-3 text-left" onClick={() => setArmed(armed === key ? null : key)}>
                    <Avatar config={t.profile.avatar_config} equipped={t.equipped} size={56} label={t.profile.display_name} />
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2 font-extrabold">
                        {t.profile.display_name}
                        {i === 0 && <Pill className="bg-mint/30 text-accent-foreground">Top</Pill>}
                      </p>
                      <p className="text-xs font-semibold text-muted-foreground">
                        {t.profile.grade}º · {t.profile.school} · {LEVEL_LABEL[t.level]}
                      </p>
                      <Stars value={t.stats.estrellas_promedio} count={t.stats.sesiones_completadas} />
                    </div>
                    <Quipus amount={t.group_price_quipus} className="text-lg" />
                  </button>
                  {armed === key && (
                    <>
                      <Link href={`/tutor/${t.profile.id}`} className="block text-center text-xs font-bold text-primary">
                        Ver perfil
                      </Link>
                      <ConfirmRow
                        short={short}
                        need={t.group_price_quipus}
                        balance={balance}
                        pending={pending}
                        onConfirm={() => bookTutor(t)}
                        label="Reservar clase"
                      />
                    </>
                  )}
                </Card>
              );
            })}
          </div>
        </section>
      )}

      <section>
        <SectionTitle>
          <span className="flex items-center gap-2">
            <Sparkles className="size-5 text-primary" />
            {nothingHuman ? "Aún no hay tutores alumnos: aprende ya con IA" : "O aprende ahora mismo con un tutor IA"}
          </span>
        </SectionTitle>
        <div className="grid grid-cols-1 gap-3 @3xl:grid-cols-2">
          {data.aiTutors.map((t) => (
            <AiTutorCard key={t.id} tutor={t} requestId={requestId} />
          ))}
        </div>
      </section>
    </div>
  );
}

function ConfirmRow({
  short,
  need,
  balance,
  pending,
  onConfirm,
  label,
}: {
  short: boolean;
  need: number;
  balance: number;
  pending: boolean;
  onConfirm: () => void;
  label: string;
}) {
  if (short)
    return (
      <p className="rounded-2xl bg-gold/20 p-3 text-sm font-semibold text-gold-foreground">
        Te faltan {need - balance} quipus.{" "}
        <Link href="/ensenar" className="underline">
          Enseña para ganar más
        </Link>
        .
      </p>
    );
  return (
    <div className="space-y-2 animate-in fade-in slide-in-from-top-1">
      <button onClick={onConfirm} disabled={pending} className={cn(btn.primary, btn.md, "w-full")}>
        {pending ? "Reservando…" : `${label} · ${need} quipus`}
      </button>
      <p className="text-center text-xs text-muted-foreground">
        Tendrás {balance - need} quipus después de la clase. Se cobra al terminar.
      </p>
    </div>
  );
}
