"use client";

import { useState } from "react";
import { Eye, EyeOff, Pencil, Plus } from "lucide-react";
import { api } from "@/lib/api";
import { useMutation, useQuery } from "@/components/providers";
import { Avatar } from "@/components/avatar";
import { DECO_BG } from "@/components/avatar";
import { Card, ErrorBox, Pill, Skeleton, btn } from "@/components/bits";
import { Empty, Panel, inputCls } from "@/components/admin/admin-ui";
import type { AdminSkin, SkinInput } from "@/lib/admin-types";
import { SKIN_ACCESSORIES, SKIN_DECOS, SKIN_FRAMES, SKIN_ICONS, SKIN_KINDS, parseSkinMeta } from "@/lib/admin-validate";
import { badgeIcon, decoOf } from "@/lib/skins";
import type { Skin, SkinKind, SkinMeta } from "@/lib/types";
import { cn } from "@/lib/utils";

const ACCESSORY_LABEL: Record<string, string> = { chullo: "Chullo", lentes: "Lentes", corona: "Corona", audifonos: "Audífonos", birrete: "Birrete", flor: "Flor" };
const FRAME_LABEL: Record<string, string> = { basico: "Básico", dorado: "Dorado", arcoiris: "Arcoíris", andino: "Andino" };
const DECO_LABEL: Record<string, string> = { andes: "Andes", cosmos: "Cosmos", selva: "Selva" };
const ICON_LABEL: Record<string, string> = { star: "⭐ Estrella", trophy: "🏆 Trofeo", book: "📚 Libro", quipu: "🪢 Quipu" };

const defaultMeta = (kind: SkinKind): SkinMeta =>
  kind === "avatar" ? { color: "#7C6BF2", accessory: "corona" } : kind === "frame" ? { frame: "dorado" } : kind === "badge" ? { icon: "star" } : { deco: "andes" };

const blank = (): SkinInput => ({ name: "", kind: "avatar", price_quipus: 20, meta: defaultMeta("avatar"), active: true });

const kindLabel = (k: SkinKind) => SKIN_KINDS.find((x) => x.id === k)?.label ?? k;

/** Vista previa con el mismo dibujo de la tienda. */
function Preview({ kind, meta }: { kind: SkinKind; meta: SkinMeta }) {
  const skin = { id: "preview", name: "", kind, price_quipus: 0, meta } as Skin;
  const equipped = { avatar: kind === "avatar" ? skin : null, frame: kind === "frame" ? skin : null, deco: null };
  const deco = kind === "profile_deco" ? decoOf(meta) : undefined;
  return (
    <div className="grid h-20 w-24 shrink-0 place-items-center rounded-2xl bg-muted" style={deco ? { background: DECO_BG[deco] } : undefined}>
      {kind === "badge" ? (
        <span className="text-4xl" aria-hidden>
          {badgeIcon(meta)}
        </span>
      ) : (
        <Avatar config={{ color: "#7C6BF2", shape: "blob" }} equipped={equipped} size={52} />
      )}
    </div>
  );
}

/** Tienda: crear artículos, cambiar precios y ocultarlos. */
export function ShopSection() {
  const skins = useQuery((u) => api.admin.skins(u));
  const [editing, setEditing] = useState<{ id: string | null; input: SkinInput } | null>(null);

  if (skins.error && !skins.data) return <ErrorBox message={skins.error} />;

  return (
    <Panel title="Tienda" hint="Un artículo oculto deja de venderse; quien ya lo compró lo conserva. El tipo no se puede cambiar después de crearlo.">
      <div className="flex justify-end">
        <button onClick={() => setEditing({ id: null, input: blank() })} className={cn(btn.primary, btn.sm)}>
          <Plus className="size-4" /> Nuevo artículo
        </button>
      </div>
      {editing && <SkinEditor key={editing.id ?? "new"} id={editing.id} initial={editing.input} onClose={() => setEditing(null)} />}
      {!skins.data && <Skeleton className="h-32" />}
      {skins.data && !skins.data.length && <Empty>La tienda está vacía.</Empty>}
      <ul className="divide-y divide-border">
        {skins.data?.map((k) => (
          <SkinRow key={k.id} skin={k} onEdit={() => setEditing({ id: k.id, input: { name: k.name, kind: k.kind, price_quipus: k.price_quipus, meta: k.meta, active: k.active } })} />
        ))}
      </ul>
    </Panel>
  );
}

function SkinRow({ skin, onEdit }: { skin: AdminSkin; onEdit: () => void }) {
  const { run, pending } = useMutation();
  return (
    <li className="flex flex-wrap items-center gap-3 py-3">
      <Preview kind={skin.kind} meta={skin.meta} />
      <div className="min-w-0 flex-1">
        <p className={cn("truncate font-extrabold", !skin.active && "text-muted-foreground line-through")}>{skin.name}</p>
        <p className="text-xs text-muted-foreground">
          {kindLabel(skin.kind)} · {skin.price_quipus === 0 ? "Gratis" : `${skin.price_quipus} quipus`} · {skin.owners} {skin.owners === 1 ? "dueño" : "dueños"}
        </p>
      </div>
      {!skin.active && <Pill className="bg-gold/30 text-foreground">Oculto</Pill>}
      <button onClick={onEdit} className={cn(btn.ghost, btn.sm)} aria-label={`Editar ${skin.name}`}>
        <Pencil className="size-4" />
      </button>
      <button
        onClick={() => run((u) => api.admin.saveSkin(u, skin.id, { name: skin.name, kind: skin.kind, price_quipus: skin.price_quipus, meta: skin.meta, active: !skin.active }), skin.active ? `${skin.name} oculto` : `${skin.name} visible`)}
        disabled={pending}
        className={cn(btn.ghost, btn.sm)}
      >
        {skin.active ? (
          <>
            <EyeOff className="size-4" /> Ocultar
          </>
        ) : (
          <>
            <Eye className="size-4" /> Mostrar
          </>
        )}
      </button>
    </li>
  );
}

