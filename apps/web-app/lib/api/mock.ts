// Implementación mock del ApiClient. Respeta las reglas del documento de diseño
// (saldo derivado del ledger, sin saldos negativos, cierre idempotente, reparto P/N)
// para que el frontend se comporte igual cuando se conecte a la API real.

import type {
  ApiClient,
  BookingInput,
  BookingResult,
  EndResult,
  NewRequestInput,
  RoomToken,
  UpcomingClass,
} from "@/lib/api/client";
import { ApiError } from "@/lib/api/client";
import { buildMockAdmin, isMockAdmin } from "@/lib/api/mock-admin";
import { aiPrice, priceWithPromos } from "@/lib/pricing";
import { buildSeed, SEED_VERSION, TOPIC_KEYWORDS, type DbState } from "@/lib/api/seed";
import type {
  AiTutor,
  Badge,
  Equipped,
  Group,
  LedgerEntry,
  LedgerKind,
  LedgerLine,
  Level,
  MatchOptions,
  Me,
  PrivateReview,
  Profile,
  PublicProfile,
  Session,
  SessionDetail,
  Topic,
  TutorOption,
  TutorPanel,
  TutorStats,
  UUID,
} from "@/lib/types";

const STORAGE_KEY = "aulaquipu-db";
const LATENCY_MS = 120;

let db: DbState | null = null;

function load(): DbState {
  if (db) return db;
  try {
    const raw = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
    if (raw) {
      const parsed = JSON.parse(raw) as DbState;
      if (parsed.version === SEED_VERSION) {
        db = parsed;
        return db;
      }
    }
  } catch {
    // almacenamiento bloqueado o corrupto: arrancamos del seed
  }
  db = buildSeed();
  return db;
}

function persist() {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  } catch {
    // sin almacenamiento: el estado vive solo en memoria
  }
}

const delay = () => new Promise((r) => setTimeout(r, LATENCY_MS));
const uid = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
const now = () => new Date().toISOString();

async function read<T>(fn: (s: DbState) => T): Promise<T> {
  await delay();
  return structuredClone(fn(load()));
}

async function write<T>(fn: (s: DbState) => T): Promise<T> {
  await delay();
  const s = load();
  const result = fn(s);
  persist();
  return structuredClone(result);
}

// ---------- helpers de dominio ----------

function profileOf(s: DbState, id: UUID): Profile {
  const p = s.profiles.find((x) => x.id === id);
  if (!p) throw new ApiError("Usuario no encontrado", "not_found");
  return p;
}

function topicOf(s: DbState, id: UUID): Topic {
  const t = s.topics.find((x) => x.id === id);
  if (!t) throw new ApiError("Tema no encontrado", "not_found");
  return t;
}

export function balanceOf(s: DbState, id: UUID): number {
  return s.ledger.reduce((acc, l) => {
    if (l.to_profile === id) acc += l.amount;
    if (l.from_profile === id) acc -= l.amount;
    return acc;
  }, 0);
}

/** Escribe en el ledger. La validación de saldo se hace antes (requireBalance), como en las RPCs. */
function addLedger(
  s: DbState,
  entry: { kind: LedgerKind; amount: number; from: UUID | null; to: UUID | null; sessionId?: UUID | null; note?: string },
) {
  if (entry.amount <= 0) return;
  const id = s.ledger.reduce((m, l) => Math.max(m, l.id), 0) + 1;
  const row: LedgerEntry = {
    id,
    session_id: entry.sessionId ?? null,
    from_profile: entry.from,
    to_profile: entry.to,
    amount: entry.amount,
    kind: entry.kind,
    created_at: now(),
    ...(entry.note ? { note: entry.note } : {}),
  };
  s.ledger.push(row);
}

/** Igual que available_balance() en la base: saldo − clases reservadas aún no cobradas. */
export function availableOf(s: DbState, id: UUID): number {
  const liveAi = s.sessions
    .filter((x) => x.tutor_kind === "ai" && x.status === "live" && x.student_ids.includes(id))
    .reduce((a, x) => a + x.price_quipus, 0);
  const groups = s.group_members
    .filter((m) => m.student_id === id && m.status === "joined")
    .filter((m) => ["forming", "scheduled", "live"].includes(s.groups.find((g) => g.id === m.group_id)?.status ?? ""))
    .reduce((a, m) => a + m.share_quipus, 0);
  return balanceOf(s, id) - liveAi - groups;
}

