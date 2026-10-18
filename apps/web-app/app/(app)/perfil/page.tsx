"use client";

import Link from "next/link";
import { useState } from "react";
import { Lock, Palette, Star } from "lucide-react";
import { api } from "@/lib/api";
import { useQuery, useSession } from "@/components/providers";
import { ProfileHero } from "@/components/profile-hero";
import { AiAvatar, Avatar } from "@/components/avatar";
import { Card, LEVEL_LABEL, Pill, SectionTitle, Skeleton, btn, timeAgo } from "@/components/bits";
import { cn } from "@/lib/utils";

export default function MyProfilePage() {
  const { me, userId } = useSession();
  const pub = useQuery((u) => api.tutorProfile(u));
  const reviews = useQuery((u) => api.myPrivateReviews(u));
  const sessions = useQuery((u) => api.mySessions(u));
  const [showReviews, setShowReviews] = useState(false);

  if (!me) return <Skeleton className="h-72" />;

  return (
    <div className="space-y-8">
      <ProfileHero profile={me.profile} equipped={me.equipped} stats={me.stats} badges={me.badges}>
        <Link href="/tienda" className={cn(btn.soft, btn.sm)}>
          <Palette className="size-4" /> Personalizar
        </Link>
      </ProfileHero>

      <div className="grid grid-cols-1 gap-8 @5xl:grid-cols-2">
        <section>
          <SectionTitle
            action={
              <button onClick={() => setShowReviews((s) => !s)} className={cn(btn.soft, btn.sm)}>
                <Lock className="size-4" /> {showReviews ? "Ocultar" : "Ver"} reviews privadas ({reviews.data?.length ?? 0})
              </button>
            }
          >
            Lo que dicen tus alumnos
          </SectionTitle>
          <p className="mb-3 text-sm text-muted-foreground">
            Las estrellas son públicas. Los comentarios solo los ves tú, para que mejores.
          </p>
          {showReviews && (
            <div className="space-y-2">
              {reviews.data?.length === 0 && <Card className="text-sm text-muted-foreground">Aún no tienes reviews. ¡Da tu primera clase!</Card>}
              {reviews.data?.map((r) => (
                <Card key={r.id} className="space-y-1 p-4">
                  <div className="flex items-center justify-between">
                    <span className="flex gap-0.5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} className={cn("size-4", i < r.stars ? "fill-gold text-gold" : "text-border")} />
                      ))}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {r.topic?.name} · {timeAgo(r.created_at)}
                    </span>
                  </div>
                  <p className="text-sm">{r.feedback_private ?? <i className="text-muted-foreground">Sin comentario</i>}</p>
                </Card>
              ))}
            </div>
          )}

          <SectionTitle action={<Link href="/ensenar" className="text-sm font-bold text-primary">Editar</Link>}>
            <span className="mt-6 block">Temas que enseño</span>
          </SectionTitle>
          <div className="flex flex-wrap gap-2">
            {pub.data?.topics.length === 0 && <p className="text-sm text-muted-foreground">Todavía no declaras ningún tema.</p>}
            {pub.data?.topics.map((t) => (
              <Pill key={t.topic_id} className="px-3 py-1 text-sm">
                {t.topic.name} · {LEVEL_LABEL[t.level]}
              </Pill>
            ))}
          </div>
        </section>

        <section>
          <SectionTitle>Historial de clases</SectionTitle>
          <div className="space-y-2">
            {sessions.data?.length === 0 && <Card className="text-sm text-muted-foreground">Aún no tienes clases.</Card>}
            {sessions.data?.map((s) => {
              const teaching = s.session.tutor_id === userId;
              return (
                <Link
                  key={s.session.id}
                  href={s.session.status === "live" ? `/aula/${s.session.id}` : `/resumen/${s.session.id}`}
                  className="flex items-center gap-3 rounded-2xl bg-card p-3 ring-1 ring-border hover:ring-primary"
                >
                  {s.aiTutor ? (
                    <AiAvatar emoji={s.aiTutor.persona.emoji} color={s.aiTutor.persona.color} size={40} />
                  ) : teaching ? (
                    <Avatar config={s.students[0]?.avatar_config ?? {}} size={40} />
                  ) : (
                    <Avatar config={s.tutor?.avatar_config ?? {}} equipped={s.tutorEquipped} size={40} />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-extrabold">{s.topic.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {teaching
                        ? `Enseñaste a ${s.students.map((x) => x.display_name.split(" ")[0]).join(", ")}`
                        : `Con ${s.aiTutor?.name ?? s.tutor?.display_name}`}{" "}
                      · {timeAgo(s.session.started_at)}
                    </p>
                  </div>
                  <Pill className={cn(s.session.status === "live" && "bg-coral/20 text-coral")}>
                    {s.session.status === "live" ? "En vivo" : s.session.status === "completed" ? "Terminada" : "Cancelada"}
                  </Pill>
                </Link>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
