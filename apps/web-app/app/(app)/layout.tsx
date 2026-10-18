import { Suspense } from "react";
import { CampusShell } from "@/components/campus/campus-shell";

// El campus lee la URL (pathname/params) en el cliente: se transmite tras el shell estático.
// Como layout, persiste entre paneles: tu avatar no se mueve de lugar al abrir/cerrar pantallas.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="room-floor min-h-dvh" />}>
      <CampusShell>{children}</CampusShell>
    </Suspense>
  );
}
