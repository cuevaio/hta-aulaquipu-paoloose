// Endpoints del panel de administración (/api/admin/*). route.ts ya exigió sesión + admin;
// cada mutación llama a audit() (o lo hace la función SQL, como admin_grant).

import { db, fromDbError, HttpError, isMissingSchema, must, rpc } from "@/lib/server/core";
import { audit, forgetUser, isAdmin } from "@/lib/server/admin";
import { aiTutors, membersOf, profilesById, toAi, topicsById } from "@/lib/server/data";
import { closeRoom } from "@/lib/server/livekit";
import { str, uuidParam, type Body } from "@/lib/server/handlers";
import { GUIDE_FIELD_MAX, parseTopicImage } from "@/lib/admin-types";
import { parseAiTutorInput, parseAnnouncement, parseReason, parseReportText, parseSkinInput, parseTopicName, type Parsed } from "@/lib/admin-validate";
import { STUCK_AFTER_MIN } from "@/lib/admin-types";
import type {
  AdminAiTutor,
  Announcement,
  ChatReport,
  ModUser,
  StuckSession,
  AiTutorInput,
  AdminSkin,
  AdminTopic,
  MergeResult,
  AdminGuide,
  AdminGuideTopic,
  TopicGuide,
  TopicImage,
  AdminMetrics,
  AdminUser,
  AiPromotion,
  AuditRow,
  CreditOptions,
  CreditsResult,
  CreditScope,
} from "@/lib/admin-types";

// ---------- métricas y auditoría ----------

export const metrics = () => rpc<AdminMetrics>("admin_metrics", {});

export async function auditLog(): Promise<AuditRow[]> {
  const rows = await must<Omit<AuditRow, "admin_name">[]>(
    db().from("admin_audit").select("*").order("id", { ascending: false }).limit(100),
  );
  const people = await profilesById(rows.map((r) => r.admin_id ?? ""));
  return rows.map((r) => ({ ...r, admin_name: r.admin_id ? people.get(r.admin_id)?.display_name ?? null : null }));
}

// ---------- créditos ----------

const SCOPES: CreditScope[] = ["user", "grade", "school", "all"];

function scopeOf(raw: { scope?: unknown; value?: unknown }): { scope: CreditScope; value: string | null } {
  const scope = raw.scope as CreditScope;
  if (!SCOPES.includes(scope)) throw new HttpError(400, "Elige a quién aplicar los créditos.");
  if (scope === "all") return { scope, value: null };
  const value = typeof raw.value === "string" ? raw.value.trim() : "";
  if (!value || value.length > 120) throw new HttpError(400, "Elige a quién aplicar los créditos.");
  if (scope === "grade" && !/^[1-5]$/.test(value)) throw new HttpError(400, "El grado va de 1 a 5.");
  if (scope === "user") uuidParam(value, "alumno");
  return { scope, value };
}

/** Cuántos perfiles alcanza un alcance, para la vista previa "afectará a N alumnos". */
export async function creditsPreview(query: URLSearchParams): Promise<{ count: number }> {
  const { scope, value } = scopeOf({ scope: query.get("scope"), value: query.get("value") });
  let q = db().from("profiles").select("id", { count: "exact", head: true });
  if (scope === "user") q = q.eq("id", value!);
  if (scope === "grade") q = q.eq("grade", Number(value));
  if (scope === "school") q = q.eq("school", value!);
  const { count, error } = await q;
  if (error) throw new HttpError(500, "Algo salió mal en el servidor. Intenta de nuevo.");
  return { count: count ?? 0 };
}

export async function creditOptions(): Promise<CreditOptions> {
  const rows = await must<{ school: string | null }[]>(db().from("profiles").select("school").not("school", "is", null).limit(5000));
  const schools = [...new Set(rows.map((r) => r.school).filter((x): x is string => !!x))].sort((a, b) => a.localeCompare(b, "es"));
  return { grades: [1, 2, 3, 4, 5], schools };
}

export async function searchUsers(query: URLSearchParams): Promise<AdminUser[]> {
  // Se quitan los caracteres con significado en los filtros de PostgREST
  const text = (query.get("query") ?? "").replace(/[^\p{L}\p{N} _.-]/gu, "").trim().slice(0, 40);
  if (text.length < 2) return [];
  const rows = await must<Omit<AdminUser, "balance">[]>(
    db()
      .from("profiles")
      .select("id, username, display_name, grade, school")
      .or(`username.ilike.%${text}%,display_name.ilike.%${text}%`)
      .order("display_name")
      .limit(8),
  );
  if (!rows.length) return [];
  const balances = await must<{ profile_id: string; quipus: number | string }[]>(
    db().from("balances").select("profile_id, quipus").in("profile_id", rows.map((r) => r.id)),
  );
  const byId = new Map(balances.map((b) => [b.profile_id, Number(b.quipus)]));
  return rows.map((r) => ({ ...r, balance: byId.get(r.id) ?? 0 }));
}

