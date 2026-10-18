// Lecturas y mapeos de la base a los tipos del frontend (lib/types.ts).

import { db, HttpError, must, rpc } from "@/lib/server/core";
import { badgeIcon, isSpriteSkin } from "@/lib/skins";
import type {
  AiTutor,
  Badge,
  Equipped,
  Group,
  Profile,
  Session,
  SessionDetail,
  Skin,
  Topic,
  TutorStats,
} from "@/lib/types";

/** Columnas públicas del perfil: suspended_at/suspended_reason nunca salen de la API. */
export const PROFILE_COLUMNS = "id, username, display_name, grade, school, avatar_config, created_at";

export const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

// ---------- filas ----------

export interface TopicRow {
  id: string;
  name: string;
  proposed_by: string | null;
  status: "active" | "flagged";
}

export interface SessionRow {
  id: string;
  group_id: string | null;
  request_id: string | null;
  student_id: string | null;
  tutor_kind: "human" | "ai";
  tutor_id: string | null;
  ai_tutor_id: string | null;
  room_name: string;
  price_quipus: number;
  status: "live" | "completed" | "cancelled";
  started_at: string;
  ended_at: string | null;
  topic_id: string | null;
  doc_markdown: string;
}

interface AiRow {
  id: string;
  name: string;
  persona: Record<string, unknown>;
  price_quipus: number;
  /** Falta si la migración 003 aún no se aplicó: se trata como activo. */
  active?: boolean;
}

// ---------- mapeos ----------

export const toTopic = (t: TopicRow): Topic => ({ id: t.id, name: cap(t.name), proposed_by: t.proposed_by, status: t.status });

const UNKNOWN_TOPIC: Topic = { id: "", name: "Tema libre", proposed_by: null, status: "active" };

export function toAi(a: AiRow): AiTutor {
  const p = a.persona ?? {};
  const str = (k: string) => (typeof p[k] === "string" ? (p[k] as string) : "");
  return {
    id: a.id,
    name: a.name,
    price_quipus: a.price_quipus,
    persona: {
      emoji: str("emoji") || "🤖",
      color: str("color") || "#7C6BF2",
      tagline: str("tagline") || (str("focus") ? `Tutor de ${str("focus")}` : "Tutor IA"),
      style: str("style"),
      voice: str("voice"),
    },
  };
}

// ---------- cargadores ----------

export async function profilesById(ids: string[]): Promise<Map<string, Profile>> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return new Map();
  const rows = await must<Profile[]>(db().from("profiles").select(PROFILE_COLUMNS).in("id", unique));
  return new Map(rows.map((p) => [p.id, p]));
}

export async function profileOf(id: string): Promise<Profile> {
  const p = (await profilesById([id])).get(id);
  if (!p) throw new HttpError(404, "No encontramos ese perfil.", "not_found");
  return p;
}

export async function topicsById(ids: (string | null)[]): Promise<Map<string, Topic>> {
  const unique = [...new Set(ids.filter((x): x is string => !!x))];
  if (!unique.length) return new Map();
  const rows = await must<TopicRow[]>(db().from("topics").select("*").in("id", unique));
  return new Map(rows.map((t) => [t.id, toTopic(t)]));
}

export async function topicOf(id: string | null): Promise<Topic> {
  if (!id) return UNKNOWN_TOPIC;
  return (await topicsById([id])).get(id) ?? UNKNOWN_TOPIC;
}

/** `onlyActive` deja fuera a los tutores pausados (listados); sin él se incluyen (clases ya reservadas). */
export async function aiTutors(ids?: string[], opts: { onlyActive?: boolean } = {}): Promise<AiTutor[]> {
  let q = db().from("ai_tutors").select("*").order("name");
  if (ids) q = q.in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
  const rows = await must<AiRow[]>(q);
  return rows.filter((r) => !opts.onlyActive || r.active !== false).map(toAi);
}

