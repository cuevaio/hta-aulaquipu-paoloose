"use client";

// Campus multijugador: todos los que están en el campus comparten la sala LiveKit
// "aulaquipu-campus" y se mandan su posición por datos. Las posiciones viven en un ref
// (el mundo las lee 60 veces por segundo sin re-renderizar); la lista de quién está
// conectado sí es estado de React.

import { useCallback, useEffect, useRef, useState } from "react";
import { DisconnectReason, Room, RoomEvent, type RemoteParticipant } from "livekit-client";
import { api } from "@/lib/api";
import type { AvatarConfig, Equipped } from "@/lib/types";

const TOPIC = "campus:pos";
export const CHAT_TOPIC = "campus:chat";
const SEND_EVERY_MS = 100; // ~10 por segundo mientras camina
const HEARTBEAT_MS = 2000; // aunque esté quieto o en otra pestaña, para quien recién llega
// Sin latidos por este tiempo se le saca del mapa: LiveKit tarda ~20 s en notar una desconexión
// brusca (laptop suspendida, wifi caída) y mientras tanto quedaría "varado". Vuelve con su próximo latido.
const STALE_MS = 8000;

export interface CampusPeer {
  id: string; // profile id
  name: string;
  avatar: AvatarConfig;
  equipped: Equipped | null;
}

export interface PeerPosition {
  x: number;
  y: number;
  /** 1 mira a la derecha, -1 a la izquierda */
  f: number;
}

function peerFrom(p: RemoteParticipant): CampusPeer | null {
  if (!p.identity.startsWith("profile:")) return null;
  let meta: { name?: string; avatar?: AvatarConfig; equipped?: Equipped } = {};
  try {
    meta = JSON.parse(p.metadata || "{}");
  } catch {
    // metadata inválida: se muestra con aspecto por defecto
  }
  return {
    id: p.identity.slice("profile:".length),
    name: meta.name || p.name || "Alguien",
    avatar: meta.avatar ?? {},
    equipped: meta.equipped ?? null,
  };
}

const isPos = (v: unknown): v is PeerPosition =>
  !!v &&
  typeof v === "object" &&
  Number.isFinite((v as PeerPosition).x) &&
  Number.isFinite((v as PeerPosition).y) &&
  Math.abs((v as PeerPosition).x) < 1000 &&
  Math.abs((v as PeerPosition).y) < 1000;

