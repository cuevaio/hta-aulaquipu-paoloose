"use client";

// Chat de texto por proximidad sobre la conexión del campus (sin segunda sala LiveKit).
// Es opt-in por usuario (apagado por defecto), por lo que apagado ni envía ni muestra nada.
// El envío va solo a quienes están cerca; quien recibe vuelve a comprobarlo con sus propios datos.

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { CampusPeer, PeerPosition } from "@/lib/campus/use-campus-presence";
import { CHAT_RADIUS, CHAT_RADIUS_TOLERANCE, LOG_SIZE, isNearby, prepareMessage, rateLimit } from "@/lib/campus/chat-rules";

export interface ChatLine {
  id: number;
  /** id de perfil de quien escribió, o "me" */
  from: string;
  name: string;
  text: string;
}

// ---- almacenamiento por usuario (localStorage puede estar bloqueado: respaldo en memoria) ----
const STORE_EVENT = "aq:chat-store";
const memory = new Map<string, string>();
const readStore = (key: string) => {
  try {
    return localStorage.getItem(key) ?? memory.get(key) ?? "";
  } catch {
    return memory.get(key) ?? "";
  }
};
const writeStore = (key: string, value: string) => {
  memory.set(key, value);
  try {
    localStorage.setItem(key, value);
  } catch {
    /* sin almacenamiento: vale mientras la pestaña siga abierta */
  }
  window.dispatchEvent(new Event(STORE_EVENT));
};
function useStored(key: string | null): string {
  return useSyncExternalStore(
    (cb) => {
      window.addEventListener(STORE_EVENT, cb);
      return () => window.removeEventListener(STORE_EVENT, cb);
    },
    () => (key ? readStore(key) : ""),
    () => "",
  );
}

type Presence = {
  peers: CampusPeer[];
  positions: React.RefObject<Map<string, PeerPosition>>;
  online: boolean;
  getPosition: () => PeerPosition | null;
  subscribeChat: (fn: (fromId: string, data: Uint8Array) => void) => () => void;
  publishChat: (text: string, toIds: string[]) => boolean;
};

export function useCampusChat(userId: string | null, presence: Presence, onBubble: (id: string, text: string) => void) {
  const { peers, positions, online, getPosition, subscribeChat, publishChat } = presence;
  const enabledKey = userId ? `aq:chat:${userId}` : null;
  const blockKey = userId ? `aq:chat-block:${userId}` : null;
  const enabled = useStored(enabledKey) === "1";
  const blockedRaw = useStored(blockKey);
  const blocked = useMemo<Record<string, string>>(() => {
    try {
      const v = JSON.parse(blockedRaw || "{}");
      return v && typeof v === "object" && !Array.isArray(v) ? v : {};
    } catch {
      return {};
    }
  }, [blockedRaw]);

  const [log, setLog] = useState<ChatLine[]>([]);
  const [hearers, setHearers] = useState<string[]>([]);
  const lineId = useRef(0);
  const sentAt = useRef<number[]>([]);

  // Los oyentes de LiveKit leen siempre lo último sin volver a suscribirse
  const live = useRef({ enabled, blocked, peers, onBubble });
  useEffect(() => {
    live.current = { enabled, blocked, peers, onBubble };
  }, [enabled, blocked, peers, onBubble]);

  const push = useCallback((line: Omit<ChatLine, "id">) => {
    setLog((l) => [...l, { ...line, id: ++lineId.current }].slice(-LOG_SIZE));
  }, []);

  /** Ids de quienes están cerca de mí ahora mismo (misma sala y dentro del radio). */
  const nearbyIds = useCallback(() => {
    const me = getPosition();
    if (!me) return [];
    const ids: string[] = [];
    for (const p of live.current.peers) {
      const pos = positions.current?.get(p.id);
      if (pos && isNearby(me, pos)) ids.push(p.id);
    }
    return ids;
  }, [getPosition, positions]);

  // Quién me escucha: se recalcula por intervalo (no por cuadro) y solo cambia el estado si cambia la lista
  useEffect(() => {
    if (!enabled || !online) return;
    const t = setInterval(() => {
      const names = nearbyIds().map((id) => live.current.peers.find((p) => p.id === id)?.name ?? "Alguien");
      setHearers((prev) => (prev.join("|") === names.join("|") ? prev : names));
    }, 500);
    return () => clearInterval(t);
  }, [enabled, online, nearbyIds]);

  // Recepción: se descarta lo que venga de lejos, de otra sala, de alguien bloqueado o con el chat apagado
  useEffect(() => {
    const decoder = new TextDecoder();
    return subscribeChat((fromId, data) => {
      const cur = live.current;
      if (!cur.enabled || cur.blocked[fromId]) return;
      const sender = cur.peers.find((p) => p.id === fromId);
      const me = getPosition();
      const pos = positions.current?.get(fromId);
      if (!sender || !me || !pos || !isNearby(me, pos, CHAT_RADIUS + CHAT_RADIUS_TOLERANCE)) return;
      let text: unknown;
      try {
        text = JSON.parse(decoder.decode(data))?.text;
      } catch {
        return;
      }
      const clean = prepareMessage(text);
      if (!clean.ok) return;
      push({ from: fromId, name: sender.name, text: clean.text });
      cur.onBubble(fromId, clean.text);
    });
  }, [subscribeChat, getPosition, positions, push]);

  const setEnabled = useCallback(
    (on: boolean) => {
      if (!enabledKey) return;
      writeStore(enabledKey, on ? "1" : "0");
      if (!on) {
        setLog([]);
        setHearers([]);
      }
    },
    [enabledKey],
  );

  /** Devuelve el motivo si no se pudo enviar, o null si salió bien. */
  const send = useCallback(
    (raw: string): string | null => {
      if (!enabled) return "Activa el chat para hablar con quien esté cerca";
      if (!online) return "Chat disponible solo en línea";
      const clean = prepareMessage(raw);
      if (!clean.ok) return clean.error;
      const limited = rateLimit(sentAt.current, Date.now());
      if (limited) return limited;
      if (!publishChat(clean.text, nearbyIds())) return "Sin conexión con el campus";
      push({ from: "me", name: "Tú", text: clean.text });
      live.current.onBubble("me", clean.text);
      return null;
    },
    [enabled, online, publishChat, nearbyIds, push],
  );

  const block = useCallback(
    (id: string, name: string) => {
      if (!blockKey) return;
      writeStore(blockKey, JSON.stringify({ ...live.current.blocked, [id]: name }));
      setLog((l) => l.filter((x) => x.from !== id));
    },
    [blockKey],
  );
  const unblock = useCallback(
    (id: string) => {
      if (!blockKey) return;
      const rest = { ...live.current.blocked };
      delete rest[id];
      writeStore(blockKey, JSON.stringify(rest));
    },
    [blockKey],
  );

  return { enabled, setEnabled, online, log, hearers, blocked, block, unblock, send };
}
