"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { ArrowRight, Compass, X } from "lucide-react";
import { AvatarBuilder } from "@/components/avatar-builder";
import { btn } from "@/components/bits";
import { NotifyPrompt } from "@/components/notify-prompt";
import type { AvatarConfig } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Preferencias del campus por usuario en localStorage. Siempre con try/catch: puede estar bloqueado. */
export function readFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

const FLAG_EVENT = "aq:flag";
// Respaldo en memoria por si localStorage no está disponible (ventana privada, bloqueado)
const memory = new Set<string>();

export function writeFlag(key: string) {
  memory.add(key);
  try {
    localStorage.setItem(key, "1");
  } catch {
    /* sin almacenamiento: vale solo mientras la pestaña siga abierta */
  }
  window.dispatchEvent(new Event(FLAG_EVENT));
}

/** Al iniciar sesión la bienvenida (y con ella el creador de avatar) vuelve a aparecer. */
export function resetWelcome(userId: string) {
  const key = `aq:welcome:${userId}`;
  memory.delete(key);
  try {
    localStorage.removeItem(key);
  } catch {
    /* sin almacenamiento: la marca solo vivía en memoria */
  }
  window.dispatchEvent(new Event(FLAG_EVENT));
}

/** Marca guardada por usuario. En el servidor (y antes de hidratar) devuelve `null` = aún no se sabe. */
export function useFlag(key: string): boolean | null {
  return useSyncExternalStore(
    (cb) => {
      window.addEventListener(FLAG_EVENT, cb);
      return () => window.removeEventListener(FLAG_EVENT, cb);
    },
    () => memory.has(key) || readFlag(key),
    () => null,
  );
}

const STEPS = [
  { emoji: "🪢", title: "Tienes quipus para empezar", body: (balance: number) => `Los quipus son la moneda de AulaQuipu. Ya tienes ${balance} en tu cuenta.` },
  { emoji: "📚", title: "Aprende gastándolos", body: () => "Pide un pedido de ayuda sobre un tema y un tutor o una IA te da la clase. Pagas al terminar." },
  { emoji: "🎓", title: "Enseña para ganar más", body: () => "Si dominas un tema, enséñalo a otros alumnos y recupera quipus para seguir aprendiendo." },
];

/** Ventana del creador de avatar (primer paso de la bienvenida o desde "Mi cuenta"). */
export function AvatarDialog({
  avatar,
  onClose,
  onDone,
  title = "Edita tu avatar",
  subtitle,
  closeLabel = "Cerrar",
}: {
  avatar: AvatarConfig | undefined;
  onClose: () => void;
  onDone?: () => void;
  title?: string;
  subtitle?: string;
  closeLabel?: string;
}) {
  return (
    <div className="absolute inset-0 z-[80] flex items-center justify-center overflow-y-auto bg-navy/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={title}>
      <div className="relative my-auto w-full max-w-2xl min-w-0 rounded-[1.75rem] bg-card p-5 text-center shadow-2xl animate-in fade-in zoom-in-95 sm:p-6">
        <button onClick={onClose} className="absolute top-3 right-3 rounded-full p-2 text-muted-foreground hover:bg-muted" aria-label={closeLabel}>
          <X className="size-4" />
        </button>
        <h2 className="font-heading text-2xl font-semibold">{title}</h2>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
        <div className="mt-4">
          <AvatarBuilder initial={avatar} onDone={onDone ?? onClose} />
        </div>
      </div>
    </div>
  );
}

/**
 * Bienvenida: siempre empieza con el creador de avatar (aunque ya tenga uno); luego 3 pasos
 * que terminan en dos acciones grandes: aprender o enseñar.
 */
export function WelcomeOverlay({
  balance,
  avatar,
  onClose,
}: {
  balance: number;
  avatar: AvatarConfig | undefined;
  onClose: () => void;
}) {
  const [building, setBuilding] = useState(true);
  const [step, setStep] = useState(0);
  if (building) {
    return (
      <AvatarDialog
        avatar={avatar}
        title={avatar?.slots?.hh ? "Elige tu avatar" : "¡Hola! Crea tu avatar"}
        subtitle="Así te verán en el campus y en tus clases. Puedes cambiarlo cuando quieras."
        closeLabel="Seguir con mi avatar"
        onClose={() => setBuilding(false)}
        onDone={() => setBuilding(false)}
      />
    );
  }
  const last = step === STEPS.length - 1;
  const s = STEPS[step];
  return (
    <div className="absolute inset-0 z-[80] grid place-items-center bg-navy/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Bienvenida a AulaQuipu">
      <div className="relative w-full max-w-md rounded-[1.75rem] bg-card p-6 text-center shadow-2xl animate-in fade-in zoom-in-95">
        <button onClick={onClose} className="absolute top-3 right-3 rounded-full p-2 text-muted-foreground hover:bg-muted" aria-label="Cerrar bienvenida">
          <X className="size-4" />
        </button>
        <p className="text-xs font-extrabold tracking-wide text-muted-foreground uppercase">
          Paso {step + 1} de {STEPS.length}
        </p>
        <div className="mt-3 text-6xl" aria-hidden>
          {s.emoji}
        </div>
        <h2 className="mt-3 font-heading text-2xl font-semibold">{s.title}</h2>
        <p className="mt-2 text-muted-foreground">{s.body(balance)}</p>

        <div className="mt-4 flex justify-center gap-1.5" aria-hidden>
          {STEPS.map((_, i) => (
            <span key={i} className={cn("h-2 rounded-full transition-all", i === step ? "w-6 bg-primary" : "w-2 bg-muted")} />
          ))}
        </div>

        {last ? (
          <div className="mt-6 flex flex-col gap-2">
            {/* Pedir el permiso aquí, con un clic del alumno, para que "tu profe está listo" llegue como aviso nativo */}
            <NotifyPrompt label="Avísame cuando mi profe esté listo" className="mb-1" />
            <Link href="/aprender" onClick={onClose} className={cn(btn.primary, btn.lg)}>
              Quiero aprender
            </Link>
            <Link href="/ensenar" onClick={onClose} className={cn(btn.mint, btn.lg)}>
              Quiero enseñar
            </Link>
          </div>
        ) : (
          <button onClick={() => setStep(step + 1)} className={cn(btn.primary, btn.lg, "mt-6 w-full")}>
            Siguiente <ArrowRight className="size-5" />
          </button>
        )}
        <button onClick={onClose} className={cn(btn.ghost, btn.sm, "mt-2")}>
          {last ? "Explorar el campus por mi cuenta" : "Saltar"}
        </button>
      </div>
    </div>
  );
}

/** Tarjeta persistente para quien aún no tiene actividad: lleva directo al primer pedido. */
export function MissionCard({ onDismiss, className }: { onDismiss: () => void; className?: string }) {
  return (
    <div className={cn("pointer-events-auto flex items-center gap-3 rounded-2xl bg-white/95 p-3 shadow-xl animate-in fade-in slide-in-from-top-2", className)}>
      <Compass className="size-6 shrink-0 text-primary" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-extrabold text-muted-foreground">Tu primera misión</p>
        <p className="text-sm leading-snug font-bold text-navy">Ve a la Biblioteca y pide tu primera clase</p>
        <Link href="/aprender" className={cn(btn.primary, btn.sm, "mt-2")}>
          Pedir mi primera clase
        </Link>
      </div>
      <button onClick={onDismiss} aria-label="Ocultar misión" className="self-start rounded-full p-1.5 text-muted-foreground hover:bg-muted">
        <X className="size-4" />
      </button>
    </div>
  );
}
