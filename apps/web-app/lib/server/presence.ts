// "¿Está conectado?": una clase solo avanza si el alumno está conectado de verdad.
// Dos señales, cualquiera basta: ser participante del campus en LiveKit (tiempo real) o haber
// consultado la API hace unos segundos (el campus consulta tus clases cada ~8 s). La segunda
// vive en memoria del servidor: sirve con un solo proceso y, con LiveKit, no hace falta.

import { RoomServiceClient } from "livekit-server-sdk";
import { CAMPUS_ROOM, livekitConfig } from "@/lib/server/livekit";

const FRESH_MS = 25_000;

// Sobrevive al hot reload del servidor de desarrollo
const g = globalThis as unknown as { __seen?: Map<string, number> };
const seen = (g.__seen ??= new Map<string, number>());

export function touchPresence(userId: string) {
  seen.set(userId, Date.now());
}

/** Quiénes de `ids` están conectados ahora mismo. */
export async function onlineAmong(ids: string[]): Promise<Set<string>> {
  const now = Date.now();
  const online = new Set(ids.filter((id) => (seen.get(id) ?? 0) > now - FRESH_MS));
  const cfg = livekitConfig();
  if (cfg) {
    // Sala del campus vacía o inexistente = nadie conectado
    const people = await new RoomServiceClient(cfg.url, cfg.key, cfg.secret).listParticipants(CAMPUS_ROOM).catch(() => []);
    for (const p of people) {
      const id = p.identity.startsWith("profile:") ? p.identity.slice("profile:".length) : "";
      if (ids.includes(id)) online.add(id);
    }
  }
  return online;
}
