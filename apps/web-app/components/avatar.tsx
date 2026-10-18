import type { AvatarConfig, Equipped, SkinMeta } from "@/lib/types";
import { cn } from "@/lib/utils";
import { avatarColor, avatarLook, frameOf } from "@/lib/skins";

const SHAPES: Record<NonNullable<AvatarConfig["shape"]>, string> = {
  blob: "M50 10c20 0 34 14 34 36s-10 44-34 44S16 68 16 46 30 10 50 10z",
  round: "M50 12c21 0 36 15 36 36S71 88 50 88 14 69 14 48 29 12 50 12z",
  bean: "M52 10c18 2 32 18 30 40-2 24-16 40-34 38S16 70 18 46 34 8 52 10z",
};

function Accessory({ kind }: { kind: SkinMeta["accessory"] }) {
  switch (kind) {
    case "chullo":
      return (
        <g>
          <path d="M24 34c4-18 16-26 26-26s22 8 26 26c-16-5-36-5-52 0z" fill="#E5484D" />
          <path d="M26 30h48" stroke="#FFC94D" strokeWidth="4" strokeDasharray="4 4" />
          <circle cx="50" cy="6" r="5" fill="#FFC94D" />
          <path d="M24 34l-4 18M76 34l4 18" stroke="#E5484D" strokeWidth="5" strokeLinecap="round" />
        </g>
      );
    case "lentes":
      return (
        <g>
          <rect x="27" y="40" width="20" height="12" rx="5" fill="#1E1B3A" />
          <rect x="53" y="40" width="20" height="12" rx="5" fill="#1E1B3A" />
          <path d="M47 45h6" stroke="#1E1B3A" strokeWidth="3" />
          <path d="M31 43l5 0" stroke="#fff" strokeOpacity=".6" strokeWidth="2" strokeLinecap="round" />
        </g>
      );
    case "audifonos":
      return (
        <g>
          <path d="M20 46c0-22 14-34 30-34s30 12 30 34" fill="none" stroke="#1E1B3A" strokeWidth="5" />
          <rect x="12" y="40" width="12" height="20" rx="5" fill="#2FD3A3" stroke="#1E1B3A" strokeWidth="3" />
          <rect x="76" y="40" width="12" height="20" rx="5" fill="#2FD3A3" stroke="#1E1B3A" strokeWidth="3" />
        </g>
      );
    case "birrete":
      return (
        <g>
          <path d="M50 4L14 18l36 14 36-14z" fill="#1E1B3A" />
          <path d="M30 24v10c12 6 28 6 40 0V24" fill="#1E1B3A" />
          <path d="M84 18v16" stroke="#FFC94D" strokeWidth="3" />
          <circle cx="84" cy="36" r="3" fill="#FFC94D" />
        </g>
      );
    case "corona":
      return (
        <g>
          <path d="M26 26l6-18 10 12 8-14 8 14 10-12 6 18z" fill="#FFC94D" stroke="#C98A00" strokeWidth="2" />
          <circle cx="50" cy="18" r="3" fill="#E5484D" />
          <circle cx="36" cy="20" r="2.5" fill="#2FD3A3" />
          <circle cx="64" cy="20" r="2.5" fill="#2FD3A3" />
        </g>
      );
    case "flor":
      return <circle cx="72" cy="20" r="7" fill="#F06EAA" />;
    default:
      return null;
  }
}

const FRAME_STYLES: Record<NonNullable<SkinMeta["frame"]>, string> = {
  basico: "ring-2 ring-white/80",
  dorado: "ring-4 ring-[#FFC94D] shadow-[0_0_0_2px_#C98A00]",
  andino: "ring-4 ring-[#E5484D] shadow-[0_0_0_3px_#FFC94D,0_0_0_5px_#2FD3A3]",
  arcoiris: "ring-0 p-[3px] bg-[conic-gradient(#E5484D,#FFC94D,#2FD3A3,#4FA3FF,#7C6BF2,#F06EAA,#E5484D)]",
};

export function Avatar({
  config,
  equipped,
  size = 64,
  className,
  speaking,
  label,
}: {
  config: AvatarConfig;
  equipped?: Partial<Equipped> | null;
  size?: number;
  className?: string;
  speaking?: boolean;
  label?: string;
}) {
  const look = avatarLook(equipped?.avatar?.meta);
  const color = look.color ?? avatarColor(config);
  const shape = SHAPES[config.shape ?? "blob"];
  const accessory = look.accessory;
  const frame = frameOf(equipped?.frame?.meta);

  return (
    <div
      role="img"
      aria-label={label ?? "Avatar"}
      className={cn("relative shrink-0 rounded-full", FRAME_STYLES[frame], speaking && "speaking", className)}
      style={{ width: size, height: size }}
    >
      <div className="size-full overflow-hidden rounded-full" style={{ background: `${color}33` }}>
        <svg viewBox="0 0 100 100" className="size-full">
          <path d={shape} fill={color} transform="translate(0 6)" />
          <ellipse cx="50" cy="92" rx="22" ry="4" fill="#000" opacity=".08" />
          <circle cx="40" cy="48" r="5" fill="#1E1B3A" />
          <circle cx="60" cy="48" r="5" fill="#1E1B3A" />
          <circle cx="41.5" cy="46.5" r="1.6" fill="#fff" />
          <circle cx="61.5" cy="46.5" r="1.6" fill="#fff" />
          <path d="M43 60q7 6 14 0" stroke="#1E1B3A" strokeWidth="3" fill="none" strokeLinecap="round" />
          <circle cx="32" cy="58" r="4" fill="#fff" opacity=".25" />
          <circle cx="68" cy="58" r="4" fill="#fff" opacity=".25" />
          <Accessory kind={accessory} />
        </svg>
      </div>
    </div>
  );
}

export function AiAvatar({
  emoji,
  color,
  size = 64,
  speaking,
  className,
}: {
  emoji: string;
  color: string;
  size?: number;
  speaking?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn("relative grid shrink-0 place-items-center rounded-full ring-2 ring-white/80", speaking && "speaking", className)}
      style={{ width: size, height: size, background: `radial-gradient(circle at 30% 30%, ${color}, ${color}aa)` }}
      aria-label="Tutor IA"
      role="img"
    >
      <span style={{ fontSize: size * 0.48 }}>{emoji}</span>
      <span className="absolute -right-1 -bottom-1 rounded-full bg-navy px-1.5 py-0.5 text-[10px] font-black text-mint ring-2 ring-white">
        IA
      </span>
    </div>
  );
}

export const DECO_BG: Record<NonNullable<SkinMeta["deco"]>, string> = {
  andes: "linear-gradient(160deg,#9AD8FF 0%,#C8F0E0 55%,#7BC67B 56%,#4E9A57 100%)",
  cosmos: "radial-gradient(circle at 20% 20%,#7C6BF2,transparent 40%),radial-gradient(circle at 80% 60%,#F06EAA,transparent 35%),#1E1B3A",
  selva: "linear-gradient(160deg,#2FD3A3,#1B7F5C)",
};