export async function equippedFor(ids: string[]): Promise<Map<string, Equipped>> {
  const unique = [...new Set(ids.filter(Boolean))];
  const out = new Map<string, Equipped>(unique.map((id) => [id, { avatar: null, frame: null, deco: null }]));
  if (!unique.length) return out;
  const rows = await must<{ profile_id: string; skin: Skin | null }[]>(
    db().from("profile_skins").select("profile_id, skin:skins(*)").in("profile_id", unique).eq("equipped", true),
  );
  for (const r of rows) {
    const e = out.get(r.profile_id);
    // Los ítems de sprite son de otro sistema de avatar: no pisan el color ni el diseño
    if (!e || !r.skin || isSpriteSkin(r.skin.meta)) continue;
    if (r.skin.kind === "avatar") e.avatar = r.skin;
    if (r.skin.kind === "frame") e.frame = r.skin;
    if (r.skin.kind === "profile_deco") e.deco = r.skin;
    if (r.skin.kind === "head") e.head = r.skin;
  }
  return out;
}

export async function statsFor(ids: string[]): Promise<Map<string, TutorStats>> {
  const unique = [...new Set(ids.filter(Boolean))];
  const out = new Map<string, TutorStats>(unique.map((id) => [id, { estrellas_promedio: 0, sesiones_completadas: 0 }]));
  if (!unique.length) return out;
  const rows = await must<{ tutor_id: string; estrellas_promedio: number | string; sesiones_completadas: number | string }[]>(
    db().from("tutor_stats").select("*").in("tutor_id", unique),
  );
  for (const r of rows)
    out.set(r.tutor_id, {
      estrellas_promedio: Math.round(Number(r.estrellas_promedio) * 10) / 10,
      sesiones_completadas: Number(r.sesiones_completadas),
    });
  return out;
}

export async function balanceOf(id: string): Promise<number> {
  return Number(await rpc<number>("get_balance", { p_profile_id: id }));
}

export async function availableOf(id: string): Promise<number> {
  return Number(await rpc<number>("available_balance", { p_profile_id: id }));
}

/** Grupos donde el perfil es alumno activo. */
export async function myGroupIds(id: string): Promise<string[]> {
  const rows = await must<{ group_id: string }[]>(
    db().from("group_members").select("group_id").eq("student_id", id).eq("status", "joined"),
  );
  return rows.map((r) => r.group_id);
}

export async function membersOf(groupIds: string[]): Promise<Map<string, { student_id: string; share_quipus: number }[]>> {
  const out = new Map<string, { student_id: string; share_quipus: number }[]>(groupIds.map((g) => [g, []]));
  if (!groupIds.length) return out;
  const rows = await must<{ group_id: string; student_id: string; share_quipus: number }[]>(
    db().from("group_members").select("group_id, student_id, share_quipus").in("group_id", groupIds).eq("status", "joined"),
  );
  for (const r of rows) out.get(r.group_id)?.push({ student_id: r.student_id, share_quipus: r.share_quipus });
  return out;
}

export async function badgesOf(id: string, stats: TutorStats, balance: number): Promise<Badge[]> {
  const groups = await myGroupIds(id);
  const learnedFilters = [`student_id.eq.${id}`];
  if (groups.length) learnedFilters.push(`group_id.in.(${groups.join(",")})`);
  const [{ count: learned }, reviews, ownedBadges] = await Promise.all([
    db().from("sessions").select("id", { count: "exact", head: true }).eq("status", "completed").or(learnedFilters.join(",")),
    must<{ stars: number }[]>(db().from("reviews").select("stars").eq("tutor_id", id)),
    must<{ skin: Skin | null }[]>(db().from("profile_skins").select("skin:skins(*)").eq("profile_id", id)),
  ]);
  const out: Badge[] = [];
  if (stats.sesiones_completadas >= 1)
    out.push({ id: "primer-tutor", name: "Primer tutor", emoji: "🎓", description: "Diste tu primera clase" });
  if (stats.sesiones_completadas >= 10)
    out.push({ id: "diez-sesiones", name: "10 sesiones enseñadas", emoji: "🏆", description: "Diez clases dadas" });
  if ((learned ?? 0) >= 1)
    out.push({ id: "aprendiz", name: "Aprendiz curioso", emoji: "🔍", description: "Tomaste tu primera clase" });
  if (reviews.length >= 2 && stats.estrellas_promedio >= 4.5)
    out.push({ id: "estrella", name: "Estrella del aula", emoji: "⭐", description: "Promedio de 4.5 o más" });
  if (balance >= 150)
    out.push({ id: "ahorrador", name: "Buen administrador", emoji: "🪢", description: "Juntaste 150 quipus o más" });
  for (const { skin } of ownedBadges)
    if (skin?.kind === "badge")
      out.push({ id: skin.id, name: skin.name, emoji: badgeIcon(skin.meta), description: "Insignia de prestigio" });
  return out;
}

