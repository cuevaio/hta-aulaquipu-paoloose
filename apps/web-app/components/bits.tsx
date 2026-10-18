import Link from "next/link";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

/** Ícono del quipu: una cuerda con nudos. */
export function QuipuIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn("size-4", className)} aria-hidden>
      <circle cx="12" cy="12" r="11" fill="var(--gold)" />
      <circle cx="12" cy="12" r="11" fill="none" stroke="var(--gold-foreground)" strokeOpacity=".35" strokeWidth="1.5" />
      <path d="M6 7h12" stroke="var(--gold-foreground)" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M8.5 7v10M12 7v8M15.5 7v11" stroke="var(--gold-foreground)" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="8.5" cy="11" r="1.4" fill="var(--gold-foreground)" />
      <circle cx="12" cy="13" r="1.4" fill="var(--gold-foreground)" />
      <circle cx="15.5" cy="10" r="1.4" fill="var(--gold-foreground)" />
      <circle cx="15.5" cy="14.5" r="1.4" fill="var(--gold-foreground)" />
    </svg>
  );
}

export function Quipus({
  amount,
  className,
  iconClassName,
  sign,
}: {
  amount: number;
  className?: string;
  iconClassName?: string;
  sign?: "+" | "−";
}) {
  return (
    <span className={cn("inline-flex items-center gap-1 font-extrabold tabular-nums", className)}>
      <QuipuIcon className={iconClassName} />
      {sign}
      {amount}
      <span className="sr-only"> quipus</span>
    </span>
  );
}

export function Stars({ value, count, className }: { value: number; count?: number; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 text-sm font-bold", className)}>
      <Star className="size-4 fill-gold text-gold" />
      {value > 0 ? value.toFixed(1) : "Nuevo"}
      {count !== undefined && <span className="font-medium text-muted-foreground">· {count} clases</span>}
    </span>
  );
}

export function Card({ className, children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("rounded-3xl bg-card p-5 shadow-[0_2px_0_0_var(--border)] ring-1 ring-border", className)} {...rest}>
      {children}
    </div>
  );
}

export function SectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-2">
      <h2 className="font-heading text-lg font-semibold">{children}</h2>
      {action}
    </div>
  );
}

export function Pill({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-0.5 text-xs font-bold text-secondary-foreground", className)}>
      {children}
    </span>
  );
}

const btnBase =
  "inline-flex items-center justify-center gap-2 rounded-2xl font-extrabold transition-all select-none disabled:pointer-events-none disabled:opacity-50 active:translate-y-px focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/30";

export const btn = {
  primary: cn(btnBase, "bg-primary text-primary-foreground shadow-[0_3px_0_0_oklch(0.4_0.2_282)] hover:brightness-110"),
  mint: cn(btnBase, "bg-mint text-accent-foreground shadow-[0_3px_0_0_var(--mint-deep)] hover:brightness-105"),
  gold: cn(btnBase, "bg-gold text-gold-foreground shadow-[0_3px_0_0_oklch(0.7_0.15_80)] hover:brightness-105"),
  soft: cn(btnBase, "bg-secondary text-secondary-foreground hover:bg-[color-mix(in_oklch,var(--secondary),var(--primary)_10%)]"),
  ghost: cn(btnBase, "text-muted-foreground hover:bg-muted hover:text-foreground"),
  danger: cn(btnBase, "bg-destructive text-white shadow-[0_3px_0_0_oklch(0.45_0.2_22)] hover:brightness-110"),
  sm: "h-9 px-3 text-sm",
  md: "h-11 px-5 text-sm",
  lg: "h-14 px-6 text-base",
};

export function LinkButton({
  href,
  variant = "primary",
  size = "md",
  className,
  children,
}: {
  href: string;
  variant?: "primary" | "mint" | "gold" | "soft" | "ghost";
  size?: "sm" | "md" | "lg";
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} className={cn(btn[variant], btn[size], className)}>
      {children}
    </Link>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-2xl bg-muted", className)} />;
}

export function ErrorBox({ message }: { message: string }) {
  return (
    <div className="rounded-2xl bg-destructive/10 p-4 text-sm font-semibold text-destructive" role="alert">
      {message}
    </div>
  );
}

export const LEVEL_LABEL = { basico: "Básico", intermedio: "Intermedio", avanzado: "Avanzado" } as const;

export function formatWhen(iso: string | null) {
  if (!iso) return "Por coordinar";
  return new Intl.DateTimeFormat("es-PE", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(
    new Date(iso),
  );
}

/** Fecha en lenguaje de todos los días: "hoy 5:00 p. m.", "mañana 4:00 p. m.", "sáb 18 oct, 10:00 a. m." */
export function friendlyWhen(iso: string | null): string {
  if (!iso) return "Por coordinar";
  const d = new Date(iso);
  const hour = new Intl.DateTimeFormat("es-PE", { hour: "numeric", minute: "2-digit" }).format(d);
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((day(d) - day(new Date())) / 86_400_000);
  if (diffDays === 0) return `hoy ${hour}`;
  if (diffDays === 1) return `mañana ${hour}`;
  if (diffDays > 1 && diffDays < 7)
    return `${new Intl.DateTimeFormat("es-PE", { weekday: "long" }).format(d)} ${hour}`;
  return `${new Intl.DateTimeFormat("es-PE", { weekday: "short", day: "numeric", month: "short" }).format(d)}, ${hour}`;
}

export function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "hace un momento";
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`;
  return `hace ${Math.floor(diff / 86400)} d`;
}