export async function grantCredits(adminId: string, body: Body): Promise<CreditsResult> {
  const { scope, value } = scopeOf(body);
  const amount = Number(body.amount);
  if (!Number.isInteger(amount) || amount === 0 || Math.abs(amount) > 10_000) {
    throw new HttpError(400, "El monto va de 1 a 10000 quipus (positivo regala, negativo descuenta).");
  }
  const reason = str(body, "reason", { min: 3, max: 140 });
  // admin_grant hace todo en una transacción y escribe su propia fila de auditoría
  return rpc<CreditsResult>("admin_grant", {
    p_admin_id: adminId,
    p_scope: scope,
    p_value: value,
    p_amount: amount,
    p_reason: reason,
  });
}

// ---------- precios IA ----------

interface AiRow {
  id: string;
  name: string;
  persona: Record<string, unknown>;
  price_quipus: number;
  active?: boolean;
}

const check = <T,>(r: Parsed<T>): T => {
  if (!r.ok) throw new HttpError(400, r.error);
  return r.value;
};

const toAdminTutor = (r: AiRow, topicIds: string[]): AdminAiTutor => {
  const ai = toAi(r);
  return {
    id: r.id,
    name: r.name,
    emoji: ai.persona.emoji,
    color: ai.persona.color,
    tagline: typeof r.persona?.tagline === "string" ? r.persona.tagline : "",
    style: ai.persona.style,
    focus: typeof r.persona?.focus === "string" ? r.persona.focus : "",
    voice: ai.persona.voice,
    price_quipus: r.price_quipus,
    active: r.active !== false,
    topic_ids: topicIds,
  };
};

async function tutorTopics(): Promise<Map<string, string[]>> {
  const rows = await must<{ ai_tutor_id: string; topic_id: string }[]>(db().from("ai_tutor_topics").select("ai_tutor_id, topic_id"));
  const map = new Map<string, string[]>();
  for (const r of rows) map.set(r.ai_tutor_id, [...(map.get(r.ai_tutor_id) ?? []), r.topic_id]);
  return map;
}

export async function aiTutorList(): Promise<AdminAiTutor[]> {
  const [rows, topics] = await Promise.all([must<AiRow[]>(db().from("ai_tutors").select("*").order("name")), tutorTopics()]);
  return rows.map((r) => toAdminTutor(r, topics.get(r.id) ?? []));
}

export async function aiPrice(id: string) {
  const rows = await must<AiRow[]>(db().from("ai_tutors").select("*").eq("id", uuidParam(id, "tutor")).limit(1));
  if (!rows.length) throw new HttpError(404, "Ese tutor no existe.", "not_found");
  return { id: rows[0].id, name: rows[0].name, price_quipus: rows[0].price_quipus };
}

export async function setAiPrice(adminId: string, id: string, body: Body) {
  const tutorId = uuidParam(id, "tutor");
  const price = Number(body.price);
  if (!Number.isInteger(price) || price < 1 || price > 500) throw new HttpError(400, "El precio va de 1 a 500 quipus.");
  const before = await aiPrice(tutorId);
  await must(db().from("ai_tutors").update({ price_quipus: price }).eq("id", tutorId));
  await audit(adminId, "ai_tutor.price", tutorId, { name: before.name, from: before.price_quipus, to: price });
  return { id: tutorId, price_quipus: price };
}

// ---------- promociones IA ----------

function promoInput(body: Body) {
  const percent = Number(body.percent_off ?? 0);
  if (!Number.isInteger(percent) || percent < 0 || percent > 100) throw new HttpError(400, "El descuento va de 0 a 100 %.");
  const first = body.first_class_free === true;
  if (percent === 0 && !first) throw new HttpError(400, "Indica un descuento o marca la primera clase gratis.");
  const starts = typeof body.starts_at === "string" ? Date.parse(body.starts_at) : NaN;
  const ends = typeof body.ends_at === "string" ? Date.parse(body.ends_at) : NaN;
  if (Number.isNaN(starts) || Number.isNaN(ends)) throw new HttpError(400, "Fechas inválidas.");
  if (ends <= starts) throw new HttpError(400, "La promoción debe terminar después de empezar.");
  const rawTutor = body.ai_tutor_id;
  const tutor = rawTutor === null || rawTutor === undefined || rawTutor === "" ? null : uuidParam(rawTutor as string, "tutor");
  return {
    ai_tutor_id: tutor,
    percent_off: percent,
    first_class_free: first,
    starts_at: new Date(starts).toISOString(),
    ends_at: new Date(ends).toISOString(),
    active: body.active !== false,
  };
}

