"use client";

import Link from "next/link";
import { useState } from "react";
import { useParams } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Lock, PartyPopper, Star } from "lucide-react";
import { api } from "@/lib/api";
import { useMutation, useQuery, useSession } from "@/components/providers";
import { AiAvatar, Avatar } from "@/components/avatar";
import { Card, ErrorBox, Quipus, SectionTitle, Skeleton, btn } from "@/components/bits";
import { cn } from "@/lib/utils";

export default function SessionSummaryPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { userId, me } = useSession();
  const { data, error } = useQuery((u) => api.session(u, sessionId), [sessionId]);
  const ledger = useQuery((u) => api.ledger(u));
  const { run, pending } = useMutation();
  const [stars, setStars] = useState(0);
  const [hover, setHover] = useState(0);
  const [feedback, setFeedback] = useState("");

  if (error) return <ErrorBox message={error} />;
  if (!data) return <Skeleton className="h-96" />;

  const { session, topic, aiTutor, tutor, students, myReview } = data;
  const iAmTutor = session.tutor_id === userId;
  const isStudent = session.student_ids.includes(userId ?? "");
  const moves = ledger.data?.filter((l) => l.session_id === session.id) ?? [];
  const paid = moves.filter((l) => l.direction === "out").reduce((a, l) => a + l.amount, 0);
  const earned = moves.filter((l) => l.direction === "in").reduce((a, l) => a + l.amount, 0);
  const tutorName = aiTutor?.name ?? tutor?.display_name ?? "tu tutor";
  const minutes = session.ended_at
    ? Math.max(1, Math.round((new Date(session.ended_at).getTime() - new Date(session.started_at).getTime()) / 60000))
    : null;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="hero-sky relative overflow-hidden rounded-[2rem] p-6 text-white @3xl:p-8">
        <PartyPopper className="size-10 text-gold" />
        <h1 className="mt-3 font-heading text-3xl font-semibold">
          {session.status === "live" ? "Clase en curso" : "¡Clase terminada!"}
        </h1>
        <p className="mt-1 text-white/75">
          {topic.name} con {iAmTutor ? students.map((s) => s.display_name.split(" ")[0]).join(", ") : tutorName}
          {minutes ? ` · ${minutes} min` : ""}
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          {iAmTutor ? (
            <div className="rounded-2xl bg-white/10 px-4 py-3">
              <p className="text-xs font-bold text-white/60">Ganaste enseñando</p>
              <Quipus amount={earned} sign="+" className="text-3xl text-mint" iconClassName="size-6" />
            </div>
          ) : (
            <div className="rounded-2xl bg-white/10 px-4 py-3">
              <p className="text-xs font-bold text-white/60">Invertiste en aprender</p>
              <Quipus amount={paid} sign="−" className="text-3xl text-gold" iconClassName="size-6" />
            </div>
          )}
          {me && (
            <div className="rounded-2xl bg-white/10 px-4 py-3">
              <p className="text-xs font-bold text-white/60">Saldo ahora</p>
              <Quipus amount={me.balance} className="text-3xl" iconClassName="size-6" />
            </div>
          )}
        </div>
        <div className="absolute -right-2 -bottom-4 hidden @xl:block" aria-hidden>
          {aiTutor ? (
            <AiAvatar emoji={aiTutor.persona.emoji} color={aiTutor.persona.color} size={110} className="float" />
          ) : tutor ? (
            <Avatar config={tutor.avatar_config} equipped={data.tutorEquipped} size={110} className="float" />
          ) : null}
        </div>
      </div>

      {/* Review: estrellas públicas + comentario privado */}
      {isStudent && session.status === "completed" && (
        <Card>
          {myReview ? (
            <div className="text-center">
              <p className="font-extrabold">¡Gracias por tu review!</p>
              <p className="mt-1 flex justify-center gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className={cn("size-6", i < myReview.stars ? "fill-gold text-gold" : "text-border")} />
                ))}
              </p>
            </div>
          ) : (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                await run((u) => api.review(u, session.id, stars, feedback), "¡Gracias! Tu review ayuda a mejorar.");
              }}
              className="space-y-4"
            >
              <SectionTitle>¿Cómo estuvo la clase con {tutorName}?</SectionTitle>
              <div className="flex justify-center gap-1" onMouseLeave={() => setHover(0)} role="radiogroup" aria-label="Estrellas">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    type="button"
                    key={n}
                    role="radio"
                    aria-checked={stars === n}
                    aria-label={`${n} estrella${n > 1 ? "s" : ""}`}
                    onMouseEnter={() => setHover(n)}
                    onClick={() => setStars(n)}
                    className="p-1 transition-transform hover:scale-110"
                  >
                    <Star className={cn("size-10", n <= (hover || stars) ? "fill-gold text-gold" : "text-border")} />
                  </button>
                ))}
              </div>
              <div>
                <label htmlFor="fb" className="mb-1 flex items-center gap-1.5 text-sm font-bold">
                  <Lock className="size-3.5" /> Comentario privado (solo lo ve {aiTutor ? "el equipo del agente" : "tu tutor"})
                </label>
                <textarea
                  id="fb"
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  rows={3}
                  maxLength={500}
                  placeholder="¿Qué te ayudó? ¿Qué mejorarías?"
                  className="w-full resize-none rounded-2xl bg-muted p-3 text-sm font-semibold outline-none focus:ring-4 focus:ring-ring/20"
                />
              </div>
              <button type="submit" disabled={!stars || pending} className={cn(btn.primary, btn.md, "w-full")}>
                Enviar review
              </button>
            </form>
          )}
        </Card>
      )}

      <Card>
        <SectionTitle>Lo que vimos</SectionTitle>
        {session.doc_markdown.trim() ? (
          <div className="markdown-body max-h-[28rem] overflow-y-auto rounded-2xl bg-muted/50 p-4">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{session.doc_markdown}</ReactMarkdown>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No se escribió nada en el documento de esta clase.</p>
        )}
      </Card>

      {moves.length > 0 && (
        <Card>
          <SectionTitle>Movimientos de esta clase</SectionTitle>
          <ul className="space-y-1 text-sm">
            {moves.map((l) => (
              <li key={l.id} className="flex justify-between">
                <span>{l.description}</span>
                <Quipus amount={l.amount} sign={l.direction === "in" ? "+" : "−"} />
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="flex flex-col gap-2 @xl:flex-row">
        <Link href="/aprender" className={cn(btn.primary, btn.md, "flex-1")}>
          Aprender otra cosa
        </Link>
        <Link href="/ensenar" className={cn(btn.mint, btn.md, "flex-1")}>
          Enseñar y ganar quipus
        </Link>
      </div>
    </div>
  );
}
