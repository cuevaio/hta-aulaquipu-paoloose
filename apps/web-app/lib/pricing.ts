// Precio de las clases IA con promoción. Lo usan el servidor y el mock para que coincidan
// con ai_price_for() en backend/migrations/003_admin.sql.

import type { AiPromoInfo, AiTutor } from "@/lib/types";

/** Precio con descuento: nunca menos de 1 quipu mientras la clase no sea gratis. */
export const discountedPrice = (base: number, percentOff: number) =>
  percentOff > 0 ? Math.max(1, Math.round((base * (100 - percentOff)) / 100)) : base;

export const aiPrice = (t: Pick<AiTutor, "price_quipus" | "effective_price">) => t.effective_price ?? t.price_quipus;

export interface PromoRule {
  ai_tutor_id: string | null;
  percent_off: number;
  first_class_free: boolean;
  starts_at: string;
  ends_at: string;
  active: boolean;
}

/** Calcula precio efectivo y promoción visible de un tutor IA para un alumno. */
export function priceWithPromos(
  tutor: AiTutor,
  promos: PromoRule[],
  firstAiClass: boolean,
  at: Date = new Date(),
): AiTutor {
  const t = at.getTime();
  const live = promos.filter(
    (p) => p.active && Date.parse(p.starts_at) <= t && Date.parse(p.ends_at) > t && (!p.ai_tutor_id || p.ai_tutor_id === tutor.id),
  );
  if (!live.length) return { ...tutor, effective_price: tutor.price_quipus, promo: null };
  const best = live.reduce((a, b) => (b.percent_off > a.percent_off ? b : a));
  const free = firstAiClass && live.some((p) => p.first_class_free);
  const effective = free ? 0 : discountedPrice(tutor.price_quipus, best.percent_off);
  if (effective >= tutor.price_quipus) return { ...tutor, effective_price: tutor.price_quipus, promo: null };
  const promo: AiPromoInfo = {
    percent_off: free ? 100 : best.percent_off,
    first_class_free: free,
    ends_at: (free ? live.find((p) => p.first_class_free)! : best).ends_at,
  };
  return { ...tutor, effective_price: effective, promo };
}
