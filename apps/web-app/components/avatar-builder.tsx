"use client";

// Creador de avatar: piezas base y accesorios de regalo del catálogo gratis (lib/avatar-catalog).
// Lo que se compra en la tienda se equipa allá; aquí solo se arma la figura de partida. La vista
// previa incluye lo equipado de la tienda; elegir una pieza en un slot ocupado por una compra la
// desequipa al guardar (manda la última elección).

import Link from "next/link";
import { useState } from "react";
import { Check, ShoppingBag } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { btn } from "@/components/bits";
import { useMutation, useSession } from "@/components/providers";
import { api } from "@/lib/api";
import {
  BASE_CATEGORIES,
  CLOTHES_COLORS,
  DEFAULT_AVATAR,
  HAIR_COLORS,
  SKIN_TONES,
  STARTER_ACCESSORIES,
} from "@/lib/avatar-catalog";
import { isSpriteSkin, spriteSlot } from "@/lib/skins";
import type { AvatarConfig, Equipped } from "@/lib/types";
import { cn } from "@/lib/utils";

type Tab = "piel" | "hr" | "ch" | "lg" | "sh" | "acc";

const TABS: { id: Tab; label: string }[] = [
  { id: "piel", label: "Piel" },
  ...BASE_CATEGORIES.map((c) => ({ id: c.slot, label: c.label })),
  { id: "acc", label: "Accesorios" },
];

/** Parte del avatar actual si ya fue armado con el creador; si no, el de partida. */
export function initialAvatar(current: AvatarConfig | undefined): AvatarConfig {
  if (!current?.slots?.hh) return DEFAULT_AVATAR;
  return {
    slots: { ...DEFAULT_AVATAR.slots, ...current.slots },
    skin: current.skin ?? DEFAULT_AVATAR.skin,
    hair: current.hair ?? DEFAULT_AVATAR.hair,
    color: current.color ?? DEFAULT_AVATAR.color,
  };
}

function Swatches({ colors, value, onPick, label }: { colors: string[]; value?: string; onPick: (c: string) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {colors.map((c) => (
        <button
          key={c}
          role="radio"
          aria-checked={value === c}
          aria-label={c}
          onClick={() => onPick(c)}
          className={cn("size-9 rounded-full ring-2 ring-offset-2 transition", value === c ? "ring-primary" : "ring-transparent hover:ring-border")}
          style={{ background: c }}
        />
      ))}
    </div>
  );
}

