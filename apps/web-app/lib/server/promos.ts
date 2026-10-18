// Promociones de precio de los tutores IA aplicadas al listado (la reserva real las aplica
// ai_price_for() en la base). Tolera que la migración 003 aún no esté aplicada.

import { db, isMissingSchema } from "@/lib/server/core";
import { priceWithPromos, type PromoRule } from "@/lib/pricing";
import type { AiTutor } from "@/lib/types";

export async function activePromos(): Promise<PromoRule[]> {
  const nowIso = new Date().toISOString();
  const { data, error } = await db()
    .from("ai_promotions")
    .select("ai_tutor_id, percent_off, first_class_free, starts_at, ends_at, active")
    .eq("active", true)
    .lte("starts_at", nowIso)
    .gt("ends_at", nowIso);
  if (error) {
    if (isMissingSchema(error)) return [];
    console.error("[api] no se pudieron leer las promociones", error.code, error.message);
    return [];
  }
  return (data ?? []) as PromoRule[];
}

/** Primera clase IA = el alumno nunca reservó una (las gratis no dejan asiento en el ledger). */
async function isFirstAiClass(userId: string): Promise<boolean> {
  const { count } = await db()
    .from("sessions")
    .select("id", { count: "exact", head: true })
    .eq("student_id", userId)
    .eq("tutor_kind", "ai")
    .neq("status", "cancelled");
  return (count ?? 0) === 0;
}

export async function applyPromos(userId: string, ais: AiTutor[]): Promise<AiTutor[]> {
  const promos = await activePromos();
  if (!promos.length) return ais.map((a) => ({ ...a, effective_price: a.price_quipus, promo: null }));
  const first = promos.some((p) => p.first_class_free) ? await isFirstAiClass(userId) : false;
  return ais.map((a) => priceWithPromos(a, promos, first));
}
