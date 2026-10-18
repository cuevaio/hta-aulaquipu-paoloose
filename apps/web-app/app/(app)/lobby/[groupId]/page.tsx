"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Crown, Loader2, LogOut, Play, Users } from "lucide-react";
import { api, type LobbyDetail } from "@/lib/api";
import { useMutation, useSession } from "@/components/providers";
import { Avatar } from "@/components/avatar";
import { teacherAvatar } from "@/lib/campus/teacher-avatars";
import { Card, ErrorBox, Quipus, Skeleton, btn } from "@/components/bits";
import { cn } from "@/lib/utils";

const POLL_MS = 3000;
const MAX_GROUP = 5;

/**
 * Lobby de una clase IA compartida. Se actualiza cada 3 s: quién entró, cuánto paga cada uno y si
 * ya empezó (entonces todos los del grupo pasan al aula solos). Solo el anfitrión la inicia.
 */
export default function LobbyPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const router = useRouter();
  const { userId } = useSession();
  const { run, pending } = useMutation();
  const [lobby, setLobby] = useState<LobbyDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const entered = useRef(false);

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    const tick = async () => {
      try {
        const res = await api.lobby(userId, groupId);
        if (!alive) return;
        setLobby(res);
        setError(null);
        // Empezó: los del grupo entran al aula (una sola vez)
        if (res.liveSessionId && res.isMember && !entered.current) {
          entered.current = true;
          router.push(`/aula/${res.liveSessionId}`);
        }
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : "No pudimos cargar el grupo.");
      }
    };
    void tick();
    const timer = setInterval(tick, POLL_MS);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [userId, groupId, router]);

  const refresh = async () => {
    if (userId) setLobby(await api.lobby(userId, groupId).catch(() => lobby));
  };

  if (error && !lobby) return <ErrorBox message={error} />;
  if (!lobby) return <Skeleton className="h-72" />;

  const { group, topic, aiTutor, members, isHost, isMember, shareIfJoin } = lobby;
  const cancelled = group.status === "cancelled";
  const full = members.length >= MAX_GROUP;
  const hostName = lobby.host?.display_name.split(" ")[0] ?? "El anfitrión";

  return (
    <div className="mx-auto max-w-lg space-y-5">
      <div className="flex items-center gap-3">
        {aiTutor && <Avatar config={teacherAvatar(aiTutor.id, aiTutor.persona.color)} size={64} label={aiTutor.name} />}
        <div className="min-w-0">
          <p className="text-sm font-bold text-primary">✨ Clase compartida con IA</p>
          <h1 className="font-heading text-2xl font-semibold leading-tight">{topic.name}</h1>
          <p className="text-sm text-muted-foreground">con {aiTutor?.name ?? "un tutor IA"} · abrió {hostName}</p>
        </div>
      </div>

      {group.detail && group.detail.toLowerCase() !== topic.name.toLowerCase() && (
        <p className="rounded-2xl bg-secondary px-4 py-3 text-sm font-semibold text-secondary-foreground">“{group.detail}”</p>
      )}

      {cancelled ? (
        <Card className="space-y-3 text-center">
          <p className="font-extrabold">{hostName} cerró este grupo.</p>
          <Link href="/tutores-ia" className={cn(btn.primary, btn.md)}>
            Ver tutores IA
          </Link>
        </Card>
      ) : lobby.liveSessionId && !isMember ? (
        <Card className="text-center text-sm font-semibold">Esta clase ya empezó.</Card>
      ) : (
        <>
          <Card className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="flex items-center gap-1.5 font-extrabold">
                <Users className="size-4" /> {members.length} de {MAX_GROUP} alumnos
              </p>
              <p className="text-right text-sm">
                <span className="text-muted-foreground">{isMember ? "Tu parte ahora:" : "Pagarías:"} </span>
                <Quipus amount={shareIfJoin} className="text-base" />
              </p>
            </div>
            <ul className="space-y-2" aria-live="polite">
              {members.map((m) => (
                <li key={m.profile.id} className="flex items-center gap-3 rounded-2xl bg-muted/50 p-2">
                  <Avatar config={m.profile.avatar_config} size={36} label={m.profile.display_name} />
                  <span className="min-w-0 flex-1 truncate font-bold">
                    {m.profile.display_name}
                    {m.profile.id === userId && <span className="font-semibold text-muted-foreground"> (tú)</span>}
                  </span>
                  {m.isHost && (
                    <span className="flex items-center gap-1 rounded-full bg-gold/25 px-2 py-0.5 text-xs font-extrabold text-gold-foreground">
                      <Crown className="size-3" /> Anfitrión
                    </span>
                  )}
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground">
              {full
                ? "El grupo está completo."
                : `Invitamos a los alumnos conectados. Cada uno que entra baja el precio; nadie paga hasta que termine la clase.`}
            </p>
          </Card>

          {isHost ? (
            <div className="space-y-2">
              <button
                disabled={pending}
                onClick={async () => {
                  const res = await run((u) => api.startLobby(u, groupId));
                  if (res) {
                    entered.current = true;
                    router.push(`/aula/${res.sessionId}`);
                  }
                }}
                className={cn(btn.primary, btn.lg, "w-full")}
              >
                {pending ? <Loader2 className="size-5 animate-spin" /> : <Play className="size-5" />}
                {members.length > 1 ? `Iniciar la clase con ${members.length} alumnos` : "Iniciar la clase ahora"}
              </button>
              <p className="text-center text-xs text-muted-foreground">
                {members.length > 1 ? "Todos entran contigo al aula." : "Puedes esperar a que se sumen más o empezar ya (pagas el precio completo)."}
              </p>
              <button
                disabled={pending}
                onClick={async () => {
                  if (!confirm("¿Cerrar el grupo? Se cancela para todos.")) return;
                  const ok = await run(async (u) => {
                    await api.leaveLobby(u, groupId);
                    return true;
                  }, "Cerraste el grupo.");
                  if (ok) router.push("/tutores-ia");
                }}
                className={cn(btn.ghost, btn.sm, "w-full")}
              >
                Cerrar el grupo
              </button>
            </div>
          ) : isMember ? (
            <div className="space-y-2 text-center">
              <p className="flex items-center justify-center gap-2 rounded-2xl bg-mint/20 p-3 text-sm font-bold text-accent-foreground">
                <Loader2 className="size-4 animate-spin" /> Esperando a que {hostName} inicie la clase…
              </p>
              <button
                disabled={pending}
                onClick={async () => {
                  const ok = await run(async (u) => {
                    await api.leaveLobby(u, groupId);
                    return true;
                  }, "Saliste del grupo.");
                  if (ok) router.push("/tutores-ia");
                }}
                className={cn(btn.ghost, btn.sm)}
              >
                <LogOut className="size-4" /> Salir del grupo
              </button>
            </div>
          ) : (
            <button
              disabled={pending || full}
              onClick={async () => {
                const ok = await run((u) => api.book(u, { kind: "group", groupId }), "¡Te uniste al grupo!");
                if (ok) await refresh();
              }}
              className={cn(btn.primary, btn.lg, "w-full")}
            >
              {full ? "Grupo completo" : <>Unirme por {shareIfJoin} quipus</>}
            </button>
          )}
        </>
      )}
    </div>
  );
}
