// Endpoints del panel de administración (/api/admin/*). route.ts ya exigió sesión + admin;
// cada mutación llama a audit() (o lo hace la función SQL, como admin_grant).

import { db, fromDbError, HttpError, must, rpc } from "@/lib/server/core";
import { audit } from "@/lib/server/admin";
import { profilesById } from "@/lib/server/data";
import { toAi } from "@/lib/server/data";
import { str, uuidParam, type Body } from "@/lib/server/handlers";
import { GUIDE_FIELD_MAX } from "@/lib/admin-types";
import { parseAiTutorInput, parseSkinInput, parseTopicName, type Parsed } from "@/lib/admin-validate";
import type {
  AdminAiTutor,
  AiTutorInput,
  AdminSkin,
  AdminTopic,
  MergeResult,
  AdminGuide,
  AdminGuideTopic,
  TopicGuide,
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
