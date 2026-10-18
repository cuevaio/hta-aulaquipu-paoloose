"use client";

import { useState } from "react";
import { Gift, MinusCircle, Search, Users } from "lucide-react";
import { api } from "@/lib/api";
import { useMutation, useQuery } from "@/components/providers";
import { Card, Quipus, Skeleton, btn } from "@/components/bits";
import { Empty, PageHeader, fmt, inputCls } from "@/components/admin/admin-ui";
import type { AdminUser, CreditScope } from "@/lib/admin-types";
import { cn } from "@/lib/utils";

const SCOPES: { id: CreditScope; label: string }[] = [
  { id: "user", label: "Un alumno" },
  { id: "grade", label: "Un grado" },
  { id: "school", label: "Un colegio" },
  { id: "all", label: "Todos" },
];

/** Créditos: regalar o descontar quipus con motivo. Todo queda en el ledger y en la auditoría. */
export default function AdminCreditsPage() {
  const { run, pending } = useMutation();
  const options = useQuery((u) => api.admin.creditOptions(u));

  const [scope, setScope] = useState<CreditScope>("user");
  const [value, setValue] = useState("");
  const [mode, setMode] = useState<"grant" | "adjust">("grant");
  const [amount, setAmount] = useState("50");
  const [reason, setReason] = useState("");
  const [confirming, setConfirming] = useState(false);

  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState<AdminUser | null>(null);
  const found = useQuery((u) => (search.trim().length >= 2 ? api.admin.searchUsers(u, search) : Promise.resolve([] as AdminUser[])), [search]);

  const pickScope = (s: CreditScope) => {
    setScope(s);
    setValue("");
    setPicked(null);
    setSearch("");
    setConfirming(false);
  };

  const amountNum = Number(amount);
  const amountOk = Number.isInteger(amountNum) && amountNum >= 1 && amountNum <= 10_000;
  const reasonOk = reason.trim().length >= 3 && reason.trim().length <= 140;
  const target = scope === "all" ? "" : scope === "user" ? (picked?.id ?? "") : value;
  const ready = amountOk && reasonOk && (scope === "all" || !!target);

  const preview = useQuery((u) => (ready ? api.admin.creditsPreview(u, scope, target) : Promise.resolve(null)), [ready, scope, target]);
  const count = preview.data?.count;
  const signed = mode === "grant" ? amountNum : -amountNum;

  const who =
    scope === "all"
      ? "todos los alumnos"
      : scope === "user"
        ? (picked?.display_name ?? "")
        : scope === "grade"
          ? `${value}º grado`
          : value;

  const submit = async () => {
    const res = await run((u) => api.admin.grantCredits(u, { scope, value: scope === "all" ? undefined : target, amount: signed, reason: reason.trim() }));
    if (!res) return;
    setConfirming(false);
    setReason("");
    setPicked(null);
    setSearch("");
    // El resultado se muestra en el panel de abajo
    setDone(res);
  };
  const [done, setDone] = useState<{ affected: number; skipped: number } | null>(null);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Créditos"
        subtitle="Regala quipus (bienvenida de un grupo, premios, compensaciones) o descuenta por un error. Un descuento nunca deja un saldo negativo: esos alumnos se omiten."
      />

      <Card className="space-y-5">
        <fieldset className="space-y-2">
          <legend className="text-sm font-extrabold">¿A quién?</legend>
          <div className="flex flex-wrap gap-2">
            {SCOPES.map((s) => (
              <button
                key={s.id}
                onClick={() => pickScope(s.id)}
                aria-pressed={scope === s.id}
                className={cn(btn.sm, btn.soft, scope === s.id && "bg-primary text-primary-foreground hover:bg-primary")}
              >
                {s.label}
              </button>
            ))}
          </div>

          {scope === "user" && (
            <div className="space-y-2">
              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={picked ? picked.display_name : search}
                  onChange={(e) => {
                    setPicked(null);
                    setSearch(e.target.value);
                  }}
                  placeholder="Busca por nombre o usuario (mín. 2 letras)"
                  className={cn(inputCls, "pl-10")}
                  aria-label="Buscar alumno"
                />
              </div>
              {!picked && found.data && found.data.length > 0 && (
                <ul className="divide-y divide-border overflow-hidden rounded-2xl ring-1 ring-border">
                  {found.data.map((u) => (
                    <li key={u.id}>
                      <button onClick={() => setPicked(u)} className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left hover:bg-muted">
                        <span className="min-w-0">
                          <span className="block truncate font-bold">{u.display_name}</span>
                          <span className="block truncate text-xs text-muted-foreground">
                            @{u.username} · {u.grade}º · {u.school ?? "Sin colegio"}
                          </span>
                        </span>
                        <Quipus amount={u.balance} className="shrink-0 text-sm" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {!picked && search.trim().length >= 2 && found.data && !found.data.length && <Empty>Sin resultados.</Empty>}
              {picked && (
                <p className="text-sm text-muted-foreground">
                  Saldo actual de {picked.display_name}: <b>{picked.balance}</b> quipus.
                </p>
              )}
            </div>
          )}

          {scope === "grade" && (
            <select value={value} onChange={(e) => setValue(e.target.value)} className={inputCls} aria-label="Grado">
              <option value="">Elige un grado</option>
              {(options.data?.grades ?? [1, 2, 3, 4, 5]).map((g) => (
                <option key={g} value={g}>
                  {g}º de secundaria
                </option>
              ))}
            </select>
          )}

          {scope === "school" &&
            (options.data ? (
              <select value={value} onChange={(e) => setValue(e.target.value)} className={inputCls} aria-label="Colegio">
                <option value="">Elige un colegio</option>
                {options.data.schools.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            ) : (
              <Skeleton className="h-11" />
            ))}
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <fieldset className="space-y-2">
            <legend className="text-sm font-extrabold">Acción y monto</legend>
            <div className="flex gap-2">
              <button
                onClick={() => setMode("grant")}
                aria-pressed={mode === "grant"}
                className={cn(btn.sm, btn.soft, "flex-1", mode === "grant" && "bg-mint text-accent-foreground hover:bg-mint")}
              >
                <Gift className="size-4" /> Regalar
              </button>
              <button
                onClick={() => setMode("adjust")}
                aria-pressed={mode === "adjust"}
                className={cn(btn.sm, btn.soft, "flex-1", mode === "adjust" && "bg-coral text-white hover:bg-coral")}
              >
                <MinusCircle className="size-4" /> Descontar
              </button>
            </div>
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/\D/g, "").slice(0, 5))}
              inputMode="numeric"
              className={inputCls}
              aria-label="Cantidad de quipus"
              aria-invalid={!!amount && !amountOk}
            />
            <p className="text-xs text-muted-foreground">De 1 a 10 000 quipus por alumno.</p>
          </fieldset>

          <div className="space-y-2">
            <label htmlFor="reason" className="text-sm font-extrabold">
              Motivo (lo verá el alumno en su historial)
            </label>
            <textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value.slice(0, 140))}
              rows={3}
              placeholder="Ej. Premio por la feria de ciencias"
              className={cn(inputCls, "h-auto py-3")}
            />
            <p className="text-right text-xs text-muted-foreground">{reason.trim().length}/140</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-secondary p-4">
          <p className="flex items-center gap-2 text-sm font-bold text-secondary-foreground">
            <Users className="size-4" />
            {!ready ? "Completa los datos para ver a cuántos afectará." : count === undefined ? "Calculando…" : `Afectará a ${fmt(count)} ${count === 1 ? "alumno" : "alumnos"}.`}
          </p>
          <button onClick={() => setConfirming(true)} disabled={!ready || !count || pending} className={cn(btn.primary, btn.md)}>
            Revisar y confirmar
          </button>
        </div>

        {confirming && ready && (
          <div role="alertdialog" aria-label="Confirmar" className="space-y-3 rounded-2xl bg-gold/20 p-4 ring-1 ring-gold/50">
            <p className="font-bold">
              {mode === "grant" ? "Vas a regalar" : "Vas a descontar"} <Quipus amount={amountNum} className="text-base" /> a {who}
              {count && count > 1 ? ` (${fmt(count)} alumnos, ${fmt(count * amountNum)} quipus en total)` : ""}.
            </p>
            <p className="text-sm text-muted-foreground">Motivo: “{reason.trim()}”. Queda registrado en el ledger y en la auditoría; no se puede deshacer, solo compensar.</p>
            <div className="flex gap-2">
              <button onClick={submit} disabled={pending} className={cn(mode === "grant" ? btn.mint : btn.danger, btn.md)}>
                {pending ? "Aplicando…" : "Confirmar"}
              </button>
              <button onClick={() => setConfirming(false)} disabled={pending} className={cn(btn.ghost, btn.md)}>
                Cancelar
              </button>
            </div>
          </div>
        )}
      </Card>

      {done && (
        <Card className="space-y-1 bg-mint/15">
          <p className="font-bold">
            Listo: {fmt(done.affected)} {done.affected === 1 ? "alumno recibió" : "alumnos recibieron"} el cambio.
          </p>
          {done.skipped > 0 && (
            <p className="text-sm text-muted-foreground">
              Se omitieron {fmt(done.skipped)} por no tener saldo suficiente para el descuento.
            </p>
          )}
        </Card>
      )}
    </div>
  );
}