function requireBalance(s: DbState, id: UUID, amount: number) {
  const available = availableOf(s, id);
  if (available < amount) {
    throw new ApiError(
      `Necesitas ${amount} quipus y tienes ${Math.max(0, available)} disponibles. Enseña para ganar más.`,
      "insufficient_funds",
    );
  }
}

function statsOf(s: DbState, tutorId: UUID): TutorStats {
  const rs = s.reviews.filter((r) => r.tutor_id === tutorId);
  const avg = rs.length ? rs.reduce((a, r) => a + r.stars, 0) / rs.length : 0;
  const done = s.sessions.filter((x) => x.tutor_id === tutorId && x.status === "completed").length;
  return { estrellas_promedio: Math.round(avg * 10) / 10, sesiones_completadas: done };
}

function equippedOf(s: DbState, id: UUID): Equipped {
  const mine = s.profile_skins.filter((ps) => ps.profile_id === id && ps.equipped);
  const skin = (kind: string) =>
    mine.map((ps) => s.skins.find((k) => k.id === ps.skin_id)!).find((k) => k && k.kind === kind) ?? null;
  return { avatar: skin("avatar"), frame: skin("frame"), deco: skin("profile_deco") };
}

function badgesOf(s: DbState, id: UUID): Badge[] {
  const stats = statsOf(s, id);
  const learned = s.sessions.filter((x) => x.status === "completed" && x.student_ids.includes(id)).length;
  const reviews = s.reviews.filter((r) => r.tutor_id === id);
  const out: Badge[] = [];
  if (stats.sesiones_completadas >= 1)
    out.push({ id: "primer-tutor", name: "Primer tutor", emoji: "🎓", description: "Diste tu primera clase" });
  if (stats.sesiones_completadas >= 10)
    out.push({ id: "diez-sesiones", name: "10 sesiones enseñadas", emoji: "🏆", description: "Diez clases dadas" });
  if (learned >= 1)
    out.push({ id: "aprendiz", name: "Aprendiz curioso", emoji: "🔍", description: "Tomaste tu primera clase" });
  if (reviews.length >= 2 && stats.estrellas_promedio >= 4.5)
    out.push({ id: "estrella", name: "Estrella del aula", emoji: "⭐", description: "Promedio de 4.5 o más" });
  if (balanceOf(s, id) >= 150)
    out.push({ id: "ahorrador", name: "Buen administrador", emoji: "🪢", description: "Juntaste 150 quipus o más" });
  return out;
}

function tutorOption(s: DbState, tutorId: UUID, topicId: UUID): TutorOption {
  const tt = s.tutor_topics.find((x) => x.tutor_id === tutorId && x.topic_id === topicId);
  return {
    profile: profileOf(s, tutorId),
    equipped: equippedOf(s, tutorId),
    stats: statsOf(s, tutorId),
    level: tt?.level ?? "basico",
    group_price_quipus: s.tutor_settings[tutorId]?.group_price_quipus ?? 20,
  };
}

function normalizeTopic(s: DbState, text: string, userId: UUID): { topic: Topic; created: boolean } {
  const q = text.toLowerCase();
  let best: { id: string; score: number } | null = null;
  for (const [id, words] of Object.entries(TOPIC_KEYWORDS)) {
    const score = words.filter((w) => q.includes(w)).length;
    if (score > 0 && (!best || score > best.score)) best = { id, score };
  }
  if (!best) {
    const byName = s.topics.find((t) => q.includes(t.name.toLowerCase()));
    if (byName) return { topic: byName, created: false };
  }
  if (best) return { topic: topicOf(s, best.id), created: false };

  // Tema nuevo propuesto por el alumno: nombre corto a partir del texto
  const name = text
    .replace(/^(no entiendo|necesito|quiero aprender|ayuda con|me cuesta)\s+/i, "")
    .replace(/^(lo de |las |los |el |la )/i, "")
    .replace(/[.?!]+$/, "")
    .trim()
    .slice(0, 40);
  const topic: Topic = {
    id: uid("top"),
    name: name.charAt(0).toUpperCase() + name.slice(1),
    proposed_by: userId,
    status: "active",
  };
  s.topics.push(topic);
  return { topic, created: true };
}

