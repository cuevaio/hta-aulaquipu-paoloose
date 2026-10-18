"use client";

// Invitaciones a clase: consulta tus clases y los grupos abiertos cada pocos segundos y avisa
// (aviso nativo una sola vez + tarjeta para unirte) cuando:
// - un profe agenda tu clase o está listo (suena el timbre),
// - empezó una clase IA compartida de la que eres parte,
// - alguien conectado abrió una clase IA compartida a la que puedes unirte.
// Todo sale de la API, así que funciona entre PCs distintas.

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { LobbyInvite, UpcomingClass } from "@/lib/api";
import { friendlyWhen } from "@/components/bits";
import { addMark, hasMark, showNotification } from "@/lib/notify";
import { installAudioUnlock, startRinging, stopRinging } from "@/lib/ring";
import type { Profile } from "@/lib/types";

const POLL_MS = 8000;
/** Desde esta cercanía la clase se anuncia como "tu profe está listo". */
const READY_WITHIN_MS = 15 * 60_000;

export interface ClassAlert {
  key: string;
  /** "class": entrar a una clase tuya · "lobby": unirse a un grupo IA abierto por otro alumno. */
  kind: "class" | "lobby";
  groupId: string;
  title: string;
  body: string;
  /** A quién se muestra en la tarjeta (el profe, o quien abrió el grupo). */
  tutor: Profile | null;
  live: boolean;
  /** El profe llegó o la clase empezó: suena el timbre hasta que aceptes o cierres. */
  ring: boolean;
  cta: string;
}

const first = (p: Profile | null | undefined, fallback: string) => p?.display_name.split(" ")[0] ?? fallback;

function classAlerts(upcoming: UpcomingClass[], userId: string): ClassAlert[] {
  const out: ClassAlert[] = [];
  for (const c of upcoming) {
    if (c.role !== "student") continue;
    const live = !!c.liveSessionId;
    const base = { kind: "class" as const, groupId: c.group.id, cta: "Unirme a la clase" };

    // Clase IA compartida: avisa a los miembros cuando el anfitrión la inicia (al anfitrión no)
    if (c.group.ai_tutor_id) {
      if (!live || c.group.host_id === userId) continue;
      const key = `${c.group.id}:ailive`;
      if (hasMark(userId, `d:${key}`)) continue;
      out.push({ ...base, key, tutor: null, live, ring: true, title: `Tu clase de ${c.topic.name} ya empezó`, body: "La clase con IA te espera. ¡Únete ahora!" });
      continue;
    }

    if (!c.group.tutor_id) continue;
    if (!live && c.group.status !== "scheduled") continue;
    const startsIn = c.group.scheduled_at ? new Date(c.group.scheduled_at).getTime() - Date.now() : Infinity;
    const ready = live || startsIn <= READY_WITHIN_MS;
    const who = first(c.tutor, "Tu profe");
    const key = `${c.group.id}:${live ? "live" : ready ? "ready" : "sched"}`;
    if (hasMark(userId, `d:${key}`)) continue;
    out.push(
      live
        ? { ...base, key, tutor: c.tutor, live, ring: false, title: `Tu clase de ${c.topic.name} ya está abierta`, body: `Únete con ${who} y tus compañeros.` }
        : ready
          ? { ...base, key, tutor: c.tutor, live, ring: true, title: `¡Tu profe ${who} está listo!`, body: `Clase de ${c.topic.name}. Únete cuando quieras.` }
          : { ...base, key, tutor: c.tutor, live, ring: false, title: `${who} agendó tu clase`, body: `${c.topic.name} · ${friendlyWhen(c.group.scheduled_at)}` },
    );
  }
  return out;
}

function lobbyAlerts(invites: LobbyInvite[], userId: string): ClassAlert[] {
  return invites
    .map((l): ClassAlert => {
      const detail = l.detail && l.detail.toLowerCase() !== l.topic.name.toLowerCase() ? ` · “${l.detail}”` : "";
      return {
        key: `lobby:${l.groupId}`,
        kind: "lobby",
        groupId: l.groupId,
        tutor: l.host,
        live: false,
        ring: false,
        title: `${first(l.host, "Un compañero")} abrió una clase con ${l.aiTutor?.name ?? "un tutor IA"}`,
        body: `${l.topic.name}${detail} · únete por ${l.shareIfJoin} quipus`,
        cta: `Unirme por ${l.shareIfJoin} quipus`,
      };
    })
    .filter((a) => !hasMark(userId, `d:${a.key}`));
}

export function useClassAlerts(userId: string | null, onOpen: (alert: ClassAlert) => void) {
  const [alerts, setAlerts] = useState<ClassAlert[]>([]);

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    installAudioUnlock();

    const tick = async () => {
      // Señal de "estoy conectado" para el modo demo (en el servidor real lo da el propio sondeo)
      try {
        localStorage.setItem(`aq:seen:${userId}`, String(Date.now()));
      } catch {
        /* sin almacenamiento */
      }
      const [upcoming, invites] = await Promise.allSettled([api.myUpcoming(userId), api.openLobbies(userId)]);
      if (!alive) return;
      // Sin red (o sin la migración 005 de lobbies): se reintenta en el siguiente ciclo con lo que haya
      const next = [
        ...(upcoming.status === "fulfilled" ? classAlerts(upcoming.value, userId) : []),
        ...(invites.status === "fulfilled" ? lobbyAlerts(invites.value, userId) : []),
      ];
      for (const alert of next) {
        if (alert.ring && !hasMark(userId, `r:${alert.key}`)) {
          addMark(userId, `r:${alert.key}`);
          startRinging();
        }
        if (!hasMark(userId, `n:${alert.key}`)) {
          addMark(userId, `n:${alert.key}`);
          showNotification(alert.title, { body: alert.body, tag: alert.key, onClick: () => onOpen(alert) });
        }
      }
      setAlerts((prev) => (JSON.stringify(prev.map((a) => a.key + a.body)) === JSON.stringify(next.map((a) => a.key + a.body)) ? prev : next));
    };

    void tick();
    const timer = setInterval(tick, POLL_MS);
    const onVisible = () => document.visibilityState === "visible" && void tick();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      alive = false;
      stopRinging();
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [userId, onOpen]);

  /** Quita la tarjeta y no vuelve a mostrar ese estado de esa clase. */
  const dismiss = useCallback(
    (key: string) => {
      stopRinging();
      if (userId) addMark(userId, `d:${key}`);
      setAlerts((a) => a.filter((x) => x.key !== key));
    },
    [userId],
  );

  return { alerts, dismiss };
}