export function AvatarBuilder({
  initial,
  onDone,
  submitLabel = "Guardar mi avatar",
}: {
  initial: AvatarConfig | undefined;
  onDone: () => void;
  submitLabel?: string;
}) {
  const [config, setConfig] = useState<AvatarConfig>(() => initialAvatar(initial));
  const [tab, setTab] = useState<Tab>("hr");
  const { run, pending } = useMutation();
  const { me } = useSession();
  // Slots que el alumno tocó aquí: ahí lo de la tienda deja de mostrarse (y se desequipa al guardar)
  const [touched, setTouched] = useState<Set<string>>(() => new Set());

  const storeParts = (me?.equipped.parts ?? []).filter((p) => isSpriteSkin(p.meta));
  const equippedWithout = (cleared: Set<string>): Partial<Equipped> => ({
    ...me?.equipped,
    parts: storeParts.filter((p) => !cleared.has(spriteSlot(p.meta))),
  });

  const slots = config.slots ?? {};
  const setSlot = (slot: string, item: string | undefined) => {
    setTouched((t) => new Set(t).add(slot));
    setConfig((c) => {
      const next = { ...c.slots };
      if (item) next[slot as keyof typeof next] = item;
      else delete next[slot as keyof typeof next];
      return { ...c, slots: next };
    });
  };
  const withSlot = (slot: string, item: string): AvatarConfig => ({ ...config, slots: { ...slots, [slot]: item } });
  // Al elegir pelo se quita también el gorro de la miniatura, que si no lo taparía
  const tileEquipped = (slot: string) => equippedWithout(new Set(touched).add(slot).add(slot === "hr" ? "ha" : slot));
  // Mientras una compra ocupe el slot, la pieza del creador no se ve: no se marca como puesta
  const shadowed = (slot: string) => !touched.has(slot) && storeParts.some((p) => spriteSlot(p.meta) === slot);

  const category = BASE_CATEGORIES.find((c) => c.slot === tab);

  async function save() {
    // run devuelve undefined si falló (y ya mostró el aviso de error)
    const ok = await run(async (u) => {
      await api.saveAvatar(u, config);
      const replaced = storeParts.filter((p) => touched.has(spriteSlot(p.meta)));
      await Promise.all(replaced.map((p) => api.equipSkin(u, p.id, false)));
      return true;
    }, "¡Avatar guardado!");
    if (ok) onDone();
  }

  return (
    <div className="flex flex-col gap-4 sm:flex-row">
      <div className="grid shrink-0 place-items-center rounded-3xl bg-gradient-to-b from-secondary to-muted p-3 sm:w-44">
        {/* Figura entera más alta que su caja (modo campus): el relleno le deja espacio arriba */}
        <div style={{ paddingTop: 110 }}>
          <Avatar config={config} equipped={equippedWithout(touched)} size={110} bare label="Vista previa de tu avatar" />
        </div>
      </div>

      <div className="min-w-0 flex-1 text-left">
        <div role="tablist" aria-label="Partes del avatar" className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "shrink-0 rounded-full px-3 py-1.5 text-sm font-bold transition",
                tab === t.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="mt-3 max-h-[46vh] space-y-3 overflow-y-auto pr-1 sm:max-h-80">
          {tab === "piel" && (
            <Swatches label="Tono de piel" colors={SKIN_TONES} value={config.skin} onPick={(skin) => setConfig((c) => ({ ...c, skin }))} />
          )}

          {category && (
            <>
              {tab === "hr" && (
                <Swatches label="Color de pelo" colors={HAIR_COLORS} value={config.hair} onPick={(hair) => setConfig((c) => ({ ...c, hair }))} />
              )}
              {tab === "ch" && (
                <Swatches label="Color de ropa" colors={CLOTHES_COLORS} value={config.color} onPick={(color) => setConfig((c) => ({ ...c, color }))} />
              )}
              <div role="radiogroup" aria-label={category.label} className="grid grid-cols-4 gap-2">
                {category.options.map((o) => {
                  const on = slots[category.slot] === o.item && !shadowed(category.slot);
                  return (
                    <button
                      key={o.item}
                      role="radio"
                      aria-checked={on}
                      onClick={() => setSlot(category.slot, o.item)}
                      className={cn("flex flex-col items-center gap-1 rounded-2xl p-1.5 ring-2 transition", on ? "bg-secondary ring-primary" : "ring-transparent hover:bg-muted")}
                    >
                      <Avatar
                        config={withSlot(category.slot, o.item)}
                        equipped={tileEquipped(category.slot)}
                        size={56}
                        view={category.slot === "lg" || category.slot === "sh" ? "full" : "bust"}
                      />
                      <span className="text-[11px] leading-tight font-bold">{o.label}</span>
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {tab === "acc" && (
            <>
              <p className="text-sm text-muted-foreground">De regalo para empezar. Toca para ponerte o quitarte cada uno.</p>
              <div className="grid grid-cols-4 gap-2">
                {STARTER_ACCESSORIES.map((a) => {
                  const on = slots[a.slot] === a.item && !shadowed(a.slot);
                  return (
                    <button
                      key={a.item}
                      aria-pressed={on}
                      onClick={() => setSlot(a.slot, on ? undefined : a.item)}
                      className={cn("relative flex flex-col items-center gap-1 rounded-2xl p-1.5 ring-2 transition", on ? "bg-secondary ring-primary" : "ring-transparent hover:bg-muted")}
                    >
                      <Avatar config={withSlot(a.slot, a.item)} equipped={tileEquipped(a.slot)} size={56} view={a.slot === "ca" ? "full" : "bust"} />
                      <span className="text-[11px] leading-tight font-bold">{a.label}</span>
                      {on && <Check className="absolute top-1 right-1 size-4 rounded-full bg-primary p-0.5 text-primary-foreground" />}
                    </button>
                  );
                })}
              </div>
              <Link href="/tienda" className={cn(btn.soft, btn.sm, "w-full")}>
                <ShoppingBag className="size-4" /> Más accesorios en la tienda
              </Link>
            </>
          )}
        </div>

        <button onClick={save} disabled={pending} className={cn(btn.primary, btn.md, "mt-4 w-full")}>
          {pending ? "Guardando…" : submitLabel}
        </button>
      </div>
    </div>
  );
}
