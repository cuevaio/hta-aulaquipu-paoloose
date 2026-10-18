"use client";

import { useState } from "react";
import { Bell, BellOff, Check } from "lucide-react";
import { askNotify, useNotifyState } from "@/lib/notify";
import { btn } from "@/components/bits";
import { cn } from "@/lib/utils";

/** Botón para activar los avisos nativos del navegador ("tu profe está listo"). */
export function NotifyPrompt({ className, label = "Avísame cuando mi profe esté listo" }: { className?: string; label?: string }) {
  const state = useNotifyState();
  const [busy, setBusy] = useState(false);

  if (state === "unsupported") return null;
  if (state === "granted")
    return (
      <p className={cn("flex items-center justify-center gap-1.5 text-sm font-bold text-accent-foreground", className)}>
        <Check className="size-4" /> Avisos activados: te avisamos cuando tu profe esté listo
      </p>
    );
  if (state === "denied")
    return (
      <p className={cn("flex items-center justify-center gap-1.5 text-center text-xs font-semibold text-muted-foreground", className)}>
        <BellOff className="size-4 shrink-0" /> Sin avisos del navegador: verás las invitaciones aquí, dentro de la app. Puedes activarlos desde el candado de la barra de direcciones.
      </p>
    );
  return (
    <button
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await askNotify();
        setBusy(false);
      }}
      className={cn(btn.soft, btn.md, "w-full", className)}
    >
      <Bell className="size-4" /> {label}
    </button>
  );
}
