"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Tag } from "lucide-react";
import { api } from "@/lib/api";
import type { AiTutor } from "@/lib/types";
import { useMutation, useSession } from "@/components/providers";
import { AiAvatar } from "@/components/avatar";
import { Quipus, btn } from "@/components/bits";
import { aiPrice } from "@/lib/pricing";
import { cn } from "@/lib/utils";

/** Tarjeta de tutor IA con reserva en dos toques: tocar → confirmar. */
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
  const price = aiPrice(tutor);
  const short = me ? me.available < price : false;

  const book = async () => {
    const res = await run((u) => api.book(u, { kind: "ai", aiTutorId: tutor.id, requestId }));
    if (res?.sessionId) router.push(`/aula/${res.sessionId}`);
  };

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-3xl bg-card p-4 ring-1 ring-border transition-all",
        armed && "ring-2 ring-primary",
      )}
    >
      <button className="flex items-center gap-3 text-left" onClick={() => setArmed((a) => !a)} aria-expanded={armed}>
        <AiAvatar emoji={tutor.persona.emoji} color={tutor.persona.color} size={compact ? 48 : 56} />
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
      {armed && (
        <div className="space-y-3 animate-in fade-in slide-in-from-top-1">
          {!compact && <p className="text-sm text-muted-foreground">{tutor.persona.style}</p>}
          {short ? (
            <p className="rounded-2xl bg-gold/20 p-3 text-sm font-semibold text-gold-foreground">
              Te faltan {price - (me?.available ?? 0)} quipus disponibles.{" "}
              <Link href="/ensenar" className="underline">
                Enseña para ganar más
              </Link>
              .
            </p>
          ) : (
            <button onClick={book} disabled={pending} className={cn(btn.primary, btn.md, "w-full")}>
              {pending ? "Abriendo aula…" : price === 0 ? "Empezar clase ahora · gratis" : `Empezar clase ahora · ${price} quipus`}
            </button>
          )}
          <p className="text-center text-xs text-muted-foreground">Se cobra al terminar la clase.</p>
        </div>
      )}
    </div>
  );
}
