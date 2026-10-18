import { cn } from "@/lib/utils";

export type TutorAvatarState = "idle" | "listening" | "thinking" | "speaking" | "writing" | "graphing" | "celebrating" | "surprised";
export type TutorGaze = "center" | "left" | "right" | "down";

const GAZE_OFFSET: Record<TutorGaze, [number, number]> = {
  center: [0, 0],
  left: [-3, 0],
  right: [3, 0],
  down: [0, 3],
};

const BODY = "M50 12c21 0 36 14 36 36s-10 42-36 42S14 70 14 48 29 12 50 12z";

function Sparkle({ x, y, delay }: { x: number; y: number; delay: number }) {
  return (
    <path
      d={`M${x} ${y - 5}l1.6 3.4 3.4 1.6-3.4 1.6L${x} ${y + 5}l-1.6-3.4L${x - 5} ${y}l3.4-1.6z`}
      fill="#FFC94D"
      className="tutor-anim-sparkle"
      style={{ animationDelay: `${delay}s` }}
    />
  );
}

/**
 * Tutor IA animado (SVG propio, mismo estilo blob que `Avatar`).
 * `level` (0..1) abre la boca mientras habla; el resto son animaciones CSS (ver globals.css).
 */
export function AiTutorAvatar({
  persona,
  state,
  level = 0,
  gaze = "center",
  size = 96,
  className,
}: {
  persona: { color: string; emoji: string; name?: string };
  state: TutorAvatarState;
  level?: number;
  gaze?: TutorGaze;
  size?: number;
  className?: string;
}) {
  const { color, emoji, name } = persona;
  // Al escribir o graficar la mirada va hacia la herramienta
  const effectiveGaze: TutorGaze =
    state === "writing" ? (gaze === "center" ? "down" : gaze) : state === "graphing" ? (gaze === "center" ? "right" : gaze) : state === "thinking" ? "left" : gaze;
  const [gx, gy] = GAZE_OFFSET[effectiveGaze];
  const lvl = Math.min(1, Math.max(0, level));
  const mouthOpen = state === "speaking" ? 0.15 + lvl * 0.85 : 0;
  const happy = state === "celebrating";
  const surprised = state === "surprised";

  const bodyAnim =
    state === "celebrating" ? "tutor-anim-bounce" : state === "listening" ? "tutor-anim-tilt" : "tutor-anim-bob";

  return (
    <div
      role="img"
      aria-label={`${name ?? "Tutor IA"} (${state})`}
      className={cn("relative shrink-0", className)}
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 100 100" className="size-full overflow-visible">
        <ellipse cx="50" cy="94" rx="24" ry="4" fill="#000" opacity=".12" />
        <g className={bodyAnim}>
          {/* Antenita IA */}
          <path d="M50 14V5" stroke={color} strokeWidth="3" strokeLinecap="round" />
          <circle cx="50" cy="5" r="4" fill="#FFC94D" stroke="#C98A00" strokeWidth="1.5" />
          {/* Orejas / audífonos (se agrandan al escuchar) */}
          <rect x={state === "listening" ? 7 : 9} y="40" width={state === "listening" ? 11 : 9} height="18" rx="4.5" fill={color} stroke="#1E1B3A" strokeWidth="2.5" />
          <rect x={82} y="40" width={state === "listening" ? 11 : 9} height="18" rx="4.5" fill={color} stroke="#1E1B3A" strokeWidth="2.5" />
          {/* Cuerpo y cara */}
          <path d={BODY} fill={color} />
          <path d="M50 12c21 0 36 14 36 36" fill="none" stroke="#fff" strokeOpacity=".25" strokeWidth="3" strokeLinecap="round" />
          <rect x="24" y="30" width="52" height="38" rx="19" fill="#fff" opacity=".94" />
          {/* Ojos */}
          <g className={happy ? undefined : "tutor-anim-blink"}>
            {happy ? (
              <>
                <path d="M33 49q6-8 12 0" stroke="#1E1B3A" strokeWidth="3" fill="none" strokeLinecap="round" />
                <path d="M55 49q6-8 12 0" stroke="#1E1B3A" strokeWidth="3" fill="none" strokeLinecap="round" />
              </>
            ) : (
              <g style={{ transform: `translate(${gx}px, ${gy}px)`, transition: "transform 300ms ease-out" }}>
                <circle cx="39" cy="48" r={surprised ? 7 : 5.5} fill="#1E1B3A" />
                <circle cx="61" cy="48" r={surprised ? 7 : 5.5} fill="#1E1B3A" />
                <circle cx="40.8" cy="46.2" r="1.8" fill="#fff" />
                <circle cx="62.8" cy="46.2" r="1.8" fill="#fff" />
              </g>
            )}
          </g>
          <circle cx="30" cy="58" r="3.6" fill="#F06EAA" opacity=".35" />
          <circle cx="70" cy="58" r="3.6" fill="#F06EAA" opacity=".35" />
          {/* Boca: elipse que escala en Y con el nivel de audio */}
          {mouthOpen > 0 ? (
            <g transform="translate(50 60)">
              <ellipse
                cx="0"
                cy="0"
                rx="6.5"
                ry="6"
                fill="#1E1B3A"
                style={{ transform: `scaleY(${mouthOpen})`, transition: "transform 70ms linear" }}
              />
            </g>
          ) : surprised ? (
            <ellipse cx="50" cy="62" rx="4.5" ry="6" fill="#1E1B3A" />
          ) : state === "thinking" ? (
            <path d="M44 61h12" stroke="#1E1B3A" strokeWidth="3" strokeLinecap="round" />
          ) : happy ? (
            <path d="M41 58q9 12 18 0z" fill="#1E1B3A" />
          ) : (
            <path d="M43 59q7 6 14 0" stroke="#1E1B3A" strokeWidth="3" fill="none" strokeLinecap="round" />
          )}
          {/* Etiqueta IA */}
          <g transform="translate(62 78)">
            <rect width="24" height="13" rx="6.5" fill="#1E1B3A" />
            <text x="12" y="9.8" textAnchor="middle" fontSize="8.5" fontWeight="900" fill="#2FD3A3" fontFamily="sans-serif">
              IA
            </text>
          </g>
          {/* Emoji de la persona como insignia */}
          <g transform="translate(6 70)">
            <circle cx="10" cy="10" r="10" fill="#fff" stroke={color} strokeWidth="2" />
            <text x="10" y="14.5" textAnchor="middle" fontSize="12" fontFamily="sans-serif">
              {emoji}
            </text>
          </g>
        </g>

        {/* Indicadores de estado */}
        {state === "thinking" && (
          <g fill="#1E1B3A">
            {[0, 1, 2].map((i) => (
              <circle key={i} cx={72 + i * 7} cy="14" r="2.6" className="tutor-anim-dot" style={{ animationDelay: `${i * 0.18}s` }} />
            ))}
          </g>
        )}
        {state === "writing" && (
          <g className="tutor-anim-scribble" transform="translate(70 66)">
            <path d="M2 18l2-8 12-12 6 6-12 12z" fill="#FFC94D" stroke="#1E1B3A" strokeWidth="2" strokeLinejoin="round" />
            <path d="M2 18l2-8 6 6z" fill="#F4E3C1" stroke="#1E1B3A" strokeWidth="2" strokeLinejoin="round" />
          </g>
        )}
        {state === "graphing" && (
          <g transform="translate(70 62)">
            <rect x="-2" y="-2" width="28" height="26" rx="5" fill="#fff" stroke="#1E1B3A" strokeWidth="2" />
            {[0, 1, 2].map((i) => (
              <rect
                key={i}
                x={3 + i * 8}
                y="4"
                width="5"
                height="16"
                rx="1.5"
                fill={["#4FA3FF", "#2FD3A3", "#F06EAA"][i]}
                className="tutor-anim-bars"
                style={{ animationDelay: `${i * 0.2}s` }}
              />
            ))}
          </g>
        )}
        {state === "listening" && (
          <g fill="none" stroke="#2FD3A3" strokeWidth="2.5" strokeLinecap="round">
            <path d="M92 36q5 9 0 18" className="tutor-anim-dot" />
            <path d="M97 31q9 14 0 28" className="tutor-anim-dot" style={{ animationDelay: ".2s" }} />
          </g>
        )}
        {state === "celebrating" && (
          <>
            <Sparkle x={14} y={20} delay={0} />
            <Sparkle x={88} y={16} delay={0.3} />
            <Sparkle x={94} y={56} delay={0.6} />
            <Sparkle x={6} y={50} delay={0.45} />
          </>
        )}
      </svg>
    </div>
  );
}
