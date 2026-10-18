"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeft,
  BarChart3,
  BookMarked,
  Coins,
  Flag,
  LayoutGrid,
  Megaphone,
  ScrollText,
  ShieldAlert,
  Sparkles,
  Tags,
} from "lucide-react";
import { api } from "@/lib/api";
import { useQuery, useSession } from "@/components/providers";
import { Logo } from "@/components/logo";
import { Card, LinkButton, Skeleton } from "@/components/bits";
import { cn } from "@/lib/utils";

export const ADMIN_NAV = [
  { href: "/admin", label: "Resumen", icon: LayoutGrid },
  { href: "/admin/economia", label: "Economía", icon: BarChart3 },
  { href: "/admin/creditos", label: "Créditos", icon: Coins },
  { href: "/admin/precios-ia", label: "Precios IA", icon: Tags },
  { href: "/admin/guias-ia", label: "Guías IA", icon: Sparkles },
  { href: "/admin/contenido", label: "Contenido", icon: BookMarked },
  { href: "/admin/moderacion", label: "Moderación", icon: Flag },
  { href: "/admin/anuncios", label: "Anuncios", icon: Megaphone },
  { href: "/admin/auditoria", label: "Auditoría", icon: ScrollText },
];

/** Panel de administración: sidebar en pantallas anchas, pestañas con scroll en móvil. */
export function AdminShell({ children }: { children: React.ReactNode }) {
  const { ready, userId } = useSession();
  const pathname = usePathname();
  // El servidor decide: esta consulta solo sirve para mostrar el mensaje correcto
  const access = useQuery((u) => api.admin.me(u));

  let body: React.ReactNode;
  if (!ready || (userId && !access.data && !access.error)) {
    body = <Skeleton className="h-64" />;
  } else if (!userId) {
    body = <NoAccess title="Inicia sesión" text="El panel es solo para administradores. Entra con tu cuenta." href="/" cta="Ir a iniciar sesión" />;
  } else if (!access.data?.isAdmin) {
    body = <NoAccess title="No tienes acceso" text="Esta sección es solo para administradores de AulaQuipu." href="/campus" cta="Volver al campus" />;
  } else {
    body = children;
  }

  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-card/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <Logo />
            <span className="hidden items-center gap-1 rounded-full bg-navy px-2.5 py-1 text-xs font-extrabold text-white sm:inline-flex">
              <ShieldAlert className="size-3.5 text-mint" /> Admin
            </span>
          </div>
          <Link href="/campus" className="inline-flex items-center gap-1.5 text-sm font-bold text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" /> Campus
          </Link>
        </div>
        <nav aria-label="Secciones del panel" className="mx-auto max-w-6xl overflow-x-auto px-3 md:hidden">
          <ul className="flex gap-1 pb-2">
            {ADMIN_NAV.map((n) => (
              <li key={n.href}>
                <NavLink {...n} pathname={pathname} compact />
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 md:grid-cols-[13rem_minmax(0,1fr)]">
        <nav aria-label="Secciones del panel" className="hidden md:block">
          <ul className="sticky top-20 space-y-1">
            {ADMIN_NAV.map((n) => (
              <li key={n.href}>
                <NavLink {...n} pathname={pathname} />
              </li>
            ))}
          </ul>
        </nav>
        <main className="min-w-0">{body}</main>
      </div>
    </div>
  );
}

function NavLink({
  href,
  label,
  icon: Icon,
  pathname,
  compact,
}: (typeof ADMIN_NAV)[number] & { pathname: string; compact?: boolean }) {
  const active = href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-2 rounded-2xl font-bold whitespace-nowrap transition-colors",
        compact ? "h-9 px-3 text-sm" : "h-10 px-3 text-sm",
        active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      <Icon className="size-4" /> {label}
    </Link>
  );
}

function NoAccess({ title, text, href, cta }: { title: string; text: string; href: string; cta: string }) {
  return (
    <Card className="mx-auto mt-10 max-w-md space-y-4 text-center">
      <ShieldAlert className="mx-auto size-10 text-muted-foreground" />
      <h1 className="font-heading text-2xl font-semibold">{title}</h1>
      <p className="text-sm text-muted-foreground">{text}</p>
      <LinkButton href={href} variant="soft" className="mx-auto">
        {cta}
      </LinkButton>
    </Card>
  );
}
