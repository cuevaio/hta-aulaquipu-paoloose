// Tipos del panel de administración (/admin y /api/admin/*).

import type { UUID } from "@/lib/types";

export interface AdminMetrics {
  generated_at: string;
  users: { total: number; last24h: number };
  active_today: number;
  classes: { human_total: number; ai_total: number; human_today: number; ai_today: number; live_now: number };
  economy: {
    circulation: number;
    minted: number;
    granted: number;
    adjusted: number;
    spent_sessions: number;
    spent_ai: number;
    spent_shop: number;
    zero_balance_users: number;
    top_earners: { profile_id: UUID; display_name: string; earned: number }[];
  };
  top_topics: { topic_id: UUID; name: string; requests: number }[];
  demand_gaps: { topic_id: UUID; name: string; open_requests: number }[];
  tutor_ranking: { tutor_id: UUID; display_name: string; avg_stars: number; reviews: number; sessions: number }[];
  short_classes: {
    count: number;
    items: { session_id: UUID; topic: string | null; tutor_kind: "human" | "ai"; minutes: number; ended_at: string }[];
  };
  low_reviews: {
    id: UUID;
    stars: number;
    feedback: string | null;
    created_at: string;
    tutor_name: string | null;
    is_ai: boolean;
    topic: string | null;
  }[];
}


export interface AuditRow {
  id: number;
  admin_id: UUID | null;
  admin_name: string | null;
  action: string;
  target: string | null;
  payload: Record<string, unknown>;
  created_at: string;
}

export interface AdminUser {
  id: UUID;
  username: string;
  display_name: string;
  grade: number;
  school: string | null;
  balance: number;
}

export type CreditScope = "user" | "grade" | "school" | "all";

export interface CreditsInput {
  scope: CreditScope;
  value?: string;
  /** Positivo regala (grant), negativo descuenta (adjust). */
  amount: number;
  reason: string;
}

export interface CreditsResult {
  affected: number;
  skipped: number;
}

export interface CreditOptions {
  grades: number[];
  schools: string[];
}

export interface AdminAiTutor {
  id: UUID;
  name: string;
  emoji: string;
  price_quipus: number;
  active: boolean;
}

export interface AiPromotion {
  id: UUID;
  ai_tutor_id: UUID | null;
  percent_off: number;
  starts_at: string;
  ends_at: string;
  first_class_free: boolean;
  active: boolean;
  created_at: string;
}

export type PromotionInput = Omit<AiPromotion, "id" | "created_at">;

// ---------- guías de enseñanza IA ----------

export const GUIDE_FIELD_MAX = 1500;

export interface TopicGuide {
  objectives: string;
  steps: string;
  common_mistakes: string;
  checks: string;
}

export interface AdminGuideTopic {
  topic_id: UUID;
  name: string;
  has_guide: boolean;
  updated_at: string | null;
}

export interface AdminGuide extends TopicGuide {
  topic_id: UUID;
  name: string;
  updated_at: string | null;
}

/** Texto de la guía que viaja al agente (≤ ~4000 caracteres), o null si el tema no tiene guía. */
export function guideToAgentText(g: TopicGuide | null | undefined): string | null {
  if (!g) return null;
  const parts: [string, string][] = [
    ["Objetivos", g.objectives],
    ["Pasos", g.steps],
    ["Errores comunes", g.common_mistakes],
    ["Comprobaciones", g.checks],
  ];
  const text = parts
    .map(([title, body]) => [title, body.trim().slice(0, GUIDE_FIELD_MAX)] as const)
    .filter(([, body]) => body)
    .map(([title, body]) => `${title}:\n${body}`)
    .join("\n\n");
  return text ? text.slice(0, 4000) : null;
}
