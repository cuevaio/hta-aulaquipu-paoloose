"use client";

import { Bell, Radio, X } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { btn } from "@/components/bits";
import { cn } from "@/lib/utils";
import type { ClassAlert } from "@/lib/campus/use-class-alerts";

/** Invitación a una clase: aparece cuando tu profe la agenda o la abre en vivo. */
export function ClassInvite({ alert, onJoin, onDismiss }: { alert: ClassAlert; onJoin: () => void; onDismiss: () => void }) {
  return (
    <div
      role="alert"
      className="absolute top-[4.5rem] right-3 z-[75] w-[min(22rem,calc(100vw-1.5rem))] rounded-2xl bg-card p-3 shadow-2xl ring-2 ring-mint animate-in fade-in slide-in-from-right-4"
    >
      <button onClick={onDismiss} className="absolute top-2 right-2 rounded-full p-1.5 text-muted-foreground hover:bg-muted" aria-label="Cerrar aviso">
        <X className="size-4" />
      </button>
      <div className="flex items-center gap-3 pr-6">
        {alert.tutor ? <Avatar config={alert.tutor.avatar_config} size={44} label={alert.tutor.display_name} /> : <span className="text-3xl">👩‍🏫</span>}
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 font-extrabold leading-tight">
            {alert.live && <Radio className="size-4 shrink-0 text-coral" />}
            {alert.ring && <Bell className="bell-ring-short size-4 shrink-0 text-gold" aria-hidden />}
            {alert.title}
          </p>
          <p className="text-sm text-muted-foreground">{alert.body}</p>
        </div>
      </div>
      <button onClick={onJoin} className={cn(btn.mint, btn.md, "mt-3 w-full")}>
        {alert.cta}
      </button>
    </div>
  );
}
