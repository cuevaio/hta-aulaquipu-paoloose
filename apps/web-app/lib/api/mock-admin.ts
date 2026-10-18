// Panel de administración en modo mock: mismas reglas que lib/server/admin-handlers.ts
// y las funciones SQL de 003_admin.sql, sobre el estado local del mock.

import type { AdminApi } from "@/lib/api/client";
import { ApiError } from "@/lib/api/client";
import type { DbState } from "@/lib/api/seed";
import type { AdminMetrics } from "@/lib/admin-types";
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

export function buildMockAdmin(h: MockHelpers): AdminApi {


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

  };
}
