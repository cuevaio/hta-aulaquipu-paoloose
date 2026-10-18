import { Award, GraduationCap, Star } from "lucide-react";
import type { Badge, Equipped, Profile, TutorStats } from "@/lib/types";
import { Avatar, DECO_BG } from "@/components/avatar";
import { decoOf } from "@/lib/skins";
import { Quipus, Stars } from "@/components/bits";

function Stat({ icon, label, children, className }: { icon: React.ReactNode; label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl bg-muted p-3 ${className ?? ""}`}>
      <p className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground uppercase">
        {icon} {label}
      </p>
      <div className="mt-1 text-lg font-extrabold">{children}</div>
    </div>
  );
}

export function ProfileHero({
  profile,
  equipped,
  stats,
  badges,
  balance,
  children,
}: {
  profile: Profile;
  equipped: Equipped;
  stats: TutorStats;
  badges: Badge[];
  /** Solo en el perfil propio: los quipus son privados. */
  balance?: number;
  children?: React.ReactNode;
}) {
  const deco = decoOf(equipped.deco?.meta);
  return (
    <div className="overflow-hidden rounded-[2rem] bg-card ring-1 ring-border">
      <div
        className="relative flex min-h-52 items-end gap-4 px-5 @3xl:min-h-60 @3xl:px-8"
        style={{ background: deco ? DECO_BG[deco] : "linear-gradient(135deg,var(--primary),var(--mint))" }}
      >
        <div aria-hidden className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/35 to-transparent" />
        {/* Figura entera de pie sobre una sombra; crece hacia arriba dentro del banner */}
        <div className="relative shrink-0 pt-6">
          <Avatar config={profile.avatar_config} equipped={equipped} size={76} bare puff label={profile.display_name} />
          <span aria-hidden className="absolute bottom-0 left-1/2 h-3 w-20 -translate-x-1/2 rounded-[50%] bg-black/25 blur-[2px]" />
        </div>
        <div className="relative min-w-0 flex-1 pb-4 text-white [text-shadow:0_1px_6px_rgb(0_0_0/0.45)]">
          <h1 className="font-heading text-2xl font-semibold @3xl:text-4xl">{profile.display_name}</h1>
          <p className="text-sm font-semibold text-white/90">
            @{profile.username} · {profile.grade}º de secundaria
          </p>
          <p className="truncate text-sm font-semibold text-white/80">{profile.school}</p>
        </div>
        {children && <div className="relative flex shrink-0 flex-wrap justify-end gap-2 self-start pt-4">{children}</div>}
      </div>
      <div className="px-5 pt-4 pb-5 @3xl:px-8">
        <div className="grid grid-cols-2 gap-3 @xl:grid-cols-4">
          <Stat icon={<Star className="size-3.5" />} label="Estrellas">
            <Stars value={stats.estrellas_promedio} className="text-lg" />
          </Stat>
          <Stat icon={<GraduationCap className="size-3.5" />} label="Clases dadas">
            {stats.sesiones_completadas}
          </Stat>
          {balance !== undefined && (
            <Stat icon={<span aria-hidden>🪢</span>} label="Quipus">
              <Quipus amount={balance} />
            </Stat>
          )}
          <Stat icon={<Award className="size-3.5" />} label="Insignias" className={balance === undefined ? "col-span-2 @xl:col-span-2" : undefined}>
            {badges.length || <span className="text-sm font-semibold text-muted-foreground">Aún ninguna</span>}
          </Stat>
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
