"use client";

import { useState } from "react";
import { Pencil, Plus, Tag, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { useMutation, useQuery } from "@/components/providers";
import { AiAvatar } from "@/components/avatar";
import { Card, ErrorBox, Pill, Skeleton, btn, formatWhen } from "@/components/bits";
import { Empty, PageHeader, Panel, inputCls } from "@/components/admin/admin-ui";
import type { AdminAiTutor, AiPromotion, PromotionInput } from "@/lib/admin-types";
import { discountedPrice } from "@/lib/pricing";
import { cn } from "@/lib/utils";

/** datetime-local usa la hora local sin zona: se convierte desde/hacia ISO. */
const toLocalInput = (iso: string) => {
  const d = new Date(iso);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};

const blank = (): PromotionInput => ({
  ai_tutor_id: null,
  percent_off: 20,
  first_class_free: false,
  starts_at: new Date().toISOString(),
  ends_at: new Date(Date.now() + 7 * 86400_000).toISOString(),
  active: true,
});

/** Precios IA: precio de lista por tutor y promociones (descuento y primera clase gratis). */
export default function AdminAiPricingPage() {
  const tutors = useQuery((u) => api.admin.aiTutors(u));
  const promos = useQuery((u) => api.admin.promotions(u));
  const [editing, setEditing] = useState<{ id: string | null; input: PromotionInput } | null>(null);

  if (tutors.error && !tutors.data) return <ErrorBox message={tutors.error} />;
  const nameOf = (id: string | null) => (id ? (tutors.data?.find((t) => t.id === id)?.name ?? "Tutor IA") : "Todos los tutores IA");

  return (
    <div className="space-y-6">
      <PageHeader title="Precios IA" subtitle="El precio de lista cambia las próximas reservas; las clases ya reservadas conservan el precio con el que se pidieron." />

      <Panel title="Precio de lista por tutor">
        {!tutors.data && <Skeleton className="h-32" />}
        <ul className="divide-y divide-border">
          {tutors.data?.map((t) => <PriceRow key={t.id} tutor={t} />)}
        </ul>
      </Panel>

      <Panel
        title="Promociones"
        hint="Se aplican solas a quien reserve mientras estén vigentes. Si hay varias, gana el mayor descuento. “Primera clase gratis” solo vale para alumnos que nunca tuvieron una clase IA."
      >
        <div className="flex justify-end">
          <button onClick={() => setEditing({ id: null, input: blank() })} className={cn(btn.primary, btn.sm)}>
            <Plus className="size-4" /> Nueva promoción
          </button>
        </div>

        {editing && <PromoEditor key={editing.id ?? "new"} tutors={tutors.data ?? []} initial={editing.input} id={editing.id} onClose={() => setEditing(null)} />}

        {!promos.data && <Skeleton className="h-24" />}
        {promos.data && !promos.data.length && <Empty>No hay promociones. Crea una para impulsar las clases IA.</Empty>}
        <ul className="space-y-2">
          {promos.data?.map((p) => (
            <PromoRow key={p.id} promo={p} tutorName={nameOf(p.ai_tutor_id)} onEdit={() => setEditing({ id: p.id, input: p })} />
          ))}
        </ul>
      </Panel>
    </div>
  );
}

function PriceRow({ tutor }: { tutor: AdminAiTutor }) {
  const { run, pending } = useMutation();
  const [draft, setDraft] = useState(String(tutor.price_quipus));
  const price = Number(draft);
  const valid = Number.isInteger(price) && price >= 1 && price <= 500;
  const changed = valid && price !== tutor.price_quipus;
  const [shown, setShown] = useState(tutor.price_quipus);
  // Si el servidor devuelve otro precio (recarga), el borrador lo sigue
  if (shown !== tutor.price_quipus) {
    setShown(tutor.price_quipus);
    setDraft(String(tutor.price_quipus));
  }

  return (
    <li className="flex flex-wrap items-center gap-3 py-3">
      <AiAvatar emoji={tutor.emoji} color="#7C6BF2" size={40} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-extrabold">{tutor.name}</p>
        <p className="text-xs text-muted-foreground">Precio actual: {tutor.price_quipus} quipus</p>
      </div>
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value.replace(/\D/g, "").slice(0, 3))}
        inputMode="numeric"
        aria-label={`Precio de ${tutor.name}`}
        aria-invalid={!valid}
        className={cn(inputCls, "w-24 text-center")}
      />
      <button
        onClick={() => run((u) => api.admin.setAiPrice(u, tutor.id, price), `Precio de ${tutor.name}: ${price} quipus`)}
        disabled={!changed || pending}
        className={cn(btn.primary, btn.sm)}
      >
        Guardar
      </button>
    </li>
  );
}

