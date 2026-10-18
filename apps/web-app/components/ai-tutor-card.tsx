"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Tag, User, Users } from "lucide-react";
import { api } from "@/lib/api";
import type { AiTutor } from "@/lib/types";
import { useMutation, useSession } from "@/components/providers";
import { Avatar } from "@/components/avatar";
import { teacherAvatar, useTeacherPose } from "@/lib/campus/teacher-avatars";
import { Quipus, btn } from "@/components/bits";
import { aiPrice } from "@/lib/pricing";
import { cn } from "@/lib/utils";

/** Máximo de alumnos en una clase IA compartida (como los grupos con tutor). */
const MAX_GROUP = 5;

/**
 * Tarjeta de tutor IA. Desde un pedido (requestId) la reserva es de dos toques. Desde la lista de
 * tutores el alumno elige el tema (con sugerencias) y si toma la clase solo (paga todo y empieza ya)
 * o espera compañeros (abre un lobby, el precio se reparte y él decide cuándo empezar).
 */
export function AiTutorCard({
  tutor,
  requestId,
  compact,
  defaultArmed = false,
}: {
  tutor: AiTutor;
  requestId: string | null;
  compact?: boolean;
  defaultArmed?: boolean;
}) {
  const router = useRouter();
  const { me } = useSession();
  const { run, pending } = useMutation();
  const [armed, setArmed] = useState(defaultArmed);
  const [topic, setTopic] = useState("");
  const [mode, setMode] = useState<"solo" | "group">("solo");
  const price = aiPrice(tutor);
  const available = me?.available ?? 0;
  // El lobby reserva el precio de lista completo hasta que se sume gente (sin promociones personales)
  const need = mode === "solo" ? price : tutor.price_quipus;
  const short = me ? available < need : false;
  const withTopic = !requestId;
  const topicOk = topic.trim().length >= 3;

  const bookFromRequest = async () => {
    const res = await run((u) => api.book(u, { kind: "ai", aiTutorId: tutor.id, requestId }));
    if (res?.sessionId) router.push(`/aula/${res.sessionId}`);
  };

  const start = async () => {
    const text = topic.trim();
    if (mode === "solo") {
      // El tema propio queda como pedido individual: la clase lo usa como tema y punto de partida
      const res = await run(async (u) => {
        const { requestId: rid } = await api.createRequest(u, { text, mode: "individual", preferredAt: null });
        return api.book(u, { kind: "ai", aiTutorId: tutor.id, requestId: rid });
      });
      if (res?.sessionId) router.push(`/aula/${res.sessionId}`);
      return;
    }
    const res = await run((u) => api.createAiLobby(u, { aiTutorId: tutor.id, text }), "¡Grupo abierto! Invitamos a los que están conectados.");
    if (res) router.push(`/lobby/${res.groupId}`);
  };

  return (
    <div className={cn("flex flex-col gap-3 rounded-3xl bg-card p-4 ring-1 ring-border transition-all", armed && "ring-2 ring-primary")}>
      <button className="flex items-center gap-3 text-left" onClick={() => setArmed((a) => !a)} aria-expanded={armed}>
        {/* El mismo profe que está de pie en el campus (sprite), con su emoji de IA */}
        <span className="relative shrink-0">
          <Avatar config={teacherAvatar(tutor.id, tutor.persona.color)} size={compact ? 48 : 56} label={tutor.name} />
          <span className="absolute -right-1 -bottom-1 flex items-center gap-0.5 rounded-full bg-navy px-1 py-px text-[9px] font-black text-mint ring-2 ring-card" aria-hidden>
            <span className="text-[11px] leading-none">{tutor.persona.emoji}</span> IA
          </span>
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 font-extrabold">
            {tutor.name} <Sparkles className="size-3.5 text-primary" />
          </p>
          <p className="truncate text-sm text-muted-foreground">{tutor.persona.tagline}</p>
        </div>
        <span className="flex flex-col items-end gap-0.5">
          {tutor.promo && (
            <span className="inline-flex items-center gap-1 rounded-full bg-gold/25 px-2 py-0.5 text-[11px] font-extrabold text-gold-foreground">
              <Tag className="size-3" /> {tutor.promo.first_class_free ? "Promo · 1ª gratis" : `Promo −${tutor.promo.percent_off}%`}
            </span>
          )}
          {price === 0 ? <span className="text-sm font-extrabold text-accent-foreground">Gratis</span> : <Quipus amount={price} className="text-sm" />}
          {price < tutor.price_quipus && <s className="text-xs font-semibold text-muted-foreground">{tutor.price_quipus}</s>}
        </span>
      </button>

      {armed && !withTopic && (
        <div className="space-y-3 animate-in fade-in slide-in-from-top-1">
          {!compact && <TeacherProfile tutor={tutor} />}
          {available < price && me ? (
            <ShortNote missing={price - available} />
          ) : (
            <button onClick={bookFromRequest} disabled={pending} className={cn(btn.primary, btn.md, "w-full")}>
              {pending ? "Abriendo aula…" : price === 0 ? "Empezar clase ahora · gratis" : `Empezar clase ahora · ${price} quipus`}
            </button>
          )}
          <p className="text-center text-xs text-muted-foreground">Se cobra al terminar la clase.</p>
        </div>
      )}

      {armed && withTopic && (
        <div className="space-y-4 animate-in fade-in slide-in-from-top-1">
          {!compact && <TeacherProfile tutor={tutor} />}

          <div className="space-y-2">
            <label htmlFor={`topic-${tutor.id}`} className="text-sm font-extrabold">
              ¿Qué quieres aprender?
            </label>
            <input
              id={`topic-${tutor.id}`}
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              maxLength={280}
              placeholder="Escribe tu tema o elige uno de abajo"
              className="w-full rounded-2xl bg-muted/50 px-4 py-3 text-base font-semibold ring-1 ring-border outline-none focus:ring-2 focus:ring-primary"
            />
            {!!tutor.topics?.length && (
              <div className="flex flex-wrap gap-1.5" aria-label="Temas sugeridos">
                {tutor.topics.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setTopic(t.name)}
                    aria-pressed={topic === t.name}
                    className={cn(
                      "rounded-full px-3 py-1 text-xs font-extrabold ring-1 transition",
                      topic === t.name ? "bg-primary text-primary-foreground ring-primary" : "bg-card ring-border hover:ring-primary",
                    )}
                  >
                    {t.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-2 @md:grid-cols-2" role="radiogroup" aria-label="Cómo tomar la clase">
            <ModeOption
              on={mode === "solo"}
              onPick={() => setMode("solo")}
              icon={<User className="size-5" />}
              title="Solo, ahora"
              note={price === 0 ? "Gratis · empieza de inmediato" : `${price} quipus · empieza de inmediato`}
            />
            <ModeOption
              on={mode === "group"}
              onPick={() => setMode("group")}
              icon={<Users className="size-5" />}
              title="Con compañeros"
              note={`Desde ${Math.floor(tutor.price_quipus / MAX_GROUP)} quipus · tú decides cuándo empieza`}
            />
          </div>

          {mode === "group" && (
            <p className="rounded-2xl bg-secondary p-3 text-xs font-semibold text-secondary-foreground">
              Abrimos un grupo con tu nombre e invitamos a los alumnos conectados. El precio se reparte entre todos (hasta {MAX_GROUP}) y tú inicias la
              clase cuando quieras. Mientras esperas se reservan {tutor.price_quipus} quipus; pagas solo tu parte al terminar.
            </p>
          )}

          {short ? (
            <ShortNote missing={need - available} />
          ) : (
            <button onClick={start} disabled={pending || !topicOk} className={cn(btn.primary, btn.md, "w-full")}>
              {pending
                ? mode === "solo"
                  ? "Abriendo aula…"
                  : "Abriendo grupo…"
                : !topicOk
                  ? "Escribe o elige un tema"
                  : mode === "solo"
                    ? price === 0
                      ? "Empezar clase ahora · gratis"
                      : `Empezar clase ahora · ${price} quipus`
                    : "Abrir mi grupo e invitar"}
            </button>
          )}
          <p className="text-center text-xs text-muted-foreground">Se cobra al terminar la clase.</p>
        </div>
      )}
    </div>
  );
}

/** Lo que el profe te dice al presentarse: quién es, cómo enseña y qué temas domina. */
function introOf(tutor: AiTutor): string {
  const p = tutor.persona;
  const topics = (tutor.topics ?? []).slice(0, 3).map((t) => t.name.toLowerCase());
  const list = topics.length > 1 ? `${topics.slice(0, -1).join(", ")} y ${topics[topics.length - 1]}` : topics[0];
  return [
    `¡Hola! Soy ${tutor.name} 👋`,
    p.tagline && `${p.tagline.replace(/\.$/, "")}.`,
    p.focus && `Mi especialidad es ${p.focus.replace(/\.$/, "")}.`,
    p.style && `Mi estilo: ${p.style.replace(/\.$/, "")}.`,
    list && `Te puedo ayudar con ${list}.`,
    "Cuéntame qué quieres aprender y empezamos.",
  ]
    .filter(Boolean)
    .join(" ");
}

/** Perfil del profe IA: su figura de cuerpo entero (se mueve como en el campus) y un globo donde se presenta. */
function TeacherProfile({ tutor }: { tutor: AiTutor }) {
  const pose = useTeacherPose(tutor.id);
  return (
    <div
      className="flex items-end gap-3 overflow-hidden rounded-2xl p-3"
      style={{ background: `linear-gradient(135deg, ${tutor.persona.color}33, transparent)` }}
    >
      {/* La figura de pie es más alta que su caja: el relleno le deja lugar y el recorte evita tapar la cabecera */}
      <div className="shrink-0 pt-28">
        <Avatar config={teacherAvatar(tutor.id, tutor.persona.color)} pose={pose} size={64} bare label={`${tutor.name}, tutor IA`} />
      </div>
      <div className="relative mb-12 min-w-0 flex-1 rounded-2xl rounded-bl-sm bg-card px-3.5 py-2.5 text-sm leading-snug font-semibold shadow-md ring-1 ring-black/5">
        {/* Colita del globo apuntando al profe */}
        <span aria-hidden className="absolute bottom-0 -left-2 size-3 bg-card [clip-path:polygon(100%_0,100%_100%,0_100%)]" />
        {introOf(tutor)}
      </div>
    </div>
  );
}

function ModeOption({ on, onPick, icon, title, note }: { on: boolean; onPick: () => void; icon: React.ReactNode; title: string; note: string }) {
  return (
    <button
      role="radio"
      aria-checked={on}
      onClick={onPick}
      className={cn("flex items-start gap-2.5 rounded-2xl border-2 p-3 text-left transition", on ? "border-primary bg-primary/5" : "border-border hover:bg-muted")}
    >
      <span className={cn("mt-0.5", on ? "text-primary" : "text-muted-foreground")}>{icon}</span>
      <span>
        <span className="block font-extrabold">{title}</span>
        <span className="block text-xs text-muted-foreground">{note}</span>
      </span>
    </button>
  );
}

function ShortNote({ missing }: { missing: number }) {
  return (
    <p className="rounded-2xl bg-gold/20 p-3 text-sm font-semibold text-gold-foreground">
      Te faltan {missing} quipus disponibles.{" "}
      <Link href="/ensenar" className="underline">
        Enseña para ganar más
      </Link>
      .
    </p>
  );
}
