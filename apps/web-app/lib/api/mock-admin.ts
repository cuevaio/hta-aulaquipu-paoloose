// Panel de administración en modo mock: mismas reglas que lib/server/admin-handlers.ts
// y las funciones SQL de 003_admin.sql, sobre el estado local del mock.

import type { AdminApi } from "@/lib/api/client";
import { ApiError } from "@/lib/api/client";
import type { DbState } from "@/lib/api/seed";
import type { AdminMetrics } from "@/lib/admin-types";
import type { AdminGuide, AuditRow, TopicGuide } from "@/lib/admin-types";
import { GUIDE_FIELD_MAX } from "@/lib/admin-types";
import type { LedgerKind, UUID } from "@/lib/types";

export interface MockHelpers {
  read<T>(fn: (s: DbState) => T): Promise<T>;
  write<T>(fn: (s: DbState) => T): Promise<T>;
  balanceOf(s: DbState, id: UUID): number;
  addLedger(
    s: DbState,
    entry: { kind: LedgerKind; amount: number; from: UUID | null; to: UUID | null; sessionId?: UUID | null; note?: string },
  ): void;
  uid(prefix: string): string;
  now(): string;
}

export const isMockAdmin = (s: DbState, userId: UUID) => s.admins.includes(userId);

function requireAdmin(s: DbState, userId: UUID) {
  if (!isMockAdmin(s, userId)) throw new ApiError("Solo administradores.", "forbidden");
}

function guideView(s: DbState, topicId: UUID): AdminGuide {
  const topic = s.topics.find((t) => t.id === topicId);
  if (!topic) throw new ApiError("Ese tema no existe.", "not_found");
  const g = s.ai_guides.find((x) => x.topic_id === topicId);
  return {
    topic_id: topicId,
    name: topic.name,
    objectives: g?.objectives ?? "",
    steps: g?.steps ?? "",
    common_mistakes: g?.common_mistakes ?? "",
    checks: g?.checks ?? "",
    updated_at: g?.updated_at ?? null,
  };
}

