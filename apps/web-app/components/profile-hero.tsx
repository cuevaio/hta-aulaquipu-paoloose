import type { Badge, Equipped, Profile, TutorStats } from "@/lib/types";
import { Avatar, DECO_BG } from "@/components/avatar";
import { Stars } from "@/components/bits";

export function ProfileHero({
  profile,
  equipped,
  stats,
  badges,
  children,
}: {
  profile: Profile;
  equipped: Equipped;
  stats: TutorStats;
  badges: Badge[];
  children?: React.ReactNode;
}) {
  const deco = equipped.deco?.meta.deco;
  return (
    <div className="overflow-hidden rounded-[2rem] bg-card ring-1 ring-border">
      <div className="h-28 @3xl:h-36" style={{ background: deco ? DECO_BG[deco] : "linear-gradient(135deg,var(--primary),var(--mint))" }} />
      <div className="px-5 pb-5 @3xl:px-8">
        <div className="-mt-14 flex flex-wrap items-end gap-4">
          <Avatar config={profile.avatar_config} equipped={equipped} size={112} label={profile.display_name} className="bg-card" />
          <div className="min-w-0 flex-1 pb-1">
            <h1 className="font-heading text-2xl font-semibold @3xl:text-3xl">{profile.display_name}</h1>
            <p className="text-sm font-semibold text-muted-foreground">
              @{profile.username} · {profile.grade}º de secundaria · {profile.school}
            </p>
          </div>
          {children}
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3 @xl:grid-cols-3">
          <div className="rounded-2xl bg-muted p-3">
            <p className="text-xs font-bold text-muted-foreground uppercase">Estrellas</p>
            <Stars value={stats.estrellas_promedio} className="text-lg" />
          </div>
          <div className="rounded-2xl bg-muted p-3">
            <p className="text-xs font-bold text-muted-foreground uppercase">Clases dadas</p>
            <p className="text-lg font-extrabold">{stats.sesiones_completadas}</p>
          </div>
          <div className="col-span-2 rounded-2xl bg-muted p-3 @xl:col-span-1">
            <p className="text-xs font-bold text-muted-foreground uppercase">Insignias</p>
            <p className="text-lg">{badges.length ? badges.map((b) => b.emoji).join(" ") : <span className="text-sm text-muted-foreground">Aún ninguna</span>}</p>
          </div>
        </div>
        {badges.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {badges.map((b) => (
              <span key={b.id} title={b.description} className="inline-flex items-center gap-1.5 rounded-full bg-gold/25 px-3 py-1 text-xs font-extrabold text-gold-foreground">
                {b.emoji} {b.name}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
