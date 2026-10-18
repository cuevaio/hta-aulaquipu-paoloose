// Endpoints de la API (§9). Cada handler recibe el usuario autenticado por cookie;
// nunca confía en un id de usuario enviado por el navegador.

import { db, env, HttpError, isMissingSchema, must, rpc } from "@/lib/server/core";
import {
  aiTutors,
  PROFILE_COLUMNS,
  availableOf,
  badgesOf,
  balanceOf,
  equippedFor,
  membersOf,
  myGroupIds,
  profileOf,
  profilesById,
  requireParticipant,
  sessionDetails,
  sessionRow,
  statsFor,
  toTopic,
  topicOf,
  topicsById,
  type SessionRow,
  type TopicRow,
} from "@/lib/server/data";
import { applyPromos } from "@/lib/server/promos";
import { agentGuideFor, isAdmin, requireNotSuspended } from "@/lib/server/admin";
import { normalizeTopic } from "@/lib/server/topics";
import { sanitizeAvatar } from "@/lib/avatar-catalog";
import { isSpriteSkin, spriteSlot } from "@/lib/skins";
import { closeRoom, createCampusToken, createRoomToken } from "@/lib/server/livekit";
import type {
  Group,
  IncomingRequest,
  LearningRequest,
  LedgerLine,
  Level,
  MatchOptions,
  Me,
  PrivateReview,
  Profile,
  PublicProfile,
  Skin,
  TutorOption,
  TutorPanel,
} from "@/lib/types";
import type { BookingResult, EndResult, RoomToken, TestAccount, UpcomingClass } from "@/lib/api/client";

export const TEST_PASSWORD = "aula2026";

// ---------- validación de entrada ----------

export type Body = Record<string, unknown>;

export const isUuid = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

export function uuidParam(v: string | undefined, what = "recurso"): string {
  if (!isUuid(v)) throw new HttpError(404, `No encontramos ese ${what}.`, "not_found");
  return v;
}

export function str(body: Body, key: string, { max = 500, min = 0 } = {}): string {
  const v = body[key];
  if (typeof v !== "string") throw new HttpError(400, `Falta el campo "${key}".`);
  const t = v.trim();
  if (t.length < min) throw new HttpError(400, `El campo "${key}" es muy corto.`);
  if (t.length > max) throw new HttpError(400, `El campo "${key}" es muy largo.`);
  return t;
}

export function optionalIso(body: Body, key: string): string | null {
  const v = body[key];
  if (v === null || v === undefined || v === "") return null;
  if (typeof v !== "string" || Number.isNaN(Date.parse(v))) throw new HttpError(400, "Fecha inválida.");
  return new Date(v).toISOString();
}

const LEVELS: Level[] = ["basico", "intermedio", "avanzado"];
const SLOT = /^(Lun|Mar|Mié|Jue|Vie|Sáb|Dom) \d{2}:\d{2}$/;

// ---------- auth ----------

const loginAttempts = new Map<string, { count: number; until: number }>();

export async function login(body: Body, ip: string): Promise<{ userId: string }> {
  const now = Date.now();
  const a = loginAttempts.get(ip);
  if (a && a.until > now && a.count >= 10) {
    throw new HttpError(429, "Demasiados intentos. Espera unos minutos.", "forbidden");
  }
  const dni = str(body, "dni", { max: 8 });
  const password = str(body, "password", { max: 200 });
  if (!/^\d{8}$/.test(dni)) throw new HttpError(400, "El DNI tiene 8 dígitos.");
  const userId = await rpc<string | null>("login", { p_dni: dni, p_password: password });
  if (!userId) {
    const next = a && a.until > now ? { count: a.count + 1, until: a.until } : { count: 1, until: now + 5 * 60_000 };
    loginAttempts.set(ip, next);
    throw new HttpError(401, "DNI o contraseña incorrectos.", "unauthorized");
  }
  await requireNotSuspended(userId);
  loginAttempts.delete(ip);
  return { userId };
}