function splitShares(total: number, n: number) {
  // §11.1: share = floor(P / N); el residuo no se cobra a los alumnos
  return Math.max(1, Math.floor(total / Math.max(1, n)));
}

function activeMembers(s: DbState, groupId: UUID) {
  return s.group_members.filter((m) => m.group_id === groupId && m.status === "joined");
}

function sessionDetail(s: DbState, session: Session, userId: UUID): SessionDetail {
  return {
    session,
    topic: topicOf(s, session.topic_id),
    tutor: session.tutor_id ? profileOf(s, session.tutor_id) : null,
    aiTutor: session.ai_tutor_id ? s.ai_tutors.find((a) => a.id === session.ai_tutor_id) ?? null : null,
    students: session.student_ids.map((id) => ({ ...profileOf(s, id), equipped: equippedOf(s, id) })),
    tutorEquipped: session.tutor_id ? equippedOf(s, session.tutor_id) : null,
    myReview: s.reviews.find((r) => r.session_id === session.id && r.reviewer_id === userId) ?? null,
  };
}

function describeLedger(s: DbState, l: LedgerEntry, me: UUID): string {
  const session = l.session_id ? s.sessions.find((x) => x.id === l.session_id) : null;
  const topic = session ? s.topics.find((t) => t.id === session.topic_id)?.name : null;
  const other = (id: UUID | null) => (id ? s.profiles.find((p) => p.id === id)?.display_name ?? "alguien" : "");
  switch (l.kind) {
    case "mint":
      return "Bienvenida: tus primeros quipus";
    case "session_payment":
      return l.to_profile === me
        ? `Enseñaste ${topic ?? "una clase"} a ${other(l.from_profile)}`
        : `Clase de ${topic ?? "un tema"} con ${other(l.to_profile)}`;
    case "ai_session": {
      const ai = session?.ai_tutor_id ? s.ai_tutors.find((a) => a.id === session.ai_tutor_id)?.name : null;
      return `Clase de ${topic ?? "un tema"} con ${ai ?? "tutor IA"}`;
    }
    case "skin_purchase":
      return "Compra en la tienda";
    case "refund":
      return `Devolución por clase cancelada${topic ? ` (${topic})` : ""}`;
    case "grant":
      return `Regalo de AulaQuipu${l.note ? `: ${l.note}` : ""}`;
    case "adjust":
      return `Ajuste de AulaQuipu${l.note ? `: ${l.note}` : ""}`;
  }
}

function ensureLiveGroupSession(s: DbState, group: Group): Session {
  const existing = s.sessions.find((x) => x.group_id === group.id && x.status === "live");
  if (existing) return existing;
  const members = activeMembers(s, group.id);
  const id = uid("ses");
  const session: Session = {
    id,
    group_id: group.id,
    request_id: null,
    tutor_kind: group.ai_tutor_id ? "ai" : "human",
    tutor_id: group.tutor_id,
    ai_tutor_id: group.ai_tutor_id,
    room_name: `session-${id}`,
    price_quipus: group.total_price_quipus,
    status: "live",
    started_at: now(),
    ended_at: null,
    topic_id: group.topic_id,
    student_ids: members.map((m) => m.student_id),
    doc_markdown: "",
  };
  s.sessions.push(session);
  group.status = "live";
  return session;
}

// ---------- cliente ----------

/** Precio efectivo de las clases IA para un alumno (promociones vigentes del mock). */
function withPromos(s: DbState, userId: UUID | undefined, ais: AiTutor[]): AiTutor[] {
  const first = !!userId && !s.sessions.some((x) => x.tutor_kind === "ai" && x.status !== "cancelled" && x.student_ids.includes(userId));
  return ais.map((a) => priceWithPromos(a, s.ai_promotions, first));
}

