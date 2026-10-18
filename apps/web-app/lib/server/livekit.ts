// Tokens de LiveKit (§11.4: expiran en 10 min) y despacho del agente tutor IA.
// El agente se registra con agentName "aulaquipu-tutor" (despacho explícito): se pide por API
// cada vez que un alumno entra a una clase IA sin agente. createDispatch crea la sala si no
// existe. (En LiveKit Cloud una sala vacía sigue en listRooms unos minutos aunque ya no tenga
// participantes, así que no se puede decidir solo por si "existe".)

import { AccessToken, AgentDispatchClient, RoomServiceClient } from "livekit-server-sdk";
import { env } from "@/lib/server/core";

export const AGENT_NAME = "aulaquipu-tutor";
const PARTICIPANT_KIND_AGENT = 4; // ParticipantInfo.Kind.AGENT en el protocolo de LiveKit
const DISPATCH_GRACE_MS = 20_000;

export function livekitConfig() {
  const url = env("LIVEKIT_URL");
  const key = env("LIVEKIT_API_KEY");
  const secret = env("LIVEKIT_API_SECRET");
  if (!url || !key || !secret) return null;
  // El navegador puede necesitar otra URL que el servidor (p. ej. wss:// del túnel público)
  return { url, publicUrl: env("LIVEKIT_PUBLIC_URL") ?? url, key, secret };
}

export interface AgentContext {
  sessionId: string;
  tutorName: string;
  style: string;
  focus: string;
  topic: string;
  studentName: string;
}

export async function createRoomToken(opts: {
  identity: string;
  name: string;
  room: string;
  agent: AgentContext | null;
}): Promise<{ url: string; token: string } | null> {
  const cfg = livekitConfig();
  if (!cfg) return null;

  const at = new AccessToken(cfg.key, cfg.secret, { identity: opts.identity, name: opts.name, ttl: "10m" });
  at.addGrant({ roomJoin: true, room: opts.room, canPublish: true, canSubscribe: true, canPublishData: true });

  if (opts.agent) {
    const metadata = JSON.stringify(opts.agent);
    await ensureAgent(cfg, opts.room, metadata).catch((err) => console.warn("[livekit] no se pudo despachar el agente", err));
  }
  return { url: cfg.publicUrl, token: await at.toJwt() };
}

export const CAMPUS_ROOM = "aulaquipu-campus";

/**
 * Token para el campus 2D compartido: solo datos (posiciones), sin audio ni video.
 * El aspecto del avatar va en la metadata del participante, puesta por el servidor.
 */
export async function createCampusToken(opts: { identity: string; name: string; metadata: string }) {
  const cfg = livekitConfig();
  if (!cfg) return null;
  const at = new AccessToken(cfg.key, cfg.secret, {
    identity: opts.identity,
    name: opts.name,
    metadata: opts.metadata,
    ttl: "10m",
  });
  at.addGrant({
    roomJoin: true,
    room: CAMPUS_ROOM,
    canPublish: false,
    canSubscribe: true,
    canPublishData: true,
    canUpdateOwnMetadata: false,
  });
  return { url: cfg.publicUrl, token: await at.toJwt() };
}

/** El protocolo no documenta la unidad de created_at: se deduce por magnitud (s, ms, µs o ns). */
function epochToMs(v: number): number {
  if (v > 1e17) return v / 1e6;
  if (v > 1e14) return v / 1e3;
  if (v > 1e11) return v;
  return v * 1e3;
}

// Un despacho a la vez por sala dentro de este servidor: dos tokens simultáneos no duplican al agente
const inFlight = new Map<string, Promise<void>>();

function ensureAgent(cfg: NonNullable<ReturnType<typeof livekitConfig>>, room: string, metadata: string): Promise<void> {
  const prev = inFlight.get(room) ?? Promise.resolve();
  const next = prev.then(() => dispatchIfMissing(cfg, room, metadata));
  const tracked = next.finally(() => {
    if (inFlight.get(room) === tracked) inFlight.delete(room);
  });
  inFlight.set(room, tracked);
  return next;
}

async function dispatchIfMissing(cfg: NonNullable<ReturnType<typeof livekitConfig>>, room: string, metadata: string) {
  const rooms = new RoomServiceClient(cfg.url, cfg.key, cfg.secret);
  // "requested room does not exist" = no hay nadie: se trata como sala vacía
  const participants = await rooms.listParticipants(room).catch(() => []);
  const isAgent = (p: { kind: unknown }) => Number(p.kind) === PARTICIPANT_KIND_AGENT;
  // El agente se apaga cuando su alumno se va: uno que está SOLO en la sala se está yendo
  if (participants.some(isAgent) && participants.some((p) => !isAgent(p))) return;

  const dispatcher = new AgentDispatchClient(cfg.url, cfg.key, cfg.secret);
  const dispatches = (await dispatcher.listDispatch(room).catch(() => [])).filter((d) => d.agentName === AGENT_NAME);
  const now = Date.now();
  // Un despacho recién pedido (p. ej. por el token anterior) está en camino: no duplicar
  if (dispatches.some((d) => now - epochToMs(Number(d.state?.createdAt ?? 0)) < DISPATCH_GRACE_MS)) return;
  // Los viejos (agente que se va o que nunca llegó) se cancelan y se pide uno nuevo
  for (const d of dispatches) await dispatcher.deleteDispatch(d.id, room).catch(() => {});
  await dispatcher.createDispatch(room, AGENT_NAME, { metadata });
}

/** Al terminar la clase se cierra la sala: desconecta a todos, incluido el agente. */
export async function closeRoom(room: string) {
  const cfg = livekitConfig();
  if (!cfg) return;
  await new RoomServiceClient(cfg.url, cfg.key, cfg.secret).deleteRoom(room).catch(() => {});
}