export async function testAccounts(): Promise<TestAccount[]> {
  if (env("AULAQUIPU_SHOW_TEST_ACCOUNTS") === "false") return [];
  const rows = await must<{ dni: string; profile_id: string }[]>(
    db().from("credentials").select("dni, profile_id").eq("is_test", true).order("dni"),
  );
  const profiles = await profilesById(rows.map((r) => r.profile_id));
  return rows
    .filter((r) => profiles.has(r.profile_id))
    .map((r) => ({ dni: r.dni, password: TEST_PASSWORD, profile: profiles.get(r.profile_id)! }));
}

// ---------- perfil ----------

async function skinsFor(userId: string): Promise<(Skin & { owned: boolean; equipped: boolean })[]> {
  const [catalog, owned] = await Promise.all([
    // El volcado de sprites (cientos de ítems "avatar" con meta.sprite) no se vende aquí y llenaba el
    // tope de 1000 filas de PostgREST, dejando fuera marcos, fondos, insignias y cabezas.
    must<Skin[]>(db().from("skins").select("*").or("kind.neq.avatar,meta->>sprite.is.null").order("kind").order("price_quipus")),
    must<{ skin_id: string; equipped: boolean }[]>(db().from("profile_skins").select("skin_id, equipped").eq("profile_id", userId)),
  ]);
  const mine = new Map(owned.map((o) => [o.skin_id, o.equipped]));
  // Las skins gratis son de todos aunque no tengan fila en profile_skins.
  // Las ocultas por el admin dejan de venderse, pero quien ya las tiene las conserva.
  return catalog.filter((k) => k.active !== false || mine.has(k.id)).map((k) => ({ ...k, owned: mine.has(k.id) || k.price_quipus === 0, equipped: mine.get(k.id) ?? false }));
}

export async function me(userId: string): Promise<Me> {
  const [profile, balance, available, skins, equipped, stats, admin] = await Promise.all([
    profileOf(userId),
    balanceOf(userId),
    availableOf(userId),
    skinsFor(userId),
    equippedFor([userId]),
    statsFor([userId]),
    isAdmin(userId),
  ]);
  const st = stats.get(userId)!;
  return {
    profile,
    balance,
    available,
    skins,
    equipped: equipped.get(userId)!,
    badges: await badgesOf(userId, st, balance),
    stats: st,
    is_admin: admin,
  };
}

export async function demoUsers(): Promise<Profile[]> {
  return must<Profile[]>(db().from("profiles").select(PROFILE_COLUMNS).order("display_name"));
}

// ---------- temas y pedidos ----------

export async function searchTopics(query: string) {
  let q = db().from("topics").select("*").eq("status", "active").order("name");
  const clean = query.trim().replace(/[\\%_]/g, (c) => `\\${c}`);
  if (clean) q = q.ilike("name", `%${clean}%`);
  return (await must<TopicRow[]>(q)).map(toTopic);
}

export async function createRequest(userId: string, body: Body) {
  const text = str(body, "text", { min: 3, max: 280 });
  const mode = body.mode === "individual" ? "individual" : "grupo";
  const preferredAt = optionalIso(body, "preferredAt");
  const topic = await normalizeTopic(text, userId);
  const row = await must<{ id: string }>(
    db()
      .from("requests")
      .insert({ student_id: userId, topic_id: topic.id, detail: text, mode, preferred_at: preferredAt })
      .select("id")
      .single(),
  );
  return { requestId: row.id };
}

export async function myRequests(userId: string) {
  const rows = await must<LearningRequest[]>(
    db().from("requests").select("*").eq("student_id", userId).neq("status", "cancelled").order("created_at", { ascending: false }).limit(30),
  );
  const topics = await topicsById(rows.map((r) => r.topic_id));
  return rows.map((r) => ({ ...r, topic: topics.get(r.topic_id)! })).filter((r) => r.topic);
}

export async function cancelRequest(userId: string, id: string) {
  await must(db().from("requests").update({ status: "cancelled" }).eq("id", uuidParam(id, "pedido")).eq("student_id", userId).eq("status", "open"));
}

export async function openRequestsFeed(userId: string): Promise<IncomingRequest[]> {
  const rows = await must<LearningRequest[]>(
    db().from("requests").select("*").eq("status", "open").neq("student_id", userId).order("created_at", { ascending: false }).limit(6),
  );
  return withPeople(rows);
}