export const promotions = () =>
  must<AiPromotion[]>(db().from("ai_promotions").select("*").order("created_at", { ascending: false }).limit(100));

export async function createPromotion(adminId: string, body: Body): Promise<AiPromotion> {
  const input = promoInput(body);
  const [row] = await must<AiPromotion[]>(db().from("ai_promotions").insert({ ...input, created_by: adminId }).select("*"));
  await audit(adminId, "promotion.create", row.id, input);
  return row;
}

export async function updatePromotion(adminId: string, id: string, body: Body): Promise<AiPromotion> {
  const promoId = uuidParam(id, "promoción");
  const input = promoInput(body);
  const rows = await must<AiPromotion[]>(db().from("ai_promotions").update(input).eq("id", promoId).select("*"));
  if (!rows.length) throw new HttpError(404, "Esa promoción no existe.", "not_found");
  await audit(adminId, "promotion.update", promoId, input);
  return rows[0];
}

export async function deletePromotion(adminId: string, id: string) {
  const promoId = uuidParam(id, "promoción");
  const rows = await must<AiPromotion[]>(db().from("ai_promotions").delete().eq("id", promoId).select("*"));
  if (!rows.length) throw new HttpError(404, "Esa promoción no existe.", "not_found");
  await audit(adminId, "promotion.delete", promoId, { ai_tutor_id: rows[0].ai_tutor_id, percent_off: rows[0].percent_off });
}

// ---------- guías de enseñanza IA ----------

const GUIDE_FIELDS = ["objectives", "steps", "common_mistakes", "checks"] as const;

interface GuideRow extends TopicGuide {
  topic_id: string;
  updated_at: string;
}

export async function guideList(): Promise<AdminGuideTopic[]> {
  const topics = await must<{ id: string; name: string }[]>(
    db().from("topics").select("id, name").eq("status", "active").order("name").limit(500),
  );
  const guides = await must<{ topic_id: string; updated_at: string }[]>(db().from("ai_guides").select("topic_id, updated_at"));
  const byTopic = new Map(guides.map((g) => [g.topic_id, g.updated_at]));
  return topics.map((t) => ({ topic_id: t.id, name: t.name, has_guide: byTopic.has(t.id), updated_at: byTopic.get(t.id) ?? null }));
}

export async function guideOf(topicId: string): Promise<AdminGuide> {
  const id = uuidParam(topicId, "tema");
  const [topic] = await must<{ id: string; name: string }[]>(db().from("topics").select("id, name").eq("id", id).limit(1));
  if (!topic) throw new HttpError(404, "Ese tema no existe.", "not_found");
  const [row] = await must<GuideRow[]>(db().from("ai_guides").select("*").eq("topic_id", id).limit(1));
  return {
    topic_id: id,
    name: topic.name,
    objectives: row?.objectives ?? "",
    steps: row?.steps ?? "",
    common_mistakes: row?.common_mistakes ?? "",
    checks: row?.checks ?? "",
    updated_at: row?.updated_at ?? null,
  };
}

export async function saveGuide(adminId: string, topicId: string, body: Body): Promise<AdminGuide> {
  const before = await guideOf(topicId);
  const input = {} as TopicGuide;
  for (const f of GUIDE_FIELDS) {
    const v = typeof body[f] === "string" ? (body[f] as string).trim() : "";
    if (v.length > GUIDE_FIELD_MAX) throw new HttpError(400, `Cada campo admite hasta ${GUIDE_FIELD_MAX} caracteres.`);
    input[f] = v;
  }
  if (!GUIDE_FIELDS.some((f) => input[f])) throw new HttpError(400, "Escribe al menos un campo de la guía.");
  await must(
    db().from("ai_guides").upsert({ topic_id: before.topic_id, ...input, updated_by: adminId, updated_at: new Date().toISOString() }),
  );
  await audit(adminId, "guide.save", before.topic_id, {
    topic: before.name,
    created: !before.updated_at,
    chars: GUIDE_FIELDS.reduce((n, f) => n + input[f].length, 0),
  });
  return guideOf(before.topic_id);
}

export async function deleteGuide(adminId: string, topicId: string) {
  const before = await guideOf(topicId);
  await must(db().from("ai_guides").delete().eq("topic_id", before.topic_id));
  await audit(adminId, "guide.delete", before.topic_id, { topic: before.name });
}

// ---------- banco de imágenes por tema (migración 004) ----------

