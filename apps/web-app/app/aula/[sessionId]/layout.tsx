import { Suspense } from "react";

export default function ClassroomLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="room-floor grid min-h-dvh place-items-center text-white">
          <p className="animate-pulse font-heading text-xl">Entrando al aula…</p>
        </div>
      }
    >
      {children}
    </Suspense>
  );
}
