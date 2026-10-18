"use client";

import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, MessageSquarePlus } from "lucide-react";
import { api } from "@/lib/api";
import { useQuery, useSession } from "@/components/providers";
import { ProfileHero } from "@/components/profile-hero";
import { Card, ErrorBox, LEVEL_LABEL, Quipus, SectionTitle, Skeleton, btn } from "@/components/bits";
import { cn } from "@/lib/utils";

export default function TutorPublicProfilePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { userId } = useSession();
  const { data, error } = useQuery(() => api.tutorProfile(id), [id]);

  if (error) return <ErrorBox message={error} />;
  if (!data) return <Skeleton className="h-72" />;

  return (
    <div className="space-y-6">
      <button onClick={() => router.back()} className={cn(btn.ghost, btn.sm, "-ml-2")}>
        <ArrowLeft className="size-4" /> Volver
      </button>
      <ProfileHero profile={data.profile} equipped={data.equipped} stats={data.stats} badges={data.badges} />
      {/* Pedirle una clase: lleva al pedido ya escrito con el tema y este tutor preseleccionado */}
      {userId !== id && data.topics.length > 0 && (
        <Card className="space-y-3">
          <SectionTitle>Pedirle una clase</SectionTitle>
          <p className="text-sm text-muted-foreground">Elige el tema y te dejamos el pedido listo; tú solo lo confirmas.</p>
          <div className="flex flex-wrap gap-2">
            {data.topics.map((t) => (
              <Link
                key={t.topic_id}
                href={`/aprender?tema=${encodeURIComponent(t.topic.name)}&tutor=${encodeURIComponent(id)}`}
                className={cn(btn.primary, btn.md)}
              >
                <MessageSquarePlus className="size-4" /> Pedir {t.topic.name}
              </Link>
            ))}
          </div>
        </Card>
      )}
      <div className="grid grid-cols-1 gap-4 @3xl:grid-cols-2">
        <Card>
          <SectionTitle>Temas que enseña</SectionTitle>
          <ul className="space-y-2">
            {data.topics.map((t) => (
              <li key={t.topic_id} className="flex items-center justify-between rounded-2xl bg-muted px-3 py-2 text-sm font-bold">
                {t.topic.name}
                <span className="text-muted-foreground">{LEVEL_LABEL[t.level]}</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <SectionTitle>Precio por clase</SectionTitle>
          {data.group_price_quipus ? (
            <>
              <Quipus amount={data.group_price_quipus} className="text-3xl" iconClassName="size-7" />
              <p className="mt-2 text-sm text-muted-foreground">En grupo se reparte entre todos los alumnos.</p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Aún no fija precio.</p>
          )}
          <p className="mt-4 text-xs text-muted-foreground">Las reviews escritas son privadas; solo se muestran las estrellas.</p>
        </Card>
      </div>
    </div>
  );
}
