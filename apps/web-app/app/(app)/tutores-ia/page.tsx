"use client";

import { useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { useQuery } from "@/components/providers";
import { AiTutorCard } from "@/components/ai-tutor-card";
import { Skeleton } from "@/components/bits";

export default function AiTutorsPage() {
  const focus = useSearchParams().get("t");
  const { data } = useQuery((u) => api.listAiTutors(u));

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-bold text-primary">✨ Aulas IA</p>
        <h1 className="font-heading text-3xl font-semibold">Tutores IA</h1>
        <p className="mt-1 text-muted-foreground">
          Profesores completos, disponibles a cualquier hora. Hablan, escriben en el documento y grafican mientras te explican.
        </p>
      </div>
      {!data && <Skeleton className="h-40" />}
      <div className="space-y-3">
        {data
          ?.slice()
          .sort((a, b) => Number(b.id === focus) - Number(a.id === focus))
          .map((t) => (
            <AiTutorCard key={`${t.id}-${focus}`} tutor={t} requestId={null} defaultArmed={t.id === focus} />
          ))}
      </div>
    </div>
  );
}