async function withPeople(rows: LearningRequest[]): Promise<IncomingRequest[]> {
  const [profiles, topics] = await Promise.all([profilesById(rows.map((r) => r.student_id)), topicsById(rows.map((r) => r.topic_id))]);
  return rows
    .filter((r) => profiles.has(r.student_id) && topics.has(r.topic_id))
    .map((r) => ({ request: r, student: profiles.get(r.student_id)!, topic: topics.get(r.topic_id)! }));
}

// ---------- matching ----------

async function tutorOptions(tutorIds: string[], topicId: string): Promise<Map<string, TutorOption>> {
  if (!tutorIds.length) return new Map();
  const [profiles, equipped, stats, levels, settings] = await Promise.all([
    profilesById(tutorIds),
    equippedFor(tutorIds),
    statsFor(tutorIds),
    must<{ tutor_id: string; level: Level }[]>(db().from("tutor_topics").select("tutor_id, level").eq("topic_id", topicId).in("tutor_id", tutorIds)),
    must<{ tutor_id: string; group_price_quipus: number }[]>(db().from("tutor_settings").select("tutor_id, group_price_quipus").in("tutor_id", tutorIds)),
  ]);
  const out = new Map<string, TutorOption>();
  for (const id of tutorIds) {
    const profile = profiles.get(id);
    if (!profile) continue;
    out.set(id, {
      profile,
      equipped: equipped.get(id)!,
      stats: stats.get(id)!,
      level: levels.find((l) => l.tutor_id === id)?.level ?? "basico",
      group_price_quipus: settings.find((s) => s.tutor_id === id)?.group_price_quipus ?? 20,
    });
  }
  return out;
}

export async function match(userId: string, requestId: string): Promise<MatchOptions> {
  const rows = await must<LearningRequest[]>(
    db().from("requests").select("*").eq("id", uuidParam(requestId, "pedido")).eq("student_id", userId).limit(1),
  );
  if (!rows.length) throw new HttpError(404, "No encontramos ese pedido.", "not_found");
  const request = rows[0];
  const topicRows = await must<TopicRow[]>(db().from("topics").select("*").eq("id", request.topic_id).limit(1));
  const topic = toTopic(topicRows[0]);

  const [forming, teacherRows, aiRows] = await Promise.all([
    request.mode === "grupo"
      ? must<Group[]>(db().from("groups").select("*").eq("topic_id", topic.id).eq("status", "forming").not("tutor_id", "is", null))
      : Promise.resolve([] as Group[]),
    must<{ tutor_id: string }[]>(db().from("tutor_topics").select("tutor_id").eq("topic_id", topic.id).neq("tutor_id", userId)),
    must<{ ai_tutor_id: string }[]>(db().from("ai_tutor_topics").select("ai_tutor_id").eq("topic_id", topic.id)),
  ]);

  const members = await membersOf(forming.map((g) => g.id));
  const openGroups = forming.filter((g) => {
    const m = members.get(g.id) ?? [];
    return g.tutor_id !== userId && m.length < 5 && !m.some((x) => x.student_id === userId);
  });
  const tutorIds = [...new Set([...teacherRows.map((t) => t.tutor_id), ...openGroups.map((g) => g.tutor_id!)])];
  const [options, memberProfiles] = await Promise.all([
    tutorOptions(tutorIds, topic.id),
    profilesById(openGroups.flatMap((g) => (members.get(g.id) ?? []).map((m) => m.student_id))),
  ]);

  const tutors = teacherRows
    .map((t) => options.get(t.tutor_id))
    .filter((t): t is TutorOption => !!t)
    .sort(
      (a, b) =>
        b.stats.estrellas_promedio - a.stats.estrellas_promedio || b.stats.sesiones_completadas - a.stats.sesiones_completadas,
    );

  // Los de este tema primero; si no hay (o están en pausa), los demás activos
  const assigned = aiRows.length ? await aiTutors(aiRows.map((a) => a.ai_tutor_id), { onlyActive: true }) : [];
  const ais = await applyPromos(userId, assigned.length ? assigned : await aiTutors(undefined, { onlyActive: true }));

  return {
    request,
    topic,
    topicWasCreated: topicRows[0].proposed_by === userId,
    groups: openGroups.map((g) => {
      const m = members.get(g.id) ?? [];
      return {
        group: g,
        members: m.map((x) => memberProfiles.get(x.student_id)).filter((p): p is Profile => !!p),
        tutor: g.tutor_id ? options.get(g.tutor_id) ?? null : null,
        share_quipus: Math.floor(g.total_price_quipus / (m.length + 1)),
      };
    }),
    tutors,
    aiTutors: ais,
  };
}