const MISSING_004 = "Falta aplicar la migración 004_topic_images.sql en la base de datos.";
const IMAGE_COLUMNS = "id, topic_id, url, caption, credit, created_at";

function imageDbError(err: { message: string; code?: string }): HttpError {
  if (isMissingSchema(err)) return new HttpError(503, MISSING_004, "unavailable");
  return fromDbError(err);
}

export async function topicImages(topicId: string): Promise<TopicImage[]> {
  const id = uuidParam(topicId, "tema");
  const { data, error } = await db().from("topic_images").select(IMAGE_COLUMNS).eq("topic_id", id).order("created_at").limit(100);
  if (error) throw imageDbError(error);
  return (data ?? []) as TopicImage[];
}

export async function addTopicImage(adminId: string, topicId: string, body: Body): Promise<TopicImage> {
  const id = uuidParam(topicId, "tema");
  const parsed = parseTopicImage(body);
  if ("error" in parsed) throw new HttpError(400, parsed.error);
  const [topic] = await must<{ id: string; name: string }[]>(db().from("topics").select("id, name").eq("id", id).limit(1));
  if (!topic) throw new HttpError(404, "Ese tema no existe.", "not_found");
  const { count, error: countErr } = await db().from("topic_images").select("id", { count: "exact", head: true }).eq("topic_id", id);
  if (countErr) throw imageDbError(countErr);
  if ((count ?? 0) >= 30) throw new HttpError(400, "Cada tema admite hasta 30 imágenes.");
  const { data, error } = await db()
    .from("topic_images")
    .insert({ topic_id: id, ...parsed.value, created_by: adminId })
    .select(IMAGE_COLUMNS)
    .limit(1);
  if (error) throw imageDbError(error);
  const row = (data as TopicImage[])[0];
  await audit(adminId, "topic_image.add", id, { topic: topic.name, image_id: row.id, url: row.url, caption: row.caption });
  return row;
}

export async function deleteTopicImage(adminId: string, imageId: string) {
  const id = uuidParam(imageId, "imagen");
  const { data, error } = await db().from("topic_images").select(IMAGE_COLUMNS).eq("id", id).limit(1);
  if (error) throw imageDbError(error);
  const row = (data as TopicImage[])[0];
  if (!row) throw new HttpError(404, "Esa imagen no existe.", "not_found");
  const del = await db().from("topic_images").delete().eq("id", id);
  if (del.error) throw imageDbError(del.error);
  await audit(adminId, "topic_image.delete", row.topic_id, { image_id: id, url: row.url, caption: row.caption });
}

// ---------- contenido: temas ----------

export async function topicList(): Promise<AdminTopic[]> {
  const [topics, reqs, humans, ais, guides] = await Promise.all([
    must<{ id: string; name: string; status: "active" | "flagged" }[]>(db().from("topics").select("id, name, status").order("name").limit(1000)),
    must<{ topic_id: string; status: string }[]>(db().from("requests").select("topic_id, status").limit(50000)),
    must<{ topic_id: string }[]>(db().from("tutor_topics").select("topic_id").limit(50000)),
    must<{ topic_id: string }[]>(db().from("ai_tutor_topics").select("topic_id").limit(50000)),
    must<{ topic_id: string }[]>(db().from("ai_guides").select("topic_id")),
  ]);
  const count = (rows: { topic_id: string }[]) => {
    const m = new Map<string, number>();
    for (const r of rows) m.set(r.topic_id, (m.get(r.topic_id) ?? 0) + 1);
    return m;
  };
  const total = count(reqs);
  const open = count(reqs.filter((r) => r.status === "open"));
  const h = count(humans);
  const a = count(ais);
  const g = new Set(guides.map((x) => x.topic_id));
  return topics.map((t) => ({
    id: t.id,
    name: t.name,
    status: t.status,
    requests: total.get(t.id) ?? 0,
    open_requests: open.get(t.id) ?? 0,
    tutors: h.get(t.id) ?? 0,
    ai_tutors: a.get(t.id) ?? 0,
    has_guide: g.has(t.id),
  }));
}

