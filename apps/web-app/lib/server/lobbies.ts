// Clases con tutor IA compartidas: un alumno abre un lobby con su tema (es el anfitrión), los que
// están conectados reciben la invitación y se unen, y el anfitrión decide cuándo empieza. El precio
// del tutor se reparte entre todos. Todo vive en la base (migración 005): sirve desde cualquier PC.

import { db, HttpError, must, rpc } from "@/lib/server/core";
import { aiTutors, membersOf, profilesById, topicsById } from "@/lib/server/data";
import { normalizeTopic } from "@/lib/server/topics";
import { uuidParam, type Body } from "@/lib/server/handlers";
import type { LobbyDetail, LobbyInvite } from "@/lib/api/client";
import type { Group } from "@/lib/types";

/** Una invitación caduca: nadie quiere unirse a un lobby abierto hace horas. */
const INVITE_TTL_MS = 30 * 60_000;
const MAX_MEMBERS = 5;

async function lobbyRow(groupId: string): Promise<Group> {
  const [g] = await must<Group[]>(db().from("groups").select("*").eq("id", groupId).limit(1));
  if (!g || !g.ai_tutor_id) throw new HttpError(404, "No encontramos esa clase compartida.", "not_found");
  return g;
}

export async function createAiLobby(userId: string, body: Body): Promise<{ groupId: string }> {
  const aiTutorId = uuidParam(body.aiTutorId as string, "tutor");
  const text = typeof body.text === "string" ? body.text.replace(/\s+/g, " ").trim() : "";
  if (text.length < 3 || text.length > 280) throw new HttpError(400, "Escribe el tema que quieres ver (de 3 a 280 caracteres).");
  const topic = await normalizeTopic(text, userId);
  const groupId = await rpc<string>("create_ai_lobby", { p_host_id: userId, p_ai_tutor_id: aiTutorId, p_topic_id: topic.id, p_detail: text });
  return { groupId };
}

export async function lobby(userId: string, id: string): Promise<LobbyDetail> {
  const g = await lobbyRow(uuidParam(id, "clase"));
  const [members, topics, ais, live] = await Promise.all([
    membersOf([g.id]),
    topicsById([g.topic_id]),
    aiTutors([g.ai_tutor_id!]),
    must<{ id: string }[]>(db().from("sessions").select("id").eq("group_id", g.id).eq("status", "live").limit(1)),
  ]);
  const list = members.get(g.id) ?? [];
  const isMember = list.some((m) => m.student_id === userId);
  // Ya empezada, la clase solo la ven sus miembros. Un grupo cancelado sí se muestra (vacío): así
  // quien esperaba ve que el anfitrión lo cerró, en vez de quedarse esperando.
  if ((g.status === "live" || g.status === "completed") && !isMember) {
    throw new HttpError(409, "Esta clase compartida ya empezó o terminó.", "conflict");
  }
  const people = await profilesById([...list.map((m) => m.student_id), g.host_id ?? ""]);
  const topic = topics.get(g.topic_id);
  if (!topic) throw new HttpError(404, "No encontramos el tema de esta clase.", "not_found");
  return {
    group: g,
    topic,
    aiTutor: ais[0] ?? null,
    host: g.host_id ? people.get(g.host_id) ?? null : null,
    members: list
      .map((m) => ({ profile: people.get(m.student_id)!, share: m.share_quipus, isHost: m.student_id === g.host_id }))
      .filter((m) => !!m.profile)
      .sort((a, b) => Number(b.isHost) - Number(a.isHost)),
    isMember,
    isHost: g.host_id === userId,
    shareIfJoin: isMember ? (list.find((m) => m.student_id === userId)?.share_quipus ?? 0) : Math.floor(g.total_price_quipus / (list.length + 1)),
    liveSessionId: live[0]?.id ?? null,
  };
}

export async function leaveLobby(userId: string, id: string): Promise<void> {
  await rpc("leave_ai_lobby", { p_student_id: userId, p_group_id: uuidParam(id, "clase") });
}

export async function startLobby(userId: string, id: string): Promise<{ sessionId: string }> {
  const sessionId = await rpc<string>("start_ai_lobby", { p_host_id: userId, p_group_id: uuidParam(id, "clase") });
  return { sessionId };
}

export async function openLobbies(userId: string): Promise<LobbyInvite[]> {
  const since = new Date(Date.now() - INVITE_TTL_MS).toISOString();
  const rows = await must<Group[]>(
    db()
      .from("groups")
      .select("*")
      .not("ai_tutor_id", "is", null)
      .eq("status", "forming")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(10),
  );
  if (!rows.length) return [];
  const members = await membersOf(rows.map((g) => g.id));
  const open = rows.filter((g) => {
    const list = members.get(g.id) ?? [];
    return list.length > 0 && list.length < MAX_MEMBERS && !list.some((m) => m.student_id === userId);
  });
  if (!open.length) return [];
  const [topics, people, ais] = await Promise.all([
    topicsById(open.map((g) => g.topic_id)),
    profilesById(open.map((g) => g.host_id ?? "")),
    aiTutors([...new Set(open.map((g) => g.ai_tutor_id!))]),
  ]);
  const aiById = new Map(ais.map((a) => [a.id, a]));
  return open
    .filter((g) => topics.has(g.topic_id))
    .map((g) => {
      const n = (members.get(g.id) ?? []).length;
      return {
        groupId: g.id,
        topic: topics.get(g.topic_id)!,
        detail: g.detail ?? null,
        host: g.host_id ? people.get(g.host_id) ?? null : null,
        aiTutor: aiById.get(g.ai_tutor_id!) ?? null,
        members: n,
        shareIfJoin: Math.floor(g.total_price_quipus / (n + 1)),
        createdAt: g.created_at,
      };
    });
}