export function useCampusPresence(userId: string | null) {
  const [peers, setPeers] = useState<CampusPeer[]>([]);
  const [online, setOnline] = useState(false);
  const positions = useRef(new Map<string, PeerPosition>());
  const lastSeen = useRef(new Map<string, number>());
  const room = useRef<Room | null>(null);
  const last = useRef<{ pos: PeerPosition | null; at: number; sent: PeerPosition | null }>({ pos: null, at: 0, sent: null });
  const encoder = useRef(new TextEncoder());
  // Quien quiera mensajes del chat se suscribe aquí: así comparte esta misma conexión LiveKit
  const chatListeners = useRef(new Set<(fromId: string, data: Uint8Array) => void>());

  const send = useCallback((pos: PeerPosition, reliable = false) => {
    const r = room.current;
    if (!r || r.state !== "connected") return;
    last.current.sent = pos;
    last.current.at = performance.now();
    const payload = encoder.current.encode(JSON.stringify({ x: +pos.x.toFixed(2), y: +pos.y.toFixed(2), f: pos.f }));
    // Al caminar: con pérdida (el siguiente corrige). Latidos y llegadas: confiable
    void r.localParticipant.publishData(payload, { reliable, topic: TOPIC }).catch(() => {});
  }, []);

  /** El mundo la llama en cada cuadro; aquí se decide cuándo vale la pena enviar. */
  const reportPosition = useCallback(
    (pos: PeerPosition) => {
      last.current.pos = pos;
      const s = last.current.sent;
      const elapsed = performance.now() - last.current.at;
      const moved = !s || Math.abs(s.x - pos.x) > 0.02 || Math.abs(s.y - pos.y) > 0.02 || s.f !== pos.f;
      if (moved && elapsed >= SEND_EVERY_MS) send(pos);
    },
    [send],
  );

  const getPosition = useCallback(() => last.current.pos, []);

  const subscribeChat = useCallback((fn: (fromId: string, data: Uint8Array) => void) => {
    chatListeners.current.add(fn);
    return () => void chatListeners.current.delete(fn);
  }, []);

  /** Envía un mensaje de chat solo a las identidades indicadas (ids de perfil). Devuelve false si no hay conexión. */
  const publishChat = useCallback((text: string, toIds: string[]) => {
    const r = room.current;
    if (!r || r.state !== "connected") return false;
    if (toIds.length === 0) return true;
    const payload = encoder.current.encode(JSON.stringify({ text, ts: Date.now() }));
    void r.localParticipant
      .publishData(payload, { reliable: true, topic: CHAT_TOPIC, destinationIdentities: toIds.map((id) => `profile:${id}`) })
      .catch(() => {});
    return true;
  }, []);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    const lkRoom = new Room({ adaptiveStream: false, dynacast: false });
    const decoder = new TextDecoder();
    const alive = (id: string) => performance.now() - (lastSeen.current.get(id) ?? 0) < STALE_MS;
    let shown = "";
    const livePeers = () =>
      [...lkRoom.remoteParticipants.values()]
        .map(peerFrom)
        .filter((p): p is CampusPeer => !!p && p.id !== userId && alive(p.id));
    const syncPeers = () => {
      const list = livePeers();
      shown = list.map((p) => p.id).join();
      setPeers(list);
    };
    // A quien ya estaba o recién entra se le da margen hasta su primer latido
    const greet = (p: RemoteParticipant) => lastSeen.current.set(p.identity.slice("profile:".length), performance.now());

    lkRoom
      .on(RoomEvent.ParticipantConnected, (p: RemoteParticipant) => {
        greet(p);
        syncPeers();
        // Quien recién llega debe vernos ya, sin esperar el latido
        if (last.current.pos) send(last.current.pos, true);
      })
      .on(RoomEvent.ParticipantDisconnected, (p: RemoteParticipant) => {
        const id = p.identity.slice("profile:".length);
        positions.current.delete(id);
        lastSeen.current.delete(id);
        syncPeers();
      })
      .on(RoomEvent.ParticipantMetadataChanged, syncPeers)
      .on(RoomEvent.DataReceived, (payload: Uint8Array, p?: RemoteParticipant, _k?: unknown, topic?: string) => {
        if (!p?.identity.startsWith("profile:")) return;
        if (topic === CHAT_TOPIC) {
          const from = p.identity.slice("profile:".length);
          chatListeners.current.forEach((fn) => fn(from, payload));
          return;
        }
        if (topic !== TOPIC) return;
        try {
          const msg = JSON.parse(decoder.decode(payload));
          if (!isPos(msg)) return;
          const id = p.identity.slice("profile:".length);
          const wasHidden = !alive(id);
          lastSeen.current.set(id, performance.now());
          positions.current.set(id, { x: msg.x, y: msg.y, f: msg.f === -1 ? -1 : 1 });
          if (wasHidden) syncPeers();
        } catch {
          // mensaje inválido: se ignora
        }
      })
      .on(RoomEvent.Disconnected, (reason?: DisconnectReason) => {
        setOnline(false);
        setPeers([]);
        positions.current.clear();
        lastSeen.current.clear();
        if (reason === DisconnectReason.DUPLICATE_IDENTITY) console.info("[campus] abriste el campus en otra pestaña");
      })
      .on(RoomEvent.Reconnected, () => setOnline(true));

    (async () => {
      const token = await api.campusToken(userId).catch(() => null);
      if (cancelled || !token) return;
      try {
        await lkRoom.connect(token.url, token.token);
      } catch {
        return; // sin campus compartido: el mapa sigue funcionando solo
      }
      if (cancelled) {
        lkRoom.disconnect();
        return;
      }
      room.current = lkRoom;
      setOnline(true);
      lkRoom.remoteParticipants.forEach(greet);
      syncPeers();
      if (last.current.pos) send(last.current.pos, true);
    })();

    // Latido con temporizador propio: el bucle de animación se pausa en pestañas en segundo plano
    // y de paso se retira a quien dejó de latir
    const heartbeat = setInterval(() => {
      if (last.current.pos) send(last.current.pos, true);
      for (const id of positions.current.keys()) if (!alive(id)) positions.current.delete(id);
      if (livePeers().map((p) => p.id).join() !== shown) syncPeers();
    }, HEARTBEAT_MS);

    return () => {
      cancelled = true;
      clearInterval(heartbeat);
      room.current = null;
      lkRoom.disconnect();
    };
  }, [userId, send]);

  return { peers, positions, online, reportPosition, getPosition, subscribeChat, publishChat };
}