export async function updateTopic(adminId: string, id: string, body: Body) {
  const topicId = uuidParam(id, "tema");
  const [before] = await must<{ id: string; name: string; status: string }[]>(db().from("topics").select("id, name, status").eq("id", topicId).limit(1));
  if (!before) throw new HttpError(404, "Ese tema no existe.", "not_found");
  const patch: { name?: string; status?: string } = {};
  if (body.name !== undefined) patch.name = check(parseTopicName(body.name));
  if (body.status !== undefined) {
    if (body.status !== "active" && body.status !== "flagged") throw new HttpError(400, "Estado inválido.");
    patch.status = body.status;
  }
  if (!Object.keys(patch).length) throw new HttpError(400, "No hay nada que cambiar.");
  const { error } = await db().from("topics").update(patch).eq("id", topicId);
  if (error?.code === "23505") throw new HttpError(409, "Ya existe un tema con ese nombre. Usa “Unir” para combinarlos.", "conflict");
  if (error) throw fromDbError(error);
  if (patch.name && patch.name !== before.name) await audit(adminId, "topic.rename", topicId, { from: before.name, to: patch.name });
  if (patch.status && patch.status !== before.status) {
    await audit(adminId, patch.status === "flagged" ? "topic.flag" : "topic.unflag", topicId, { name: patch.name ?? before.name });
  }
}

export async function mergeTopics(adminId: string, body: Body): Promise<MergeResult> {
  // admin_merge_topics es atómica y escribe su propia fila de auditoría
  return rpc<MergeResult>("admin_merge_topics", {
    p_admin_id: adminId,
    p_src: uuidParam(body.sourceId as string, "tema de origen"),
    p_dst: uuidParam(body.targetId as string, "tema de destino"),
  });
}

// ---------- contenido: tutores IA ----------

async function replaceTutorTopics(tutorId: string, topicIds: string[]) {
  const current = (await tutorTopics()).get(tutorId) ?? [];
  const remove = current.filter((t) => !topicIds.includes(t));
  const add = topicIds.filter((t) => !current.includes(t));
  if (add.length) {
    const found = await must<{ id: string }[]>(db().from("topics").select("id").in("id", add));
    if (found.length !== add.length) throw new HttpError(400, "Alguno de los temas elegidos no existe.");
    await must(db().from("ai_tutor_topics").insert(add.map((topic_id) => ({ ai_tutor_id: tutorId, topic_id }))));
  }
  if (remove.length) await must(db().from("ai_tutor_topics").delete().eq("ai_tutor_id", tutorId).in("topic_id", remove));
}

const personaOf = (v: AiTutorInput) => ({
  emoji: v.emoji,
  color: v.color,
  tagline: v.tagline,
  style: v.style,
  focus: v.focus,
  voice: v.voice,
});

export async function createAiTutor(adminId: string, body: Body): Promise<AdminAiTutor> {
  const v = check(parseAiTutorInput(body));
  const [row] = await must<AiRow[]>(
    db().from("ai_tutors").insert({ name: v.name, persona: personaOf(v), price_quipus: v.price_quipus, active: v.active }).select("*"),
  );
  await replaceTutorTopics(row.id, v.topic_ids);
  await audit(adminId, "ai_tutor.create", row.id, { name: v.name, price: v.price_quipus, topics: v.topic_ids.length });
  return toAdminTutor(row, v.topic_ids);
}

export async function updateAiTutor(adminId: string, id: string, body: Body): Promise<AdminAiTutor> {
  const tutorId = uuidParam(id, "tutor");
  const v = check(parseAiTutorInput(body));
  const [before] = await must<AiRow[]>(db().from("ai_tutors").select("*").eq("id", tutorId).limit(1));
  if (!before) throw new HttpError(404, "Ese tutor no existe.", "not_found");
  const wasActive = before.active !== false;
  // Se conserva lo que la persona tenga además de estos campos
  const persona = { ...before.persona, ...personaOf(v) };
  const [row] = await must<AiRow[]>(
    db().from("ai_tutors").update({ name: v.name, persona, price_quipus: v.price_quipus, active: v.active }).eq("id", tutorId).select("*"),
  );
  await replaceTutorTopics(tutorId, v.topic_ids);
  await audit(adminId, "ai_tutor.update", tutorId, { name: v.name, topics: v.topic_ids.length });
  if (v.price_quipus !== before.price_quipus) {
    await audit(adminId, "ai_tutor.price", tutorId, { name: v.name, from: before.price_quipus, to: v.price_quipus });
  }
  if (v.active !== wasActive) await audit(adminId, v.active ? "ai_tutor.resume" : "ai_tutor.pause", tutorId, { name: v.name });
  return toAdminTutor(row, v.topic_ids);
}

// ---------- contenido: tienda ----------

interface SkinRow {
  id: string;
  name: string;
  kind: AdminSkin["kind"];
  price_quipus: number;
  meta: AdminSkin["meta"];
  active?: boolean;
}

const toAdminSkin = (r: SkinRow, owners: number): AdminSkin => ({
  id: r.id,
  name: r.name,
  kind: r.kind,
  price_quipus: r.price_quipus,
  meta: r.meta ?? {},
  active: r.active !== false,
  owners,
});

