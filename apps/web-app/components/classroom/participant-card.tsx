"use client";

import { useEffect, useRef } from "react";
import type { VideoTrack } from "livekit-client";
import { Mic, MicOff, Sparkles } from "lucide-react";
import type { AvatarConfig, Equipped } from "@/lib/types";
import { AiAvatar, Avatar } from "@/components/avatar";
import { cn } from "@/lib/utils";

export interface Participant {
  key: string;
  name: string;
  role: "tutor" | "student";
  isMe: boolean;
  ai?: { emoji: string; color: string };
  avatar?: AvatarConfig;
  equipped?: Equipped | null;
  micOn: boolean;
  connected: boolean;
}

/** Tarjeta fija de avatar (estilo gather, sin avatares móviles). Muestra video si hay stream. */
export function ParticipantCard({
  p,
  speaking,
  stream,
  videoTrack,
  large,
}: {
  p: Participant;
  speaking: boolean;
  /** Cámara local en modo sin LiveKit. */
  stream?: MediaStream | null;
  /** Pista de video de LiveKit (propia o remota). */
  videoTrack?: VideoTrack | null;
  large?: boolean;
}) {
  const video = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const el = video.current;
    if (!el) return;
    if (videoTrack) {
      videoTrack.attach(el);
      return () => {
        videoTrack.detach(el);
      };
    }
    el.srcObject = stream ?? null;
  }, [stream, videoTrack]);
  const hasVideo = !!videoTrack || !!stream;

  return (
    <div
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden rounded-3xl bg-navy-2 ring-2 transition-all",
        speaking ? "ring-mint" : "ring-white/10",
        large ? "h-40 w-full md:h-44" : "h-28 w-36 md:h-32 md:w-full",
      )}
    >
      {hasVideo ? (
        <video
          ref={video}
          autoPlay
          playsInline
          muted
          className={cn("absolute inset-0 size-full object-cover", p.isMe && "scale-x-[-1]")}
        />
      ) : p.ai ? (
        <AiAvatar emoji={p.ai.emoji} color={p.ai.color} size={large ? 84 : 60} speaking={speaking} />
      ) : (
        <Avatar config={p.avatar ?? {}} equipped={p.equipped} size={large ? 84 : 60} speaking={speaking} label={p.name} className={cn(!p.connected && "opacity-50 grayscale")} />
      )}
      <div className="absolute inset-x-2 bottom-2 flex items-center gap-1.5">
        <span className="flex min-w-0 items-center gap-1 rounded-full bg-black/45 px-2 py-0.5 text-[11px] font-bold text-white backdrop-blur">
          {p.micOn ? <Mic className="size-3 text-mint" /> : <MicOff className="size-3 text-coral" />}
          <span className="truncate">
            {p.name}
            {p.isMe && " (tú)"}
          </span>
        </span>
      </div>
      {p.role === "tutor" && (
        <span className="absolute top-2 left-2 flex items-center gap-1 rounded-full bg-gold px-2 py-0.5 text-[10px] font-black text-gold-foreground">
          {p.ai && <Sparkles className="size-3" />} Tutor
        </span>
      )}
      {!p.connected && (
        <span className="absolute top-2 right-2 rounded-full bg-black/40 px-2 py-0.5 text-[10px] font-bold text-white/80">
          {p.ai ? "conectando…" : "sin conexión"}
        </span>
      )}
    </div>
  );
}