// ---------- sesiones ----------

export async function sessionRow(id: string): Promise<SessionRow> {
  const rows = await must<SessionRow[]>(db().from("sessions").select("*").eq("id", id).limit(1));
  if (!rows.length) throw new HttpError(404, "No encontramos esa clase.", "not_found");
  return rows[0];
}

export async function studentsOf(s: SessionRow): Promise<string[]> {
  if (s.student_id) return [s.student_id];
  if (s.group_id) return ((await membersOf([s.group_id])).get(s.group_id) ?? []).map((m) => m.student_id);
  return [];
}

/** Solo tutor y alumnos de la clase pueden verla, entrar o cerrarla. */
export async function requireParticipant(s: SessionRow, userId: string): Promise<{ students: string[]; isTutor: boolean }> {
  const students = await studentsOf(s);
  const isTutor = s.tutor_id === userId;
  if (!isTutor && !students.includes(userId)) throw new HttpError(404, "No encontramos esa clase.", "not_found");
  return { students, isTutor };
}

export function toSession(s: SessionRow, students: string[]): Session {
  return {
    id: s.id,
    group_id: s.group_id,
    request_id: s.request_id,
    tutor_kind: s.tutor_kind,
    tutor_id: s.tutor_id,
    ai_tutor_id: s.ai_tutor_id,
    room_name: s.room_name,
    price_quipus: s.price_quipus,
    status: s.status,
    started_at: s.started_at,
    ended_at: s.ended_at,
    topic_id: s.topic_id ?? "",
    student_ids: students,
    doc_markdown: s.doc_markdown ?? "",
  };
}

export async function sessionDetails(rows: SessionRow[], userId: string): Promise<SessionDetail[]> {
  if (!rows.length) return [];
  const groupIds = rows.map((r) => r.group_id).filter((x): x is string => !!x);
  const members = await membersOf([...new Set(groupIds)]);
  const studentsBySession = new Map(
    rows.map((r) => [r.id, r.student_id ? [r.student_id] : r.group_id ? (members.get(r.group_id) ?? []).map((m) => m.student_id) : []]),
  );
  const peopleIds = rows.flatMap((r) => [...(studentsBySession.get(r.id) ?? []), r.tutor_id ?? ""]);
  const [profiles, equipped, topics, ais, myReviews] = await Promise.all([
    profilesById(peopleIds),
    equippedFor(peopleIds),
    topicsById(rows.map((r) => r.topic_id)),
    aiTutors([...new Set(rows.map((r) => r.ai_tutor_id).filter((x): x is string => !!x))]),
    must<{ id: string; session_id: string; reviewer_id: string; tutor_id: string | null; ai_tutor_id: string | null; stars: number; feedback_private: string | null; created_at: string }[]>(
      db().from("reviews").select("*").eq("reviewer_id", userId).in("session_id", rows.map((r) => r.id)),
    ),
  ]);
  const aiById = new Map(ais.map((a) => [a.id, a]));
  return rows.map((r) => {
    const students = studentsBySession.get(r.id) ?? [];
    return {
      session: toSession(r, students),
      topic: (r.topic_id && topics.get(r.topic_id)) || UNKNOWN_TOPIC,
      tutor: r.tutor_id ? profiles.get(r.tutor_id) ?? null : null,
      aiTutor: r.ai_tutor_id ? aiById.get(r.ai_tutor_id) ?? null : null,
      students: students
        .map((id) => profiles.get(id))
        .filter((p): p is Profile => !!p)
        .map((p) => ({ ...p, equipped: equipped.get(p.id) ?? { avatar: null, frame: null, deco: null } })),
      tutorEquipped: r.tutor_id ? equipped.get(r.tutor_id) ?? null : null,
      myReview: myReviews.find((x) => x.session_id === r.id) ?? null,
    };
  });
}

export type GroupRow = Group;
