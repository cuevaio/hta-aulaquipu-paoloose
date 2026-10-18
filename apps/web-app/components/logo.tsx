import { cn } from "@/lib/utils";

export function Logo({ className, light }: { className?: string; light?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-heading text-xl font-semibold", light ? "text-white" : "text-foreground", className)}>
      <span className="grid size-8 place-items-center rounded-xl bg-mint text-navy shadow-[0_3px_0_0_oklch(0.62_0.13_170)]">
        <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
          <path d="M4 6h16" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
          <path d="M7 6v12M12 6v9M17 6v13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <circle cx="7" cy="11" r="1.8" fill="currentColor" />
          <circle cx="12" cy="13" r="1.8" fill="currentColor" />
          <circle cx="17" cy="10" r="1.8" fill="currentColor" />
          <circle cx="17" cy="15" r="1.8" fill="currentColor" />
        </svg>
      </span>
      Aula<span className={light ? "text-mint" : "text-primary"}>Quipu</span>
    </span>
  );
}