/** Tienda: los artículos ocultos por un admin solo los ven quienes ya los tienen. */
function shopSkins(s: DbState, owned: Map<string, { equipped: boolean }>) {
  return s.skins
    .filter((k) => k.active !== false || owned.has(k.id))
    .map((k) => ({ ...k, owned: owned.has(k.id), equipped: owned.get(k.id)?.equipped ?? false }));
}

export const mockApi: ApiClient = {
  admin: buildMockAdmin({ read, write, balanceOf, addLedger, uid, now }),

  login: (dni, password) =>
    read((s) => {
      const clean = dni.trim();
      if (!/^\d{8}$/.test(clean)) throw new ApiError("El DNI tiene 8 dígitos.", "invalid");
      const cred = s.credentials.find((c) => c.dni === clean && c.password === password);
      if (!cred) throw new ApiError("DNI o contraseña incorrectos.", "unauthorized");
      if (profileOf(s, cred.profile_id).suspended_at) throw new ApiError("Tu cuenta está suspendida.", "suspended");
      return { userId: cred.profile_id };
    }),

  logout: async () => {},

  testAccounts: () =>
    read((s) => s.credentials.map((c) => ({ dni: c.dni, password: c.password, profile: profileOf(s, c.profile_id) }))),

  listDemoUsers: () => read((s) => s.profiles),

  me: (userId) =>
    read((s): Me => {
      const profile = profileOf(s, userId);
      const owned = new Map(s.profile_skins.filter((p) => p.profile_id === userId).map((p) => [p.skin_id, p]));
      return {
        profile,
        balance: balanceOf(s, userId),
        available: availableOf(s, userId),
        skins: shopSkins(s, owned),
        equipped: equippedOf(s, userId),
        badges: badgesOf(s, userId),
        stats: statsOf(s, userId),
        is_admin: isMockAdmin(s, userId),
      };
    }),

  searchTopics: (query) =>
    read((s) => {
      const q = query.trim().toLowerCase();
      return s.topics.filter((t) => t.status === "active" && (!q || t.name.toLowerCase().includes(q)));
    }),

  createRequest: (userId, input: NewRequestInput) =>
    write((s) => {
      const text = input.text.trim();
      if (text.length < 3) throw new ApiError("Cuéntanos un poco más sobre lo que quieres aprender.");
      const { topic } = normalizeTopic(s, text, userId);
      const id = uid("req");
      s.requests.push({
        id,
        student_id: userId,
        topic_id: topic.id,
        detail: text,
        mode: input.mode,
        status: "open",
        preferred_at: input.preferredAt,
        created_at: now(),
      });
      return { requestId: id };
    }),

  myRequests: (userId) =>
    read((s) =>
      s.requests
        .filter((r) => r.student_id === userId && r.status !== "cancelled")
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .map((r) => ({ ...r, topic: topicOf(s, r.topic_id) })),
    ),

  cancelRequest: (userId, requestId) =>
    write((s) => {
      const r = s.requests.find((x) => x.id === requestId && x.student_id === userId);
      if (!r) throw new ApiError("Pedido no encontrado", "not_found");
      if (r.status === "open") r.status = "cancelled";
    }),

  openRequestsFeed: (userId) =>
    read((s) =>
      s.requests
        .filter((r) => r.status === "open" && r.student_id !== userId)
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .slice(0, 6)
        .map((r) => ({ request: r, student: profileOf(s, r.student_id), topic: topicOf(s, r.topic_id) })),
    ),

  match: (userId, requestId) =>
    read((s): MatchOptions => {
      const request = s.requests.find((r) => r.id === requestId && r.student_id === userId);
      if (!request) throw new ApiError("Pedido no encontrado", "not_found");
      const topic = topicOf(s, request.topic_id);

      const groups =
        request.mode === "grupo"
          ? s.groups
              .filter((g) => g.topic_id === topic.id && g.status === "forming")
              .filter((g) => !activeMembers(s, g.id).some((m) => m.student_id === userId))
              .filter((g) => g.tutor_id !== userId && activeMembers(s, g.id).length < 5)
              .map((g) => {
                const members = activeMembers(s, g.id);
                return {
                  group: g,
                  members: members.map((m) => profileOf(s, m.student_id)),
                  tutor: g.tutor_id ? tutorOption(s, g.tutor_id, topic.id) : null,
                  share_quipus: splitShares(g.total_price_quipus, members.length + 1),
                };
              })
          : [];

      const tutors = s.tutor_topics
        .filter((tt) => tt.topic_id === topic.id && tt.tutor_id !== userId)
        .map((tt) => tutorOption(s, tt.tutor_id, topic.id))
        .sort(
          (a, b) =>
            b.stats.estrellas_promedio - a.stats.estrellas_promedio ||
            b.stats.sesiones_completadas - a.stats.sesiones_completadas,
        );

      const aiIds = new Set(s.ai_tutor_topics.filter((x) => x.topic_id === topic.id).map((x) => x.ai_tutor_id));
      // Los de este tema primero; si no hay (o están en pausa), los demás activos
      const live = s.ai_tutors.filter((a) => a.active !== false);
      const assigned = live.filter((a) => aiIds.has(a.id));
      const aiTutors = assigned.length ? assigned : live;

      return { request, topic, topicWasCreated: topic.proposed_by === userId, groups, tutors, aiTutors: withPromos(s, userId, aiTutors) };
    }),

  listAiTutors: (userId) => read((s) => withPromos(s, userId, s.ai_tutors.filter((a) => a.active !== false))),

  book: (userId, input: BookingInput) =>
    write((s): BookingResult => {
      if (input.kind === "ai") {
        const ai = s.ai_tutors.find((a) => a.id === input.aiTutorId);
        if (!ai) throw new ApiError("Tutor IA no encontrado", "not_found");
        if (ai.active === false) throw new ApiError("Este tutor IA está en pausa por ahora. Elige otro.", "conflict");
        const price = aiPrice(withPromos(s, userId, [ai])[0]);
        requireBalance(s, userId, price);
        const request = input.requestId ? s.requests.find((r) => r.id === input.requestId) : null;
        const topicId =
          request?.topic_id ?? s.ai_tutor_topics.find((x) => x.ai_tutor_id === ai.id)?.topic_id ?? s.topics[0].id;
        if (request) request.status = "matched";
        const id = uid("ses");
        s.sessions.push({
          id,
          group_id: null,
          request_id: request?.id ?? null,
          tutor_kind: "ai",
          tutor_id: null,
          ai_tutor_id: ai.id,
          room_name: `session-${id}`,
          price_quipus: price,
          status: "live",
          started_at: now(),
          ended_at: null,
          topic_id: topicId,
          student_ids: [userId],
          doc_markdown: "",
        });
        return { sessionId: id, groupId: null, scheduledAt: null };
      }

      if (input.kind === "human") {
        const request = s.requests.find((r) => r.id === input.requestId && r.student_id === userId);
        if (!request) throw new ApiError("Pedido no encontrado", "not_found");
        const price = s.tutor_settings[input.tutorId]?.group_price_quipus ?? 20;
        requireBalance(s, userId, price);
        const scheduledAt = request.preferred_at ?? new Date(Date.now() + 24 * 3600_000).toISOString();
        const group: Group = {
          id: uid("grp"),
          topic_id: request.topic_id,
          tutor_id: input.tutorId,
          ai_tutor_id: null,
          total_price_quipus: price,
          scheduled_at: scheduledAt,
          status: "scheduled",
          created_at: now(),
        };
        s.groups.push(group);
        s.group_members.push({ group_id: group.id, student_id: userId, share_quipus: price, status: "joined" });
        request.status = "matched";
        return { sessionId: null, groupId: group.id, scheduledAt };
      }

      const group = s.groups.find((g) => g.id === input.groupId);
      if (!group || group.status !== "forming") throw new ApiError("Este grupo ya no está disponible.", "conflict");
      const members = activeMembers(s, group.id);
      if (members.some((m) => m.student_id === userId)) {
        return { sessionId: null, groupId: group.id, scheduledAt: group.scheduled_at };
      }
      const share = splitShares(group.total_price_quipus, members.length + 1);
      requireBalance(s, userId, share);
      s.group_members.push({ group_id: group.id, student_id: userId, share_quipus: share, status: "joined" });
      activeMembers(s, group.id).forEach((m) => (m.share_quipus = share));
      const mine = s.requests.find(
        (r) => r.student_id === userId && r.topic_id === group.topic_id && r.status === "open",
      );
      if (mine) mine.status = "matched";
      if (group.tutor_id && activeMembers(s, group.id).length >= 3) group.status = "scheduled";
      return { sessionId: null, groupId: group.id, scheduledAt: group.scheduled_at };
    }),

  startGroupSession: (userId, groupId) =>
    write((s) => {
      const group = s.groups.find((g) => g.id === groupId);
      if (!group) throw new ApiError("Grupo no encontrado", "not_found");
      const isMember = activeMembers(s, groupId).some((m) => m.student_id === userId);
      if (!isMember && group.tutor_id !== userId) throw new ApiError("No eres parte de esta clase.", "invalid");
      if (group.status === "completed" || group.status === "cancelled")
        throw new ApiError("Esta clase ya terminó.", "conflict");
      return { sessionId: ensureLiveGroupSession(s, group).id };
    }),

  session: (userId, sessionId) =>
    read((s) => {
      const session = s.sessions.find((x) => x.id === sessionId);
      if (!session) throw new ApiError("Sesión no encontrada", "not_found");
      return sessionDetail(s, session, userId);
    }),

  roomToken: async (_userId, sessionId): Promise<RoomToken> => {
    await delay();
    // Sin API: no hay token LiveKit. El aula corre en modo local con el tutor IA simulado.
    return { livekitUrl: null, token: null, yjsUrl: null, docName: `session-${sessionId}` };
  },

  saveSessionDoc: (_userId, sessionId, markdown) =>
    write((s) => {
      const session = s.sessions.find((x) => x.id === sessionId);
      if (session) session.doc_markdown = markdown;
    }),

  endSession: (userId, sessionId) =>
    write((s): EndResult => {
      const session = s.sessions.find((x) => x.id === sessionId);
      if (!session) throw new ApiError("Sesión no encontrada", "not_found");
      // §11.4: idempotente — solo liquida si sigue 'live'
      if (session.status !== "live") {
        const paid = s.ledger
          .filter((l) => l.session_id === sessionId && l.from_profile === userId)
          .reduce((a, l) => a + l.amount, 0);
        const earned = s.ledger
          .filter((l) => l.session_id === sessionId && l.to_profile === userId)
          .reduce((a, l) => a + l.amount, 0);
        return { alreadyEnded: true, paid, earned };
      }

      let paid = 0;
      let earned = 0;
      if (session.tutor_kind === "ai") {
        for (const studentId of session.student_ids) {
          addLedger(s, { kind: "ai_session", amount: session.price_quipus, from: studentId, to: null, sessionId });
          if (studentId === userId) paid += session.price_quipus;
        }
      } else {
        const members = session.group_id ? activeMembers(s, session.group_id) : [];
        // Como end_session() en la base: la clase ocurrió, se cobra siempre (puede quedar deuda)
        for (const m of members) {
          addLedger(s, {
            kind: "session_payment",
            amount: m.share_quipus,
            from: m.student_id,
            to: session.tutor_id,
            sessionId,
          });
          if (m.student_id === userId) paid += m.share_quipus;
          if (session.tutor_id === userId) earned += m.share_quipus;
        }
        const group = s.groups.find((g) => g.id === session.group_id);
        if (group) group.status = "completed";
      }
      session.status = "completed";
      session.ended_at = now();
      if (session.request_id) {
        const r = s.requests.find((x) => x.id === session.request_id);
        if (r) r.status = "fulfilled";
      }
      s.requests
        .filter(
          (r) => session.student_ids.includes(r.student_id) && r.topic_id === session.topic_id && r.status === "matched",
        )
        .forEach((r) => (r.status = "fulfilled"));
      return { alreadyEnded: false, paid, earned };
    }),

  review: (userId, sessionId, stars, feedback) =>
    write((s) => {
      const session = s.sessions.find((x) => x.id === sessionId);
      if (!session) throw new ApiError("Sesión no encontrada", "not_found");
      if (session.status !== "completed") throw new ApiError("Solo puedes calificar clases terminadas.");
      if (!session.student_ids.includes(userId)) throw new ApiError("Solo los alumnos de la clase pueden calificar.");
      if (s.reviews.some((r) => r.session_id === sessionId && r.reviewer_id === userId))
        throw new ApiError("Ya calificaste esta clase.", "conflict");
      if (stars < 1 || stars > 5) throw new ApiError("Elige de 1 a 5 estrellas.");
      s.reviews.push({
        id: uid("rev"),
        session_id: sessionId,
        reviewer_id: userId,
        tutor_id: session.tutor_id,
        ai_tutor_id: session.ai_tutor_id,
        stars,
        feedback_private: feedback.trim() || null,
        created_at: now(),
      });
    }),

  mySessions: (userId) =>
    read((s) =>
      s.sessions
        .filter((x) => x.student_ids.includes(userId) || x.tutor_id === userId)
        .sort((a, b) => b.started_at.localeCompare(a.started_at))
        .map((x) => sessionDetail(s, x, userId)),
    ),

  myUpcoming: (userId) =>
    read((s): UpcomingClass[] =>
      s.groups
        .filter((g) => ["forming", "scheduled", "live"].includes(g.status))
        .filter((g) => g.tutor_id === userId || activeMembers(s, g.id).some((m) => m.student_id === userId))
        .sort((a, b) => (a.scheduled_at ?? "").localeCompare(b.scheduled_at ?? ""))
        .map((g) => {
          const members = activeMembers(s, g.id);
          return {
            group: g,
            topic: topicOf(s, g.topic_id),
            role: g.tutor_id === userId ? "tutor" : "student",
            tutor: g.tutor_id ? profileOf(s, g.tutor_id) : null,
            members: members.map((m) => profileOf(s, m.student_id)),
            myShare: members.find((m) => m.student_id === userId)?.share_quipus ?? null,
            liveSessionId: s.sessions.find((x) => x.group_id === g.id && x.status === "live")?.id ?? null,
          };
        }),
    ),

  tutorProfile: (tutorId) =>
    read((s): PublicProfile => ({
      profile: profileOf(s, tutorId),
      equipped: equippedOf(s, tutorId),
      badges: badgesOf(s, tutorId),
      stats: statsOf(s, tutorId),
      topics: s.tutor_topics.filter((x) => x.tutor_id === tutorId).map((x) => ({ ...x, topic: topicOf(s, x.topic_id) })),
      group_price_quipus: s.tutor_settings[tutorId]?.group_price_quipus ?? null,
    })),

  tutorPanel: (userId) =>
    read((s): TutorPanel => {
      const topics = s.tutor_topics.filter((x) => x.tutor_id === userId);
      const topicIds = new Set(topics.map((x) => x.topic_id));
      const settings = s.tutor_settings[userId] ?? { group_price_quipus: 20, availability: [] };
      return {
        topics: topics.map((x) => ({ ...x, topic: topicOf(s, x.topic_id) })),
        group_price_quipus: settings.group_price_quipus,
        availability: settings.availability,
        incoming: s.requests
          .filter((r) => r.status === "open" && r.student_id !== userId && topicIds.has(r.topic_id))
          .map((r) => ({ request: r, student: profileOf(s, r.student_id), topic: topicOf(s, r.topic_id) })),
        scheduled: s.groups
          .filter((g) => g.tutor_id === userId && ["forming", "scheduled", "live"].includes(g.status))
          .map((g) => ({
            ...g,
            topic: topicOf(s, g.topic_id),
            members: activeMembers(s, g.id).map((m) => profileOf(s, m.student_id)),
          })),
      };
    }),

  declareTopic: (userId, topicId, level: Level) =>
    write((s) => {
      topicOf(s, topicId);
      const existing = s.tutor_topics.find((x) => x.tutor_id === userId && x.topic_id === topicId);
      if (existing) existing.level = level;
      else s.tutor_topics.push({ tutor_id: userId, topic_id: topicId, level });
      if (!s.tutor_settings[userId]) s.tutor_settings[userId] = { group_price_quipus: 20, availability: [] };
    }),

  removeTopic: (userId, topicId) =>
    write((s) => {
      s.tutor_topics = s.tutor_topics.filter((x) => !(x.tutor_id === userId && x.topic_id === topicId));
    }),

  setTutorSettings: (userId, groupPrice, availability) =>
    write((s) => {
      if (!Number.isInteger(groupPrice) || groupPrice < 5)
        throw new ApiError("El precio mínimo sugerido es 5 quipus.");
      s.tutor_settings[userId] = { group_price_quipus: groupPrice, availability };
    }),

  acceptRequest: (userId, requestId, scheduledAt) =>
    write((s) => {
      const req = s.requests.find((r) => r.id === requestId);
      if (!req || req.status !== "open") throw new ApiError("Este pedido ya fue tomado.", "conflict");
      const price = s.tutor_settings[userId]?.group_price_quipus ?? 20;
      // Armado automático: se suman otros pedidos 'grupo' abiertos del mismo tema (máx. 5)
      const batch =
        req.mode === "grupo"
          ? s.requests
              .filter(
                (r) =>
                  r.status === "open" && r.topic_id === req.topic_id && r.mode === "grupo" && r.student_id !== userId,
              )
              .slice(0, 5)
          : [req];
      const eligible = batch.filter((r) => availableOf(s, r.student_id) >= splitShares(price, batch.length));
      if (!eligible.length) throw new ApiError("Al alumno no le alcanzan los quipus para tu precio.", "insufficient_funds");
      const share = splitShares(price, eligible.length);
      const group: Group = {
        id: uid("grp"),
        topic_id: req.topic_id,
        tutor_id: userId,
        ai_tutor_id: null,
        total_price_quipus: price,
        scheduled_at: scheduledAt,
        status: "scheduled",
        created_at: now(),
      };
      s.groups.push(group);
      for (const r of eligible) {
        s.group_members.push({ group_id: group.id, student_id: r.student_id, share_quipus: share, status: "joined" });
        r.status = "matched";
      }
      return { groupId: group.id };
    }),

  myPrivateReviews: (userId) =>
    read((s): PrivateReview[] =>
      s.reviews
        .filter((r) => r.tutor_id === userId)
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .map((r) => {
          const session = s.sessions.find((x) => x.id === r.session_id);
          return { ...r, topic: session ? topicOf(s, session.topic_id) : null };
        }),
    ),

  skins: (userId) =>
    read((s) => {
      const owned = new Map(s.profile_skins.filter((p) => p.profile_id === userId).map((p) => [p.skin_id, p]));
      return shopSkins(s, owned);
    }),

  buySkin: (userId, skinId) =>
    write((s) => {
      const skin = s.skins.find((k) => k.id === skinId);
      if (!skin) throw new ApiError("Ese artículo no existe.", "not_found");
      // §11.4: compra idempotente por (profile_id, skin_id)
      if (s.profile_skins.some((p) => p.profile_id === userId && p.skin_id === skinId)) return;
      if (skin.active === false) throw new ApiError("Ese artículo no existe.", "not_found");
      requireBalance(s, userId, skin.price_quipus);
      addLedger(s, { kind: "skin_purchase", amount: skin.price_quipus, from: userId, to: null });
      s.profile_skins.push({ profile_id: userId, skin_id: skinId, equipped: false });
    }),

  equipSkin: (userId, skinId, equip) =>
    write((s) => {
      const skin = s.skins.find((k) => k.id === skinId);
      const owned = s.profile_skins.find((p) => p.profile_id === userId && p.skin_id === skinId);
      if (!skin || !owned) throw new ApiError("Solo puedes equipar lo que es tuyo.");
      if (equip) {
        s.profile_skins
          .filter((p) => p.profile_id === userId && s.skins.find((k) => k.id === p.skin_id)?.kind === skin.kind)
          .forEach((p) => (p.equipped = false));
      }
      owned.equipped = equip;
    }),

  ledger: (userId) =>
    read((s): LedgerLine[] =>
      s.ledger
        .filter((l) => l.to_profile === userId || l.from_profile === userId)
        .sort((a, b) => b.id - a.id)
        .map((l) => ({
          ...l,
          direction: l.to_profile === userId ? "in" : "out",
          description: describeLedger(s, l, userId),
        })),
    ),

  // En modo demo no hay sala compartida: cada navegador está solo
  campusToken: async () => null,

  resetDemo: async () => {
    await delay();
    db = buildSeed();
    persist();
  },
};