export const listAiTutors = async (userId: string) => applyPromos(userId, await aiTutors(undefined, { onlyActive: true }));

// ---------- reservas y sesiones ----------

async function scheduledAt(groupId: string): Promise<string | null> {
  const rows = await must<{ scheduled_at: string | null }[]>(db().from("groups").select("scheduled_at").eq("id", groupId).limit(1));
  return rows[0]?.scheduled_at ?? null;
}

export async function book(userId: string, body: Body): Promise<BookingResult> {
  if (body.kind === "ai") {
    const sessionId = await rpc<string>("book_ai", {
      p_student_id: userId,
      p_ai_tutor_id: uuidParam(body.aiTutorId as string, "tutor"),
      p_request_id: body.requestId ? uuidParam(body.requestId as string, "pedido") : null,
    });
    return { sessionId, groupId: null, scheduledAt: null };
  }
  if (body.kind === "human") {
    const groupId = await rpc<string>("book_human", {
      p_student_id: userId,
      p_tutor_id: uuidParam(body.tutorId as string, "tutor"),
      p_request_id: uuidParam(body.requestId as string, "pedido"),
    });
    return { sessionId: null, groupId, scheduledAt: await scheduledAt(groupId) };
  }
  if (body.kind === "group") {
    const groupId = await rpc<string>("join_group", { p_student_id: userId, p_group_id: uuidParam(body.groupId as string, "grupo") });
    return { sessionId: null, groupId, scheduledAt: await scheduledAt(groupId) };
  }
  throw new HttpError(400, "Tipo de reserva inválido.");
}

export async function startGroupSession(userId: string, groupId: string) {
  const sessionId = await rpc<string>("start_group_session", { p_profile_id: userId, p_group_id: uuidParam(groupId, "grupo") });
  return { sessionId };
}

export async function session(userId: string, id: string) {
  const row = await sessionRow(uuidParam(id, "clase"));
  await requireParticipant(row, userId);
  return (await sessionDetails([row], userId))[0];
}

async function logEvent(sessionId: string, actor: string, kind: string, payload: Record<string, unknown>) {
  const { error } = await db().from("session_events").insert({ session_id: sessionId, actor, kind, payload });
  if (error) console.warn("[api] no se pudo registrar session_event", error.message);
}

export async function roomToken(userId: string, id: string): Promise<RoomToken> {
  const row = await sessionRow(uuidParam(id, "clase"));
  await requireParticipant(row, userId);
  if (row.status !== "live") throw new HttpError(409, "Esta clase ya terminó.", "conflict");
  const profile = await profileOf(userId);
  const firstName = profile.display_name.split(" ")[0];

  let agent = null;
  if (row.tutor_kind === "ai" && row.ai_tutor_id) {
    const [tutor] = await aiTutors([row.ai_tutor_id]);
    const topic = await topicOf(row.topic_id);
    const persona = await must<{ persona: Record<string, string> }[]>(db().from("ai_tutors").select("persona").eq("id", row.ai_tutor_id));
    const guide = await agentGuideFor(row.topic_id);
    agent = {
      sessionId: row.id,
      tutorName: tutor?.name ?? "Quipu",
      style: persona[0]?.persona?.style ?? "",
      focus: persona[0]?.persona?.focus ?? "",
      topic: topic.id ? topic.name.toLowerCase() : "",
      ...(topic.id ? { topicId: topic.id } : {}),
      studentName: firstName,
      ...(guide ? { guide } : {}),
      studentId: userId,
    };
  }

  const lk = await createRoomToken({ identity: `profile:${userId}`, name: firstName, room: row.room_name, agent });
  await logEvent(row.id, `profile:${userId}`, "join", { name: firstName, realtime: !!lk });
  return { livekitUrl: lk?.url ?? null, token: lk?.token ?? null, yjsUrl: null, docName: row.room_name };
}

