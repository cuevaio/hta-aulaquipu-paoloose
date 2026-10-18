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

