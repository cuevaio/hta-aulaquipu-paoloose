import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminShell } from "@/components/admin/admin-shell";

export const metadata: Metadata = { title: "Admin · AulaQuipu", robots: { index: false, follow: false } };

// Panel de administración: fuera del campus, con su propio shell. El servidor protege cada
// /api/admin/*; este layout solo decide qué mostrar según el resultado de admin/me.
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-background" />}>
      <AdminShell>{children}</AdminShell>
    </Suspense>
  );
}
