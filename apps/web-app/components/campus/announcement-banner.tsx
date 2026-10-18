"use client";

import { Megaphone, X } from "lucide-react";
import { api } from "@/lib/api";
import { useQuery } from "@/components/providers";
import { useFlag, writeFlag } from "@/components/campus/welcome";
import type { ActiveAnnouncement } from "@/lib/types";

/** Banner de anuncios del admin sobre el campus. Cada alumno cierra los suyos (se recuerda por id, sin romper si no hay almacenamiento). */
export function AnnouncementBanner() {
  const { data } = useQuery((u) => api.activeAnnouncements(u));
  if (!data?.length) return null;
  return (
    <div className="pointer-events-none absolute inset-x-0 top-16 z-[58] flex flex-col items-center gap-2 px-3">
      {data.map((a) => (
        <Item key={a.id} a={a} />
      ))}
    </div>
  );
}

function Item({ a }: { a: ActiveAnnouncement }) {
  const key = `aq:announcement:${a.id}`;
  const dismissed = useFlag(key);
  // null = aún sin hidratar: no se muestra para que no parpadee un anuncio ya cerrado
  if (dismissed !== false) return null;
  return (
    <div role="status" className="pointer-events-auto flex max-w-xl items-start gap-2 rounded-2xl bg-gold py-2 pr-2 pl-3 text-sm font-bold text-gold-foreground shadow-lg animate-in fade-in slide-in-from-top-2">
      <Megaphone className="mt-0.5 size-4 shrink-0" aria-hidden />
      <p className="min-w-0 flex-1 break-words">{a.text}</p>
      <button onClick={() => writeFlag(key)} aria-label="Cerrar anuncio" className="grid size-7 shrink-0 place-items-center rounded-full hover:bg-black/10">
        <X className="size-4" />
      </button>
    </div>
  );
}