export function buildMockAdmin(h: MockHelpers): AdminApi {
  const audit = (s: DbState, adminId: UUID, action: string, target: string | null, payload: Record<string, unknown>) => {
    const id = s.admin_audit.reduce((m, r) => Math.max(m, r.id), 0) + 1;
    const row: AuditRow = {
      id,
      admin_id: adminId,
      admin_name: s.profiles.find((p) => p.id === adminId)?.display_name ?? null,
      action,
      target,
      payload,
      created_at: h.now(),
    };
    s.admin_audit.push(row);
  };

  const scopeIds = (s: DbState, scope: string, value?: string): UUID[] => {
    if (scope === "all") return s.profiles.map((p) => p.id);
    if (scope === "user") return s.profiles.filter((p) => p.id === value).map((p) => p.id);
    if (scope === "grade") return s.profiles.filter((p) => String(p.grade) === value).map((p) => p.id);
    if (scope === "school") return s.profiles.filter((p) => p.school === value).map((p) => p.id);
    throw new ApiError("Elige a quién aplicar los créditos.");
  };

  const promoInput = (input: Parameters<AdminApi["savePromotion"]>[2]) => {
    if (!Number.isInteger(input.percent_off) || input.percent_off < 0 || input.percent_off > 100)
      throw new ApiError("El descuento va de 0 a 100 %.");
    if (input.percent_off === 0 && !input.first_class_free)
      throw new ApiError("Indica un descuento o marca la primera clase gratis.");
    if (Number.isNaN(Date.parse(input.starts_at)) || Number.isNaN(Date.parse(input.ends_at))) throw new ApiError("Fechas inválidas.");
    if (Date.parse(input.ends_at) <= Date.parse(input.starts_at)) throw new ApiError("La promoción debe terminar después de empezar.");
    return { ...input, ai_tutor_id: input.ai_tutor_id || null };
  };

  return {
    me: (u) => h.read((s) => ({ isAdmin: isMockAdmin(s, u) })),

    metrics: (u) =>
      h.read((s): AdminMetrics => {
        requireAdmin(s, u);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const since = today.getTime();
        const topicName = (id: UUID | null) => s.topics.find((t) => t.id === id)?.name ?? null;
        const nameOf = (id: UUID | null) => s.profiles.find((p) => p.id === id)?.display_name ?? "Alguien";
        const sum = (kind: LedgerKind) => s.ledger.filter((l) => l.kind === kind).reduce((a, l) => a + l.amount, 0);
        const done = s.sessions.filter((x) => x.status === "completed");
        const endedToday = (x: { ended_at: string | null }) => !!x.ended_at && Date.parse(x.ended_at) >= since;

        const active = new Set<string>();
        for (const l of s.ledger) if (Date.parse(l.created_at) >= since) [l.from_profile, l.to_profile].forEach((p) => p && active.add(p));
        for (const x of s.sessions)
          if (Date.parse(x.started_at) >= since) [x.tutor_id, ...x.student_ids].forEach((p) => p && active.add(p));
        for (const r of s.requests) if (Date.parse(r.created_at) >= since) active.add(r.student_id);
        for (const r of s.reviews) if (Date.parse(r.created_at) >= since) active.add(r.reviewer_id);

        const earned = new Map<UUID, number>();
        for (const l of s.ledger) if (l.kind === "session_payment" && l.to_profile) earned.set(l.to_profile, (earned.get(l.to_profile) ?? 0) + l.amount);

        const reqByTopic = new Map<UUID, { total: number; open: number }>();
        for (const r of s.requests) {
          const c = reqByTopic.get(r.topic_id) ?? { total: 0, open: 0 };
          c.total++;
          if (r.status === "open") c.open++;
          reqByTopic.set(r.topic_id, c);
        }
        const withTutor = new Set(s.tutor_topics.map((t) => t.topic_id));

        const byTutor = new Map<UUID, number[]>();
        for (const r of s.reviews) if (r.tutor_id) byTutor.set(r.tutor_id, [...(byTutor.get(r.tutor_id) ?? []), r.stars]);

        const minutes = (x: { started_at: string; ended_at: string | null }) => (Date.parse(x.ended_at!) - Date.parse(x.started_at)) / 60000;
        const short = done.filter((x) => x.ended_at && minutes(x) < 5).sort((a, b) => Date.parse(b.ended_at!) - Date.parse(a.ended_at!));

        return {
          generated_at: h.now(),
          users: {
            total: s.profiles.length,
            last24h: s.profiles.filter((p) => Date.now() - Date.parse(p.created_at) < 86400_000).length,
          },
          active_today: active.size,
          classes: {
            human_total: done.filter((x) => x.tutor_kind === "human").length,
            ai_total: done.filter((x) => x.tutor_kind === "ai").length,
            human_today: done.filter((x) => x.tutor_kind === "human" && endedToday(x)).length,
            ai_today: done.filter((x) => x.tutor_kind === "ai" && endedToday(x)).length,
            live_now: s.sessions.filter((x) => x.status === "live").length,
          },
          economy: {
            circulation: s.profiles.reduce((a, p) => a + h.balanceOf(s, p.id), 0),
            minted: sum("mint"),
            granted: sum("grant"),
            adjusted: sum("adjust"),
            spent_sessions: sum("session_payment"),
            spent_ai: sum("ai_session"),
            spent_shop: sum("skin_purchase"),
            zero_balance_users: s.profiles.filter((p) => h.balanceOf(s, p.id) <= 0).length,
            top_earners: [...earned]
              .sort((a, b) => b[1] - a[1])
              .slice(0, 5)
              .map(([profile_id, e]) => ({ profile_id, display_name: nameOf(profile_id), earned: e })),
          },
          top_topics: [...reqByTopic]
            .sort((a, b) => b[1].total - a[1].total)
            .slice(0, 10)
            .map(([topic_id, c]) => ({ topic_id, name: topicName(topic_id) ?? "Tema", requests: c.total })),
          demand_gaps: [...reqByTopic]
            .filter(([id, c]) => c.open > 0 && !withTutor.has(id))
            .sort((a, b) => b[1].open - a[1].open)
            .slice(0, 10)
            .map(([topic_id, c]) => ({ topic_id, name: topicName(topic_id) ?? "Tema", open_requests: c.open })),
          tutor_ranking: [...byTutor]
            .map(([tutor_id, stars]) => ({
              tutor_id,
              display_name: nameOf(tutor_id),
              avg_stars: Math.round((stars.reduce((a, x) => a + x, 0) / stars.length) * 100) / 100,
              reviews: stars.length,
              sessions: done.filter((x) => x.tutor_id === tutor_id).length,
            }))
            .sort((a, b) => b.avg_stars - a.avg_stars || b.reviews - a.reviews)
            .slice(0, 10),
          short_classes: {
            count: short.length,
            items: short.slice(0, 10).map((x) => ({
              session_id: x.id,
              topic: topicName(x.topic_id),
              tutor_kind: x.tutor_kind,
              minutes: Math.round(minutes(x) * 10) / 10,
              ended_at: x.ended_at!,
            })),
          },
          low_reviews: s.reviews
            .filter((r) => r.stars <= 2)
            .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
            .slice(0, 10)
            .map((r) => ({
              id: r.id,
              stars: r.stars,
              feedback: r.feedback_private,
              created_at: r.created_at,
              tutor_name: r.tutor_id ? nameOf(r.tutor_id) : s.ai_tutors.find((a) => a.id === r.ai_tutor_id)?.name ?? null,
              is_ai: !!r.ai_tutor_id,
              topic: topicName(s.sessions.find((x) => x.id === r.session_id)?.topic_id ?? null),
            })),
        };
      }),

    audit: (u) =>
      h.read((s) => {
        requireAdmin(s, u);
        return [...s.admin_audit].sort((a, b) => b.id - a.id).slice(0, 100);
      }),

    searchUsers: (u, query) =>
      h.read((s) => {
        requireAdmin(s, u);
        const q = query.trim().toLowerCase();
        if (q.length < 2) return [];
        return s.profiles
          .filter((p) => p.username.toLowerCase().includes(q) || p.display_name.toLowerCase().includes(q))
          .slice(0, 8)
          .map((p) => ({ id: p.id, username: p.username, display_name: p.display_name, grade: p.grade, school: p.school, balance: h.balanceOf(s, p.id) }));
      }),

    creditOptions: (u) =>
      h.read((s) => {
        requireAdmin(s, u);
        return { grades: [1, 2, 3, 4, 5], schools: [...new Set(s.profiles.map((p) => p.school).filter((x): x is string => !!x))].sort() };
      }),

    creditsPreview: (u, scope, value) =>
      h.read((s) => {
        requireAdmin(s, u);
        return { count: scopeIds(s, scope, value).length };
      }),

    grantCredits: (u, input) =>
      h.write((s) => {
        requireAdmin(s, u);
        const reason = input.reason.trim();
        if (!Number.isInteger(input.amount) || input.amount === 0 || Math.abs(input.amount) > 10_000)
          throw new ApiError("El monto va de 1 a 10000 quipus (positivo regala, negativo descuenta).");
        if (reason.length < 3 || reason.length > 140) throw new ApiError("El motivo debe tener entre 3 y 140 caracteres.");
        const ids = scopeIds(s, input.scope, input.value);
        if (input.scope === "user" && !ids.length) throw new ApiError("No encontramos a ese alumno.", "not_found");
        const abs = Math.abs(input.amount);
        let affected = 0;
        let skipped = 0;
        for (const id of ids) {
          if (input.amount > 0) {
            h.addLedger(s, { kind: "grant", amount: abs, from: null, to: id, note: reason });
            affected++;
          } else if (h.balanceOf(s, id) >= abs) {
            h.addLedger(s, { kind: "adjust", amount: abs, from: id, to: null, note: reason });
            affected++;
          } else skipped++;
        }
        audit(s, u, input.amount > 0 ? "credits.grant" : "credits.adjust", input.scope + (input.value ? `:${input.value}` : ""), {
          scope: input.scope,
          value: input.value ?? null,
          amount: input.amount,
          reason,
          affected,
          skipped,
        });
        return { affected, skipped };
      }),

    aiTutors: (u) =>
      h.read((s) => {
        requireAdmin(s, u);
        return s.ai_tutors.map((a) => ({ id: a.id, name: a.name, emoji: a.persona.emoji, price_quipus: a.price_quipus, active: true }));
      }),

    setAiPrice: (u, id, price) =>
      h.write((s) => {
        requireAdmin(s, u);
        if (!Number.isInteger(price) || price < 1 || price > 500) throw new ApiError("El precio va de 1 a 500 quipus.");
        const ai = s.ai_tutors.find((a) => a.id === id);
        if (!ai) throw new ApiError("Ese tutor no existe.", "not_found");
        audit(s, u, "ai_tutor.price", id, { name: ai.name, from: ai.price_quipus, to: price });
        ai.price_quipus = price;
      }),

    promotions: (u) =>
      h.read((s) => {
        requireAdmin(s, u);
        return [...s.ai_promotions].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
      }),

    savePromotion: (u, id, input) =>
      h.write((s) => {
        requireAdmin(s, u);
        const data = promoInput(input);
        if (id) {
          const row = s.ai_promotions.find((p) => p.id === id);
          if (!row) throw new ApiError("Esa promoción no existe.", "not_found");
          Object.assign(row, data);
          audit(s, u, "promotion.update", id, data);
          return row;
        }
        const row = { ...data, id: h.uid("promo"), created_at: h.now() };
        s.ai_promotions.push(row);
        audit(s, u, "promotion.create", row.id, data);
        return row;
      }),

    deletePromotion: (u, id) =>
      h.write((s) => {
        requireAdmin(s, u);
        const i = s.ai_promotions.findIndex((p) => p.id === id);
        if (i < 0) throw new ApiError("Esa promoción no existe.", "not_found");
        audit(s, u, "promotion.delete", id, { ai_tutor_id: s.ai_promotions[i].ai_tutor_id, percent_off: s.ai_promotions[i].percent_off });
        s.ai_promotions.splice(i, 1);
      }),

    guides: (u) =>
      h.read((s) => {
        requireAdmin(s, u);
        return s.topics
          .filter((t) => t.status === "active")
          .map((t) => {
            const g = s.ai_guides.find((x) => x.topic_id === t.id);
            return { topic_id: t.id, name: t.name, has_guide: !!g, updated_at: g?.updated_at ?? null };
          })
          .sort((a, b) => a.name.localeCompare(b.name, "es"));
      }),

    guide: (u, topicId) =>
      h.read((s) => {
        requireAdmin(s, u);
        return guideView(s, topicId);
      }),

    saveGuide: (u, topicId, input) =>
      h.write((s) => {
        requireAdmin(s, u);
        const topic = s.topics.find((t) => t.id === topicId);
        if (!topic) throw new ApiError("Ese tema no existe.", "not_found");
        const clean = {} as TopicGuide;
        for (const f of ["objectives", "steps", "common_mistakes", "checks"] as const) {
          clean[f] = (input[f] ?? "").trim();
          if (clean[f].length > GUIDE_FIELD_MAX) throw new ApiError(`Cada campo admite hasta ${GUIDE_FIELD_MAX} caracteres.`);
        }
        if (!Object.values(clean).some(Boolean)) throw new ApiError("Escribe al menos un campo de la guía.");
        const row = s.ai_guides.find((g) => g.topic_id === topicId);
        audit(s, u, "guide.save", topicId, { topic: topic.name, created: !row, chars: Object.values(clean).reduce((n, v) => n + v.length, 0) });
        if (row) Object.assign(row, clean, { updated_at: h.now() });
        else s.ai_guides.push({ topic_id: topicId, ...clean, updated_at: h.now() });
        return guideView(s, topicId);
      }),

    deleteGuide: (u, topicId) =>
      h.write((s) => {
        requireAdmin(s, u);
        const topic = s.topics.find((t) => t.id === topicId);
        if (!topic) throw new ApiError("Ese tema no existe.", "not_found");
        audit(s, u, "guide.delete", topicId, { topic: topic.name });
        s.ai_guides = s.ai_guides.filter((g) => g.topic_id !== topicId);
      }),
  };
}