export async function skinList(): Promise<AdminSkin[]> {
  const [rows, owned] = await Promise.all([
    must<SkinRow[]>(db().from("skins").select("*").order("kind").order("price_quipus")),
    must<{ skin_id: string }[]>(db().from("profile_skins").select("skin_id").limit(100000)),
  ]);
  const owners = new Map<string, number>();
  for (const o of owned) owners.set(o.skin_id, (owners.get(o.skin_id) ?? 0) + 1);
  return rows.map((r) => toAdminSkin(r, owners.get(r.id) ?? 0));
}

export async function createSkin(adminId: string, body: Body): Promise<AdminSkin> {
  const v = check(parseSkinInput(body));
  const [row] = await must<SkinRow[]>(db().from("skins").insert(v).select("*"));
  await audit(adminId, "skin.create", row.id, { name: v.name, kind: v.kind, price: v.price_quipus });
  return toAdminSkin(row, 0);
}

export async function updateSkin(adminId: string, id: string, body: Body): Promise<AdminSkin> {
  const skinId = uuidParam(id, "artículo");
  const [before] = await must<SkinRow[]>(db().from("skins").select("*").eq("id", skinId).limit(1));
  if (!before) throw new HttpError(404, "Ese artículo no existe.", "not_found");
  // El tipo no cambia: quien ya lo tiene lo llevaría puesto en otro lugar
  const v = check(parseSkinInput({ ...body, kind: before.kind }));
  const [row] = await must<SkinRow[]>(db().from("skins").update(v).eq("id", skinId).select("*"));
  await audit(adminId, "skin.update", skinId, { name: v.name });
  if (v.price_quipus !== before.price_quipus) await audit(adminId, "skin.price", skinId, { name: v.name, from: before.price_quipus, to: v.price_quipus });
  if (v.active !== (before.active !== false)) await audit(adminId, v.active ? "skin.show" : "skin.hide", skinId, { name: v.name });
  return toAdminSkin(row, 0);
}

// ---------- moderación: usuarios ----------

interface ModProfileRow {
  id: string;
  username: string;
  display_name: string;
  grade: number;
  school: string | null;
  suspended_at: string | null;
  suspended_reason: string | null;
}

const MOD_COLUMNS = "id, username, display_name, grade, school, suspended_at, suspended_reason";

async function toModUsers(rows: ModProfileRow[]): Promise<ModUser[]> {
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const [balances, counts] = await Promise.all([
    must<{ profile_id: string; quipus: number | string }[]>(db().from("balances").select("profile_id, quipus").in("profile_id", ids)),
    Promise.all(
      ids.map(async (id) => {
        const { count, error } = await db()
          .from("sessions")
          .select("id", { count: "exact", head: true })
          .eq("status", "completed")
          .or(`student_id.eq.${id},tutor_id.eq.${id}`);
        if (error) throw fromDbError(error);
        return [id, count ?? 0] as const;
      }),
    ),
  ]);
  const bal = new Map(balances.map((b) => [b.profile_id, Number(b.quipus)]));
  const sessions = new Map(counts);
  return rows.map((r) => ({
    id: r.id,
    username: r.username,
    display_name: r.display_name,
    grade: r.grade,
    school: r.school,
    balance: bal.get(r.id) ?? 0,
    sessions: sessions.get(r.id) ?? 0,
    suspended_at: r.suspended_at,
    suspended_reason: r.suspended_reason,
  }));
}

/** Con 2+ caracteres busca por nombre o usuario; sin búsqueda lista a los suspendidos. */
export async function moderationUsers(query: URLSearchParams): Promise<ModUser[]> {
  const text = (query.get("query") ?? "").replace(/[^\p{L}\p{N} _.-]/gu, "").trim().slice(0, 40);
  let q = db().from("profiles").select(MOD_COLUMNS);
  if (text.length >= 2) q = q.or(`username.ilike.%${text}%,display_name.ilike.%${text}%`).order("display_name");
  else q = q.not("suspended_at", "is", null).order("suspended_at", { ascending: false });
  return toModUsers(await must<ModProfileRow[]>(q.limit(10)));
}

async function suspend(adminId: string, userId: string, reason: string) {
  if (userId === adminId) throw new HttpError(400, "No puedes suspender tu propia cuenta.");
  if (await isAdmin(userId)) throw new HttpError(400, "No puedes suspender a un administrador.");
  const rows = await must<{ id: string; display_name: string; suspended_at: string | null }[]>(
    db().from("profiles").select("id, display_name, suspended_at").eq("id", userId).limit(1),
  );
  if (!rows.length) throw new HttpError(404, "No encontramos a ese alumno.", "not_found");
  await must(db().from("profiles").update({ suspended_at: new Date().toISOString(), suspended_reason: reason }).eq("id", userId));
  forgetUser(userId);
  await audit(adminId, "user.suspend", userId, { name: rows[0].display_name, reason });
}

