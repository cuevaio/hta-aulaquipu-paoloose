"use client";

import { useState } from "react";
import { Check, Lock } from "lucide-react";
import { api } from "@/lib/api";
import type { Equipped, Skin, SkinKind } from "@/lib/types";
import { useMutation, useSession } from "@/components/providers";
import { Avatar, DECO_BG } from "@/components/avatar";
import { Card, Quipus, SectionTitle, Skeleton, btn } from "@/components/bits";
import { cn } from "@/lib/utils";

const TABS: { kind: SkinKind; label: string }[] = [
  { kind: "avatar", label: "Accesorios" },
  { kind: "frame", label: "Marcos" },
  { kind: "profile_deco", label: "Fondos" },
];

const ALL_BADGES = [
  { emoji: "🎓", name: "Primer tutor", how: "Da tu primera clase" },
  { emoji: "🔍", name: "Aprendiz curioso", how: "Toma tu primera clase" },
  { emoji: "⭐", name: "Estrella del aula", how: "Promedio 4.5+ con 2 reviews" },
  { emoji: "🪢", name: "Buen administrador", how: "Junta 150 quipus" },
  { emoji: "🏆", name: "10 sesiones enseñadas", how: "Da diez clases" },
];

function withPreview(equipped: Equipped, skin: Skin | null): Equipped {
  if (!skin) return equipped;
  if (skin.kind === "avatar") return { ...equipped, avatar: skin };
  if (skin.kind === "frame") return { ...equipped, frame: skin };
  if (skin.kind === "profile_deco") return { ...equipped, deco: skin };
  return equipped;
}

export default function ShopPage() {
  const { me } = useSession();
  const { run, pending } = useMutation();
  const [tab, setTab] = useState<SkinKind>("avatar");
  const [preview, setPreview] = useState<Skin | null>(null);

  if (!me) return <Skeleton className="h-96" />;

  const shown = withPreview(me.equipped, preview);
  const deco = shown.deco?.meta.deco;
  const earned = new Set(me.badges.map((b) => b.name));

  return (
    <div className="grid grid-cols-1 gap-6 @5xl:grid-cols-[20rem_1fr]">
      {/* Vista previa tipo probador */}
      <div className="@5xl:sticky @5xl:top-8 @5xl:self-start">
        <div className="overflow-hidden rounded-[2rem] ring-1 ring-border">
          <div
            className="grid h-64 place-items-center"
            style={{ background: deco ? DECO_BG[deco] : "linear-gradient(135deg,var(--primary),var(--mint))" }}
          >
            <Avatar config={me.profile.avatar_config} equipped={shown} size={150} className="float" label="Vista previa" />
          </div>
          <div className="flex items-center justify-between bg-card p-4">
            <div>
              <p className="text-xs font-bold text-muted-foreground uppercase">{preview ? "Probándote" : "Tu look"}</p>
              <p className="font-extrabold">{preview?.name ?? me.profile.display_name}</p>
            </div>
            <Quipus amount={me.balance} className="text-lg" />
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <div>
          <h1 className="font-heading text-3xl font-semibold">Tienda</h1>
          <p className="text-muted-foreground">Personaliza tu avatar con los quipus que ganas enseñando.</p>
        </div>

        <div className="flex gap-2 rounded-2xl bg-muted p-1" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.kind}
              role="tab"
              aria-selected={tab === t.kind}
              onClick={() => {
                setTab(t.kind);
                setPreview(null);
              }}
              className={cn("flex-1 rounded-xl py-2 text-sm font-extrabold", tab === t.kind ? "bg-card shadow-sm" : "text-muted-foreground")}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3 @xl:grid-cols-3">
          {me.skins
            .filter((s) => s.kind === tab)
            .map((s) => {
              const short = !s.owned && me.balance < s.price_quipus;
              return (
                <div
                  key={s.id}
                  onMouseEnter={() => setPreview(s)}
                  onMouseLeave={() => setPreview(null)}
                  onFocus={() => setPreview(s)}
                  className={cn(
                    "flex flex-col items-center gap-2 rounded-3xl bg-card p-4 text-center ring-1 ring-border transition-all hover:-translate-y-0.5 hover:shadow-md",
                    s.equipped && "ring-2 ring-mint",
                  )}
                >
                  <div
                    className="grid h-24 w-full place-items-center rounded-2xl"
                    style={{ background: s.meta.deco ? DECO_BG[s.meta.deco] : "var(--muted)" }}
                  >
                    <Avatar config={me.profile.avatar_config} equipped={withPreview(me.equipped, s)} size={64} />
                  </div>
                  <p className="font-extrabold leading-tight">{s.name}</p>
                  {s.owned ? (
                    <button
                      disabled={pending}
                      onClick={() => run((u) => api.equipSkin(u, s.id, !s.equipped))}
                      className={cn(s.equipped ? btn.soft : btn.mint, btn.sm, "w-full")}
                    >
                      {s.equipped ? (
                        <>
                          <Check className="size-4" /> Equipado
                        </>
                      ) : (
                        "Equipar"
                      )}
                    </button>
                  ) : (
                    <button
                      disabled={pending || short}
                      onClick={() => run((u) => api.buySkin(u, s.id), `¡Compraste ${s.name}!`)}
                      className={cn(btn.gold, btn.sm, "w-full")}
                      title={short ? "No te alcanzan los quipus" : undefined}
                    >
                      {s.price_quipus === 0 ? "Gratis" : <Quipus amount={s.price_quipus} iconClassName="size-3.5" />}
                    </button>
                  )}
                </div>
              );
            })}
        </div>

        <Card>
          <SectionTitle>Insignias de prestigio</SectionTitle>
          <p className="mb-3 text-sm text-muted-foreground">No se compran: se ganan con logros.</p>
          <div className="grid grid-cols-2 gap-2 @xl:grid-cols-3">
            {ALL_BADGES.map((b) => {
              const got = earned.has(b.name);
              return (
                <div key={b.name} className={cn("flex items-center gap-2 rounded-2xl p-3", got ? "bg-gold/25" : "bg-muted opacity-70")}>
                  <span className={cn("text-2xl", !got && "grayscale")}>{b.emoji}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-extrabold leading-tight">{b.name}</p>
                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                      {!got && <Lock className="size-3" />} {got ? "¡Desbloqueada!" : b.how}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}