export async function saveSessionDoc(userId: string, id: string, body: Body) {
  const row = await sessionRow(uuidParam(id, "clase"));
  await requireParticipant(row, userId);
  if (row.status !== "live") return;
  const markdown = typeof body.markdown === "string" ? body.markdown : "";
  if (markdown.length > 200_000) throw new HttpError(413, "El documento es demasiado largo.");
  await must(db().from("sessions").update({ doc_markdown: markdown }).eq("id", row.id).eq("status", "live"));
}

export async function endSession(userId: string, id: string): Promise<EndResult> {
  const row = await sessionRow(uuidParam(id, "clase"));
  await requireParticipant(row, userId);
  const wasLive = row.status === "live";
  if (wasLive) {
    await rpc("end_session", { p_session_id: row.id });
    await logEvent(row.id, `profile:${userId}`, "completed", {});
    await closeRoom(row.room_name);
  }
  const moves = await must<{ from_profile: string | null; to_profile: string | null; amount: number }[]>(
    db().from("quipus_ledger").select("from_profile, to_profile, amount").eq("session_id", row.id),
  );
  return {
    alreadyEnded: !wasLive,
    paid: moves.filter((m) => m.from_profile === userId).reduce((a, m) => a + Number(m.amount), 0),
    earned: moves.filter((m) => m.to_profile === userId).reduce((a, m) => a + Number(m.amount), 0),
  };
}

export async function review(userId: string, id: string, body: Body) {
  const row = await sessionRow(uuidParam(id, "clase"));
  const { students } = await requireParticipant(row, userId);
  if (!students.includes(userId)) throw new HttpError(403, "Solo los alumnos de la clase pueden calificar.", "forbidden");
  if (row.status !== "completed") throw new HttpError(409, "Solo puedes calificar clases terminadas.", "conflict");
  const stars = Number(body.stars);
  if (!Number.isInteger(stars) || stars < 1 || stars > 5) throw new HttpError(400, "Elige de 1 a 5 estrellas.");
  const feedback = typeof body.feedback === "string" ? body.feedback.trim().slice(0, 1000) : "";
  const existing = await must<{ id: string }[]>(
    db().from("reviews").select("id").eq("session_id", row.id).eq("reviewer_id", userId).limit(1),
  );
  if (existing.length) throw new HttpError(409, "Ya calificaste esta clase.", "conflict");
  const { error } = await db().from("reviews").insert({
    session_id: row.id,
    reviewer_id: userId,
    tutor_id: row.tutor_id,
    ai_tutor_id: row.tutor_id ? null : row.ai_tutor_id,
    stars,
    feedback_private: feedback || null,
  });
  if (error?.code === "23505") throw new HttpError(409, "Ya calificaste esta clase.", "conflict");
  if (error) throw new HttpError(500, "No pudimos guardar tu review.");
}

export async function mySessions(userId: string) {
  const groups = await myGroupIds(userId);
  const filters = [`tutor_id.eq.${userId}`, `student_id.eq.${userId}`];
  if (groups.length) filters.push(`group_id.in.(${groups.join(",")})`);
  const rows = await must<SessionRow[]>(
    db().from("sessions").select("*").or(filters.join(",")).order("started_at", { ascending: false }).limit(30),
  );
  return sessionDetails(rows, userId);
}

