"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarClock, Radio, Users } from "lucide-react";
import { api } from "@/lib/api";
import { useMutation, useQuery } from "@/components/providers";
import { Avatar } from "@/components/avatar";
import { Card, Pill, Quipus, SectionTitle, Skeleton, btn, formatWhen } from "@/components/bits";
import { cn } from "@/lib/utils";

/** Clases agendadas o en vivo del usuario, con acceso directo al aula. */
export function UpcomingClasses({ hideWhenEmpty }: { hideWhenEmpty?: boolean }) {
  const router = useRouter();
  const upcoming = useQuery((u) => api.myUpcoming(u));
  const { run, pending } = useMutation();

  const enterClass = async (groupId: string) => {
    const res = await run((u) => api.startGroupSession(u, groupId));
    if (res) router.push(`/aula/${res.sessionId}`);
  };

  const empty = upcoming.data?.length === 0;
  if (hideWhenEmpty && empty) return null;

  return (
    <section>
      <SectionTitle>Tus próximas clases</SectionTitle>
      {empty && (
        <Card className="space-y-3 text-center text-sm text-muted-foreground">
          <p>No tienes clases agendadas todavía.</p>
          <div className="flex flex-wrap justify-center gap-2">
            <Link href="/aprender" className={cn(btn.primary, btn.sm)}>
              Pedir una tutoría
            </Link>
            <Link href="/tutores-ia" className={cn(btn.soft, btn.sm)}>
              Clase con IA ahora
            </Link>
          </div>
        </Card>
      )}
      <div className="grid grid-cols-1 gap-3 @3xl:grid-cols-2">
        {upcoming.loading && !upcoming.data && <Skeleton className="h-28" />}
        {upcoming.data?.map((c) => (
          <Card key={c.group.id} className="flex flex-col gap-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-heading text-lg font-semibold">{c.topic.name}</p>
                <p className="flex items-center gap-1 text-sm text-muted-foreground">
                  <CalendarClock className="size-4" /> {formatWhen(c.group.scheduled_at)}
                </p>
              </div>
              {c.liveSessionId ? (
                <Pill className="bg-coral/20 text-coral">
                  <Radio className="size-3" /> En vivo
                </Pill>
              ) : c.role === "tutor" ? (
                <Pill className="bg-mint/30 text-accent-foreground">Enseñas tú</Pill>
              ) : (
                <Pill>{c.group.status === "forming" ? "Grupo armándose" : "Confirmada"}</Pill>
              )}
            </div>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center -space-x-2">
                {c.members.slice(0, 5).map((m) => (
                  <Avatar key={m.id} config={m.avatar_config} size={30} label={m.display_name} />
                ))}
                <span className="pl-4 text-xs font-semibold text-muted-foreground">
                  <Users className="mr-1 inline size-3.5" />
                  {c.members.length} alumno{c.members.length === 1 ? "" : "s"}
                  {c.tutor && c.role === "student" ? ` · con ${c.tutor.display_name.split(" ")[0]}` : ""}
                </span>
              </div>
              {c.myShare !== null && <Quipus amount={c.myShare} className="text-sm" />}
            </div>
            <button onClick={() => enterClass(c.group.id)} disabled={pending} className={cn(btn.primary, btn.sm)}>
              {c.liveSessionId ? "Volver al aula" : c.role === "tutor" ? "Abrir el aula" : "Entrar al aula"}
            </button>
          </Card>
        ))}
      </div>
    </section>
  );
}