function SkinEditor({ id, initial, onClose }: { id: string | null; initial: SkinInput; onClose: () => void }) {
  const { run, pending } = useMutation();
  const [f, setF] = useState<SkinInput>(initial);
  const set = <K extends keyof SkinInput>(k: K, v: SkinInput[K]) => setF((x) => ({ ...x, [k]: v }));
  const setMeta = (patch: SkinMeta) => set("meta", { ...f.meta, ...patch });

  const metaCheck = parseSkinMeta(f.kind, f.meta);
  const valid = f.name.trim().length >= 2 && f.price_quipus >= 0 && metaCheck.ok;

  const save = async () => {
    const res = await run((u) => api.admin.saveSkin(u, id, f), id ? "Artículo actualizado" : "Artículo creado");
    if (res) onClose();
  };

  return (
    <Card className="space-y-4 bg-secondary/50">
      <div className="flex items-center gap-3">
        <Preview kind={f.kind} meta={f.meta} />
        <h3 className="font-heading text-base font-semibold">{id ? "Editar artículo" : "Nuevo artículo"}</h3>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm font-bold">
          Nombre
          <input value={f.name} onChange={(e) => set("name", e.target.value)} maxLength={40} className={inputCls} />
        </label>
        <label className="space-y-1 text-sm font-bold">
          Precio (quipus, 0 = gratis)
          <input value={f.price_quipus} onChange={(e) => set("price_quipus", Number(e.target.value.replace(/\D/g, "").slice(0, 4)) || 0)} inputMode="numeric" className={inputCls} />
        </label>
        <label className="space-y-1 text-sm font-bold">
          Tipo
          <select
            value={f.kind}
            disabled={!!id}
            onChange={(e) => {
              const kind = e.target.value as SkinKind;
              setF((x) => ({ ...x, kind, meta: defaultMeta(kind) }));
            }}
            className={inputCls}
          >
            {SKIN_KINDS.map((k) => (
              <option key={k.id} value={k.id}>
                {k.label}
              </option>
            ))}
          </select>
        </label>

        {f.kind === "avatar" && (
          <>
            <label className="space-y-1 text-sm font-bold">
              Color del avatar
              <span className="flex gap-2">
                <input type="color" value={/^#[0-9a-fA-F]{6}$/.test(f.meta.color ?? "") ? f.meta.color : "#7C6BF2"} onChange={(e) => setMeta({ color: e.target.value })} className="h-11 w-14 shrink-0 rounded-2xl bg-card p-1 ring-1 ring-border" aria-label="Elegir color" />
                <input value={f.meta.color ?? ""} onChange={(e) => setMeta({ color: e.target.value })} maxLength={7} placeholder="#7C6BF2" className={inputCls} />
              </span>
            </label>
            <label className="space-y-1 text-sm font-bold">
              Accesorio
              <select value={f.meta.accessory ?? ""} onChange={(e) => setMeta({ accessory: (e.target.value || undefined) as SkinMeta["accessory"] })} className={inputCls}>
                <option value="">Ninguno</option>
                {SKIN_ACCESSORIES.map((a) => (
                  <option key={a} value={a}>
                    {ACCESSORY_LABEL[a]}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}
        {f.kind === "frame" && (
          <label className="space-y-1 text-sm font-bold">
            Estilo del marco
            <select value={f.meta.frame ?? ""} onChange={(e) => setF((x) => ({ ...x, meta: { frame: e.target.value as SkinMeta["frame"] } }))} className={inputCls}>
              {SKIN_FRAMES.map((a) => (
                <option key={a} value={a}>
                  {FRAME_LABEL[a]}
                </option>
              ))}
            </select>
          </label>
        )}
        {f.kind === "badge" && (
          <label className="space-y-1 text-sm font-bold">
            Ícono
            <select value={f.meta.icon ?? ""} onChange={(e) => setF((x) => ({ ...x, meta: { icon: e.target.value } }))} className={inputCls}>
              {SKIN_ICONS.map((a) => (
                <option key={a} value={a}>
                  {ICON_LABEL[a]}
                </option>
              ))}
            </select>
          </label>
        )}
        {f.kind === "profile_deco" && (
          <label className="space-y-1 text-sm font-bold">
            Fondo
            <select value={f.meta.deco ?? ""} onChange={(e) => setF((x) => ({ ...x, meta: { deco: e.target.value as SkinMeta["deco"] } }))} className={inputCls}>
              {SKIN_DECOS.map((a) => (
                <option key={a} value={a}>
                  {DECO_LABEL[a]}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="flex items-center gap-2 text-sm font-bold sm:col-span-2">
          <input type="checkbox" checked={f.active} onChange={(e) => set("active", e.target.checked)} className="size-4" />
          Visible en la tienda
        </label>
      </div>
      {!metaCheck.ok && <p className="text-xs font-semibold text-destructive">{metaCheck.error}</p>}
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