export async function myUpcoming(userId: string): Promise<UpcomingClass[]> {
  const mine = await myGroupIds(userId);
  const filters = [`tutor_id.eq.${userId}`];
  if (mine.length) filters.push(`id.in.(${mine.join(",")})`);
  const groups = await must<Group[]>(
    db()
      .from("groups")
      .select("*")
      .or(filters.join(","))
      .in("status", ["forming", "scheduled", "live"])
      .order("scheduled_at", { ascending: true, nullsFirst: false }),
  );
  if (!groups.length) return [];
  const ids = groups.map((g) => g.id);
  const [members, topics, live] = await Promise.all([
    membersOf(ids),
    topicsById(groups.map((g) => g.topic_id)),
    must<{ id: string; group_id: string }[]>(db().from("sessions").select("id, group_id").in("group_id", ids).eq("status", "live")),
  ]);
  const people = await profilesById([...groups.map((g) => g.tutor_id ?? ""), ...[...members.values()].flat().map((m) => m.student_id)]);
  return groups.map((g) => {
    const m = members.get(g.id) ?? [];
    return {
      group: g,
      topic: topics.get(g.topic_id)!,
      role: g.tutor_id === userId ? ("tutor" as const) : ("student" as const),
      tutor: g.tutor_id ? people.get(g.tutor_id) ?? null : null,
      members: m.map((x) => people.get(x.student_id)).filter((p): p is Profile => !!p),
      myShare: m.find((x) => x.student_id === userId)?.share_quipus ?? null,
      liveSessionId: live.find((s) => s.group_id === g.id)?.id ?? null,
    };
  });
}

// ---------- campus multijugador ----------

export async function campusToken(userId: string) {
  const [profile, equipped] = await Promise.all([profileOf(userId), equippedFor([userId])]);
  const metadata = JSON.stringify({
    name: profile.display_name.split(" ")[0],
    avatar: profile.avatar_config,
    equipped: equipped.get(userId),
  });
  return createCampusToken({ identity: `profile:${userId}`, name: profile.display_name, metadata });
}

// ---------- tutor ----------

export async function tutorProfile(id: string): Promise<PublicProfile> {
  const tutorId = uuidParam(id, "perfil");
  const [profile, equipped, stats, topics, settings, balance] = await Promise.all([
    profileOf(tutorId),
    equippedFor([tutorId]),
    statsFor([tutorId]),
    must<{ tutor_id: string; topic_id: string; level: Level }[]>(db().from("tutor_topics").select("*").eq("tutor_id", tutorId)),
    must<{ group_price_quipus: number }[]>(db().from("tutor_settings").select("group_price_quipus").eq("tutor_id", tutorId)),
    balanceOf(tutorId),
  ]);
  const topicMap = await topicsById(topics.map((t) => t.topic_id));
  const st = stats.get(tutorId)!;
  return {
    profile,
    equipped: equipped.get(tutorId)!,
    badges: await badgesOf(tutorId, st, balance),
    stats: st,
    topics: topics.filter((t) => topicMap.has(t.topic_id)).map((t) => ({ ...t, topic: topicMap.get(t.topic_id)! })),
    group_price_quipus: settings[0]?.group_price_quipus ?? null,
  };
}

export async function tutorPanel(userId: string): Promise<TutorPanel> {
  const [topics, settings, groups] = await Promise.all([
    must<{ tutor_id: string; topic_id: string; level: Level }[]>(db().from("tutor_topics").select("*").eq("tutor_id", userId)),
    must<{ group_price_quipus: number; availability: string[] }[]>(db().from("tutor_settings").select("*").eq("tutor_id", userId)),
    must<Group[]>(db().from("groups").select("*").eq("tutor_id", userId).in("status", ["forming", "scheduled", "live"]).order("scheduled_at")),
  ]);
  const topicIds = topics.map((t) => t.topic_id);
  const incomingRows = topicIds.length
    ? await must<LearningRequest[]>(
        db().from("requests").select("*").eq("status", "open").neq("student_id", userId).in("topic_id", topicIds).order("created_at", { ascending: false }),
      )
    : [];
  const [topicMap, members, incoming] = await Promise.all([
    topicsById([...topicIds, ...groups.map((g) => g.topic_id)]),
    membersOf(groups.map((g) => g.id)),
    withPeople(incomingRows),
  ]);
  const memberProfiles = await profilesById([...members.values()].flat().map((m) => m.student_id));
  return {
    topics: topics.filter((t) => topicMap.has(t.topic_id)).map((t) => ({ ...t, topic: topicMap.get(t.topic_id)! })),
    group_price_quipus: settings[0]?.group_price_quipus ?? 20,
    availability: settings[0]?.availability ?? [],
    incoming,
    scheduled: groups.map((g) => ({
      ...g,
      topic: topicMap.get(g.topic_id)!,
      members: (members.get(g.id) ?? []).map((m) => memberProfiles.get(m.student_id)).filter((p): p is Profile => !!p),
    })),
  };
}