export async function suspendUser(adminId: string, id: string, body: Body) {
  await suspend(adminId, uuidParam(id, "alumno"), check(parseReason(body.reason)));
}

export async function reactivateUser(adminId: string, id: string) {
  const userId = uuidParam(id, "alumno");
  const rows = await must<{ id: string; display_name: string }[]>(
    db().from("profiles").update({ suspended_at: null, suspended_reason: null }).eq("id", userId).select("id, display_name"),
  );
  if (!rows.length) throw new HttpError(404, "No encontramos a ese alumno.", "not_found");
  forgetUser(userId);
  await audit(adminId, "user.reactivate", userId, { name: rows[0].display_name });
}

// ---------- moderación: reportes del chat ----------

const reportLog = new Map<string, number[]>();
const REPORT_MAX_PER_HOUR = 8;

/** Alumno: reporta un mensaje del chat del campus. Autenticado y con tope por hora. */
export async function reportChat(userId: string, body: Body) {
  const reportedId = uuidParam(body.reportedId as string, "alumno");
  if (reportedId === userId) throw new HttpError(400, "No puedes reportarte a ti mismo.");
  const text = check(parseReportText(body.text));
  const now = Date.now();
  const recent = (reportLog.get(userId) ?? []).filter((t) => now - t < 3600_000);
  if (recent.length >= REPORT_MAX_PER_HOUR) throw new HttpError(429, "Enviaste varios reportes seguidos. Espera un rato.", "forbidden");
  const exists = await must<{ id: string }[]>(db().from("profiles").select("id").eq("id", reportedId).limit(1));
  if (!exists.length) throw new HttpError(404, "No encontramos a ese alumno.", "not_found");
  // Mismo tope en la base, por si el servidor se reinicia o hay varias instancias
  const since = new Date(now - 3600_000).toISOString();
  const { count, error } = await db().from("chat_reports").select("id", { count: "exact", head: true }).eq("reporter_id", userId).gt("created_at", since);
  if (error) throw fromDbError(error);
  if ((count ?? 0) >= REPORT_MAX_PER_HOUR) throw new HttpError(429, "Enviaste varios reportes seguidos. Espera un rato.", "forbidden");
  await must(db().from("chat_reports").insert({ reporter_id: userId, reported_id: reportedId, text }));
  reportLog.set(userId, [...recent, now]);
}

export async function chatReports(): Promise<ChatReport[]> {
  const rows = await must<{ id: string; reporter_id: string; reported_id: string; text: string; created_at: string }[]>(
    db().from("chat_reports").select("id, reporter_id, reported_id, text, created_at").is("resolved_at", null).order("created_at", { ascending: false }).limit(100),
  );
  const ids = [...new Set(rows.flatMap((r) => [r.reporter_id, r.reported_id]))];
  const people = await profilesById(ids);
  const susp = ids.length
    ? await must<{ id: string; suspended_at: string | null }[]>(db().from("profiles").select("id, suspended_at").in("id", ids))
    : [];
  const suspended = new Set(susp.filter((p) => p.suspended_at).map((p) => p.id));
  return rows.map((r) => ({
    id: r.id,
    reporter_id: r.reporter_id,
    reporter_name: people.get(r.reporter_id)?.display_name ?? "Alguien",
    reported_id: r.reported_id,
    reported_name: people.get(r.reported_id)?.display_name ?? "Alguien",
    reported_suspended: suspended.has(r.reported_id),
    text: r.text,
    created_at: r.created_at,
  }));
}

export async function resolveReport(adminId: string, id: string, body: Body) {
  const reportId = uuidParam(id, "reporte");
  const [report] = await must<{ id: string; reported_id: string; resolved_at: string | null }[]>(
    db().from("chat_reports").select("id, reported_id, resolved_at").eq("id", reportId).limit(1),
  );
  if (!report) throw new HttpError(404, "Ese reporte no existe.", "not_found");
  const suspendToo = body.suspend === true;
  // Si la suspensión falla (p. ej. es admin) el reporte sigue abierto
  if (suspendToo) await suspend(adminId, report.reported_id, check(parseReason(body.reason ?? "Reporte del chat del campus")));
  if (!report.resolved_at) {
    await must(db().from("chat_reports").update({ resolved_at: new Date().toISOString(), resolved_by: adminId }).eq("id", reportId));
  }
  await audit(adminId, "report.resolve", reportId, { reported: report.reported_id, suspended: suspendToo });
}

