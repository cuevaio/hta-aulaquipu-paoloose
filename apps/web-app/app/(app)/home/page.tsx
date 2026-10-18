"use client";

import Link from "next/link";
import { ArrowRight, BookOpen, GraduationCap } from "lucide-react";
import { api } from "@/lib/api";
import { useQuery, useSession } from "@/components/providers";
import { UpcomingClasses } from "@/components/upcoming-classes";
import { MyRequests } from "@/components/my-requests";
import { Avatar } from "@/components/avatar";
import { AiTutorCard } from "@/components/ai-tutor-card";
import { Card, Quipus, SectionTitle, Skeleton, btn, timeAgo } from "@/components/bits";
import { cn } from "@/lib/utils";

export default function HomePage() {
  const { me } = useSession();
  const feed = useQuery((u) => api.openRequestsFeed(u));
  const ai = useQuery((u) => api.listAiTutors(u));


  const firstName = me?.profile.display_name.split(" ")[0];

  return (
    <div className="space-y-8">
      {/* Billetera + CTAs */}
      <section className="grid grid-cols-1 gap-4 @3xl:grid-cols-[1fr_1.4fr]">
        <div className="hero-sky relative overflow-hidden rounded-[2rem] p-6 text-white">
          <p className="text-sm font-bold text-white/70">Hola{firstName ? `, ${firstName}` : ""} 👋</p>
          <p className="mt-4 text-xs font-bold tracking-wider text-white/60 uppercase">Tu billetera</p>
          <div className="mt-1">
            {me ? (
              <>
                <Quipus amount={me.balance} className="text-5xl text-gold" iconClassName="size-10" />
                {me.available < me.balance && (
                  <p className="mt-1 text-xs font-bold text-white/60">
                    {me.available} disponibles · {me.balance - me.available} reservados en clases por cobrar
                  </p>
                )}
              </>
            ) : (
              <Skeleton className="h-12 w-32 bg-white/10" />
            )}
          </div>
          <Link href="/quipus" className="relative z-10 mt-4 flex w-fit items-center gap-1 text-sm font-bold text-mint hover:underline">
            Ver historial <ArrowRight className="size-4" />
          </Link>
          <div className="absolute -right-4 -bottom-6 opacity-90" aria-hidden>
            {me && <Avatar config={me.profile.avatar_config} equipped={me.equipped} size={120} className="float" />}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 @xl:grid-cols-2">
          <Link
            href="/aprender"
            className="group flex flex-col justify-between gap-6 rounded-[2rem] bg-primary p-6 text-primary-foreground shadow-[0_4px_0_0_oklch(0.4_0.2_282)] transition-transform hover:-translate-y-1"
          >
            <span className="grid size-12 place-items-center rounded-2xl bg-white/15">
              <BookOpen className="size-6" />
            </span>
            <span>
              <span className="block font-heading text-2xl font-semibold">Quiero aprender</span>
              <span className="text-sm text-white/75">Cuéntanos qué no entiendes; gastas quipus y mejoras.</span>
            </span>
          </Link>
          <Link
            href="/ensenar"
            className="group flex flex-col justify-between gap-6 rounded-[2rem] bg-mint p-6 text-accent-foreground shadow-[0_4px_0_0_var(--mint-deep)] transition-transform hover:-translate-y-1"
          >
            <span className="grid size-12 place-items-center rounded-2xl bg-white/30">
              <GraduationCap className="size-6" />
            </span>
            <span>
              <span className="block font-heading text-2xl font-semibold">Quiero enseñar</span>
              <span className="text-sm text-accent-foreground/75">Declara lo que dominas; te contratan y ganas.</span>
            </span>
          </Link>
        </div>
      </section>

      <div id="clases" className="scroll-mt-4">
        <UpcomingClasses />
      </div>

      <div className="grid grid-cols-1 gap-8 @5xl:grid-cols-[1.3fr_1fr]">
        <div className="space-y-8">
          {/* Mis pedidos */}
          <MyRequests title="Lo que quiero aprender" action={<Link href="/aprender" className="text-sm font-bold text-primary">+ Nuevo</Link>} />

          {/* Pedidos abiertos de otros: el lado "ganar" del bucle */}
          <section>
            <SectionTitle action={<Link href="/ensenar" className="text-sm font-bold text-primary">Panel de tutor</Link>}>
              Otros alumnos necesitan ayuda
            </SectionTitle>
            <div className="space-y-2">
              {feed.data?.map(({ request, student, topic }) => (
                <div key={request.id} className="flex items-center gap-3 rounded-2xl bg-card p-4 ring-1 ring-border">
                  <Avatar config={student.avatar_config} size={40} label={student.display_name} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">
                      <b>{student.display_name.split(" ")[0]}</b> <span className="text-muted-foreground">({student.grade}º)</span> ·{" "}
                      <span className="font-bold text-primary">{topic.name}</span>
                    </p>
                    <p className="truncate text-sm text-muted-foreground">“{request.detail}” · {timeAgo(request.created_at)}</p>
                  </div>
                  <Link href="/ensenar" className={cn(btn.mint, btn.sm, "shrink-0")}>
                    Enseñar
                  </Link>
                </div>
              ))}
              {feed.data?.length === 0 && (
                <Card className="text-center text-sm text-muted-foreground">No hay pedidos abiertos ahora mismo.</Card>
              )}
            </div>
          </section>
        </div>

        {/* Atajo a tutores IA */}
        <section>
          <SectionTitle>Tutores IA, disponibles ya</SectionTitle>
          <div className="space-y-3">
            {ai.data?.map((t) => <AiTutorCard key={t.id} tutor={t} requestId={null} compact />)}
            {ai.loading && !ai.data && <Skeleton className="h-24" />}
          </div>
        </section>
      </div>
    </div>
  );
}