export async function declareTopic(userId: string, body: Body) {
  const topicId = uuidParam(body.topicId as string, "tema");
  const level = LEVELS.includes(body.level as Level) ? (body.level as Level) : "basico";
  await must(db().from("tutor_topics").upsert({ tutor_id: userId, topic_id: topicId, level }));
  await must(db().from("tutor_settings").upsert({ tutor_id: userId }, { onConflict: "tutor_id", ignoreDuplicates: true }));
}

export async function removeTopic(userId: string, topicId: string) {
  await must(db().from("tutor_topics").delete().eq("tutor_id", userId).eq("topic_id", uuidParam(topicId, "tema")));
}

export async function setTutorSettings(userId: string, body: Body) {
  const price = Number(body.groupPrice);
  if (!Number.isInteger(price) || price < 5 || price > 500) throw new HttpError(400, "El precio va de 5 a 500 quipus.");
  const availability = Array.isArray(body.availability) ? body.availability : [];
  if (availability.length > 42 || !availability.every((s) => typeof s === "string" && SLOT.test(s))) {
    throw new HttpError(400, "Horarios inválidos.");
  }
  await must(
    db().from("tutor_settings").upsert({ tutor_id: userId, group_price_quipus: price, availability, updated_at: new Date().toISOString() }),
  );
}

export async function acceptRequest(userId: string, id: string, body: Body) {
  const groupId = await rpc<string>("accept_request", {
    p_tutor_id: userId,
    p_request_id: uuidParam(id, "pedido"),
    p_scheduled_at: optionalIso(body, "scheduledAt"),
  });
  return { groupId };
}

export async function myPrivateReviews(userId: string): Promise<PrivateReview[]> {
  const rows = await must<PrivateReview[]>(
    db().from("reviews").select("*").eq("tutor_id", userId).order("created_at", { ascending: false }).limit(50),
  );
  const sessions = rows.length
    ? await must<{ id: string; topic_id: string | null }[]>(db().from("sessions").select("id, topic_id").in("id", rows.map((r) => r.session_id)))
    : [];
  const topics = await topicsById(sessions.map((s) => s.topic_id));
  return rows.map((r) => {
    const t = sessions.find((s) => s.id === r.session_id)?.topic_id;
    return { ...r, topic: t ? topics.get(t) ?? null : null };
  });
}

// ---------- tienda ----------

export const skins = skinsFor;

export async function buySkin(userId: string, id: string) {
  await rpc("buy_skin", { p_profile_id: userId, p_skin_id: uuidParam(id, "artículo") });
}

export async function saveAvatar(userId: string, body: Body) {
  const result = sanitizeAvatar(body.avatar);
  if (!result.ok) throw new HttpError(400, result.error);
  await must(db().from("profiles").update({ avatar_config: result.config }).eq("id", userId));
}

export async function equipSkin(userId: string, id: string, body: Body) {
  const skinId = uuidParam(id, "artículo");
  const equip = body.equip !== false;
  const [skin] = await must<Skin[]>(db().from("skins").select("*").eq("id", skinId).limit(1));
  if (!skin) throw new HttpError(404, "Ese artículo no existe.", "not_found");
  const owned = await must<{ skin_id: string }[]>(db().from("profile_skins").select("skin_id").eq("profile_id", userId).eq("skin_id", skinId));
  if (!owned.length && skin.price_quipus > 0) throw new HttpError(403, "Solo puedes equipar lo que es tuyo.", "forbidden");
  if (equip) {
    // Dos sistemas conviven: las partes sprite compiten por su slot; las skins de
    // diseño (color/cabeza) compiten solo entre sí por tipo. Nunca se pisan entre sí.
    const sameKind = await must<Skin[]>(db().from("skins").select("*").eq("kind", skin.kind));
    const isSprite = isSpriteSkin(skin.meta);
    const conflicts = sameKind.filter((k) => {
      const kSprite = isSpriteSkin(k.meta);
      if (kSprite !== isSprite) return false;
      if (isSprite) return spriteSlot(k.meta) === spriteSlot(skin.meta);
      return true;
    });
    await must(
      db().from("profile_skins").update({ equipped: false }).eq("profile_id", userId).in("skin_id", conflicts.map((k) => k.id)),
    );
  }
  await must(db().from("profile_skins").upsert({ profile_id: userId, skin_id: skinId, equipped: equip }));
}