// ---------- moderación: clases atascadas ----------

export async function stuckSessions(): Promise<StuckSession[]> {
  const cutoff = new Date(Date.now() - STUCK_AFTER_MIN * 60_000).toISOString();
  const rows = await must<
    { id: string; group_id: string | null; student_id: string | null; tutor_kind: "human" | "ai"; tutor_id: string | null; ai_tutor_id: string | null; topic_id: string | null; price_quipus: number; started_at: string; request_id: string | null }[]
  >(db().from("sessions").select("id, group_id, student_id, tutor_kind, tutor_id, ai_tutor_id, topic_id, price_quipus, started_at, request_id").eq("status", "live").lt("started_at", cutoff).order("started_at").limit(50));
  if (!rows.length) return [];
  const groupIds = [...new Set(rows.map((r) => r.group_id).filter((x): x is string => !!x))];
  const [members, topics, ais, requests] = await Promise.all([
    groupIds.length ? membersOf(groupIds) : Promise.resolve(new Map<string, { student_id: string; share_quipus: number }[]>()),
    topicsById(rows.map((r) => r.topic_id)),
    aiTutors([...new Set(rows.map((r) => r.ai_tutor_id).filter((x): x is string => !!x))]),
    must<{ id: string; student_id: string }[]>(db().from("requests").select("id, student_id").in("id", rows.map((r) => r.request_id).filter((x): x is string => !!x))),
  ]);
  const reqStudent = new Map(requests.map((r) => [r.id, r.student_id]));
  const studentIds = (r: (typeof rows)[number]) =>
    r.group_id ? (members.get(r.group_id) ?? []).map((m) => m.student_id) : [r.student_id ?? reqStudent.get(r.request_id ?? "")].filter((x): x is string => !!x);
  const people = await profilesById([...rows.flatMap(studentIds), ...rows.map((r) => r.tutor_id ?? "")]);
  const now = Date.now();
  return rows.map((r) => ({
    id: r.id,
    topic: r.topic_id ? (topics.get(r.topic_id)?.name ?? null) : null,
    tutor_kind: r.tutor_kind,
    tutor_name: r.tutor_kind === "ai" ? (ais.find((a) => a.id === r.ai_tutor_id)?.name ?? "Tutor IA") : (people.get(r.tutor_id ?? "")?.display_name ?? "Tutor"),
    student_names: studentIds(r).map((id) => people.get(id)?.display_name ?? "Alumno"),
    started_at: r.started_at,
    minutes: Math.round((now - Date.parse(r.started_at)) / 60_000),
    held: r.group_id ? (members.get(r.group_id) ?? []).reduce((a, m) => a + m.share_quipus, 0) : r.tutor_kind === "ai" ? r.price_quipus : 0,
  }));
}

export async function cancelSession(adminId: string, id: string) {
  const res = await rpc<{ room_name: string; released: number }>("admin_cancel_session", {
    p_admin_id: adminId,
    p_session_id: uuidParam(id, "clase"),
  });
  await closeRoom(res.room_name);
  return { released: res.released };
}

// ---------- anuncios ----------

export const announcements = () =>
  must<Announcement[]>(db().from("announcements").select("id, text, active, starts_at, ends_at, created_at").order("created_at", { ascending: false }).limit(50));

export async function createAnnouncement(adminId: string, body: Body): Promise<Announcement> {
  const v = check(parseAnnouncement(body));
  const [row] = await must<Announcement[]>(db().from("announcements").insert({ ...v, created_by: adminId }).select("id, text, active, starts_at, ends_at, created_at"));
  await audit(adminId, "announcement.create", row.id, { text: v.text, active: v.active, ends_at: v.ends_at });
  return row;
}

export async function updateAnnouncement(adminId: string, id: string, body: Body): Promise<Announcement> {
  const annId = uuidParam(id, "anuncio");
  const v = check(parseAnnouncement(body));
  const rows = await must<Announcement[]>(db().from("announcements").update(v).eq("id", annId).select("id, text, active, starts_at, ends_at, created_at"));
  if (!rows.length) throw new HttpError(404, "Ese anuncio no existe.", "not_found");
  await audit(adminId, "announcement.update", annId, { text: v.text, active: v.active, ends_at: v.ends_at });
  return rows[0];
}

export async function deleteAnnouncement(adminId: string, id: string) {
  const annId = uuidParam(id, "anuncio");
  const rows = await must<{ text: string }[]>(db().from("announcements").delete().eq("id", annId).select("text"));
  if (!rows.length) throw new HttpError(404, "Ese anuncio no existe.", "not_found");
  await audit(adminId, "announcement.delete", annId, { text: rows[0].text });
}