function PromoRow({ promo, tutorName, onEdit }: { promo: AiPromotion; tutorName: string; onEdit: () => void }) {
  const { run, pending } = useMutation();
  const [nowMs] = useState(() => Date.now());
  const live = promo.active && Date.parse(promo.starts_at) <= nowMs && Date.parse(promo.ends_at) > nowMs;
  const state = !promo.active ? "Pausada" : live ? "Vigente" : Date.parse(promo.ends_at) <= nowMs ? "Terminada" : "Programada";
  return (
    <li className="flex flex-wrap items-center gap-3 rounded-2xl bg-muted/50 p-3">
      <Tag className="size-5 shrink-0 text-primary" />
      <div className="min-w-0 flex-1">
        <p className="font-bold">
          {promo.percent_off > 0 && `−${promo.percent_off}%`}
          {promo.percent_off > 0 && promo.first_class_free && " · "}
          {promo.first_class_free && "Primera clase gratis"} <span className="font-medium text-muted-foreground">en {tutorName}</span>
        </p>
        <p className="text-xs text-muted-foreground">
          {formatWhen(promo.starts_at)} → {formatWhen(promo.ends_at)}
        </p>
      </div>
      <Pill className={cn(live && "bg-mint/30 text-accent-foreground", !live && "bg-muted text-muted-foreground")}>{state}</Pill>
      <button onClick={onEdit} className={cn(btn.ghost, btn.sm)} aria-label="Editar promoción">
        <Pencil className="size-4" />
      </button>
      <button
        onClick={() => confirm("¿Eliminar esta promoción?") && run((u) => api.admin.deletePromotion(u, promo.id), "Promoción eliminada")}
        disabled={pending}
        className={cn(btn.ghost, btn.sm, "text-destructive")}
        aria-label="Eliminar promoción"
      >
        <Trash2 className="size-4" />
      </button>
    </li>
  );
}

function PromoEditor({ tutors, initial, id, onClose }: { tutors: AdminAiTutor[]; initial: PromotionInput; id: string | null; onClose: () => void }) {
  const { run, pending } = useMutation();
  const [f, setF] = useState<PromotionInput>(initial);
  const set = <K extends keyof PromotionInput>(k: K, v: PromotionInput[K]) => setF((x) => ({ ...x, [k]: v }));

  const startOk = !Number.isNaN(Date.parse(f.starts_at));
  const endOk = !Number.isNaN(Date.parse(f.ends_at)) && Date.parse(f.ends_at) > Date.parse(f.starts_at);
  const valid = startOk && endOk && (f.percent_off > 0 || f.first_class_free);

  const example = tutors.find((t) => t.id === f.ai_tutor_id) ?? tutors[0];

  const save = async () => {
    const res = await run((u) => api.admin.savePromotion(u, id, f), id ? "Promoción actualizada" : "Promoción creada");
    if (res) onClose();
  };

  return (
    <Card className="space-y-4 bg-secondary/50">
      <h3 className="font-heading text-base font-semibold">{id ? "Editar promoción" : "Nueva promoción"}</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm font-bold">
          Tutor
          <select value={f.ai_tutor_id ?? ""} onChange={(e) => set("ai_tutor_id", e.target.value || null)} className={inputCls}>
            <option value="">Todos los tutores IA</option>
            {tutors.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm font-bold">
          Descuento (%)
          <input
            value={f.percent_off}
            onChange={(e) => set("percent_off", Math.min(100, Number(e.target.value.replace(/\D/g, "")) || 0))}
            inputMode="numeric"
            className={inputCls}
          />
          {example && f.percent_off > 0 && (
            <span className="block text-xs font-medium text-muted-foreground">
              {example.name}: {example.price_quipus} → {discountedPrice(example.price_quipus, f.percent_off)} quipus
            </span>
          )}
        </label>
        <label className="space-y-1 text-sm font-bold">
          Empieza
          <input type="datetime-local" value={startOk ? toLocalInput(f.starts_at) : ""} onChange={(e) => e.target.value && set("starts_at", new Date(e.target.value).toISOString())} className={inputCls} />
        </label>
        <label className="space-y-1 text-sm font-bold">
          Termina
          <input type="datetime-local" value={!Number.isNaN(Date.parse(f.ends_at)) ? toLocalInput(f.ends_at) : ""} onChange={(e) => e.target.value && set("ends_at", new Date(e.target.value).toISOString())} className={inputCls} aria-invalid={!endOk} />
        </label>
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm font-bold">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={f.first_class_free} onChange={(e) => set("first_class_free", e.target.checked)} className="size-4" />
          Primera clase IA gratis
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={f.active} onChange={(e) => set("active", e.target.checked)} className="size-4" />
          Activa
        </label>
      </div>
      {!endOk && <p className="text-xs font-semibold text-destructive">La promoción debe terminar después de empezar.</p>}
      {endOk && !valid && <p className="text-xs font-semibold text-destructive">Indica un descuento o marca la primera clase gratis.</p>}
      <div className="flex gap-2">
        <button onClick={save} disabled={!valid || pending} className={cn(btn.primary, btn.md)}>
          {pending ? "Guardando…" : "Guardar"}
        </button>
        <button onClick={onClose} className={cn(btn.ghost, btn.md)}>
          Cancelar
        </button>
      </div>
    </Card>
  );
}