// ---------- ledger ----------

const LEDGER_BASE = "id, session_id, from_profile, to_profile, amount, kind, created_at";

export async function ledger(userId: string): Promise<LedgerLine[]> {
  type Row = { id: number; session_id: string | null; from_profile: string | null; to_profile: string | null; amount: number; kind: LedgerLine["kind"]; created_at: string; note?: string | null };
  const query = (columns: string) =>
    db().from("quipus_ledger").select(columns).or(`to_profile.eq.${userId},from_profile.eq.${userId}`).order("id", { ascending: false }).limit(200);
  // La columna note llega con la migración 003: sin ella se lee el ledger como antes
  const first = await query(`${LEDGER_BASE}, note`);
  const rows = await must<Row[]>(first.error && isMissingSchema(first.error) ? query(LEDGER_BASE) : Promise.resolve(first));
  const sessionIds = [...new Set(rows.map((r) => r.session_id).filter((x): x is string => !!x))];
  const sessions = sessionIds.length
    ? await must<{ id: string; topic_id: string | null; ai_tutor_id: string | null }[]>(
        db().from("sessions").select("id, topic_id, ai_tutor_id").in("id", sessionIds),
      )
    : [];
  const [topics, people, ais] = await Promise.all([
    topicsById(sessions.map((s) => s.topic_id)),
    profilesById(rows.flatMap((r) => [r.from_profile ?? "", r.to_profile ?? ""])),
    aiTutors([...new Set(sessions.map((s) => s.ai_tutor_id).filter((x): x is string => !!x))]),
  ]);
  const name = (id: string | null) => (id ? people.get(id)?.display_name ?? "alguien" : "");
  return rows.map((l) => {
    const s = sessions.find((x) => x.id === l.session_id);
    const topic = s?.topic_id ? topics.get(s.topic_id)?.name : undefined;
    let description: string;
    switch (l.kind) {
      case "mint":
        description = "Bienvenida: tus primeros quipus";
        break;
      case "session_payment":
        description =
          l.to_profile === userId
            ? `Enseñaste ${topic ?? "una clase"} a ${name(l.from_profile)}`
            : `Clase de ${topic ?? "un tema"} con ${name(l.to_profile)}`;
        break;
      case "ai_session":
        description = `Clase de ${topic ?? "un tema"} con ${ais.find((a) => a.id === s?.ai_tutor_id)?.name ?? "tutor IA"}`;
        break;
      case "skin_purchase":
        description = "Compra en la tienda";
        break;
      case "refund":
        description = `Devolución por clase cancelada${topic ? ` (${topic})` : ""}`;
        break;
      case "grant":
        description = `Regalo de AulaQuipu${l.note ? `: ${l.note}` : ""}`;
        break;
      case "adjust":
        description = `Ajuste de AulaQuipu${l.note ? `: ${l.note}` : ""}`;
        break;
    }
    return { ...l, amount: Number(l.amount), direction: l.to_profile === userId ? ("in" as const) : ("out" as const), description };
  });
}

// ---------- anuncios del campus ----------

/** Banners vigentes. Sin migración (tabla ausente) no hay anuncios: el campus no debe fallar por esto. */
export async function activeAnnouncements() {
  const nowIso = new Date().toISOString();
  const { data, error } = await db()
    .from("announcements")
    .select("id, text, ends_at")
    .eq("active", true)
    .lte("starts_at", nowIso)
    .order("created_at", { ascending: false })
    .limit(10);
  if (error) {
    if (!isMissingSchema(error)) console.error("[api] no se pudieron leer los anuncios", error.code, error.message);
    return [];
  }
  return (data ?? [])
    .filter((a) => !a.ends_at || Date.parse(a.ends_at) > Date.now())
    .slice(0, 3)
    .map((a) => ({ id: a.id as string, text: a.text as string }));
}
