// Nube de humo de dibujos animados: se muestra un instante mientras la figura cambia de ropa.
// Es solo decoración (aria-hidden) y no recibe clics; las bolitas se animan por CSS (.smoke-puff-dot).

const DOTS = [
  { dx: 0, dy: -0.34, s: 1.5, d: 0, w: 0.5 },
  { dx: 0.3, dy: -0.22, s: 1.3, d: 20, w: 0.42 },
  { dx: -0.3, dy: -0.2, s: 1.3, d: 40, w: 0.42 },
  { dx: 0.36, dy: 0.1, s: 1.2, d: 10, w: 0.38 },
  { dx: -0.36, dy: 0.12, s: 1.2, d: 30, w: 0.38 },
  { dx: 0.2, dy: 0.32, s: 1.1, d: 50, w: 0.34 },
  { dx: -0.2, dy: 0.3, s: 1.1, d: 15, w: 0.34 },
  { dx: 0, dy: 0.04, s: 1.7, d: 0, w: 0.56 },
];

/** `size` = ancho aproximado de la figura en px; la nube se centra en su contenedor. */
export function SmokePuff({ size, className, style }: { size: number; className?: string; style?: React.CSSProperties }) {
  return (
    <span aria-hidden className={`pointer-events-none absolute z-20 ${className ?? ""}`} style={style}>
      {DOTS.map((d, i) => (
        <span
          key={i}
          className="smoke-puff-dot absolute rounded-full bg-white shadow-[inset_-3px_-3px_0_rgb(0_0_0/0.1)] ring-1 ring-black/15"
          style={
            {
              left: 0,
              top: 0,
              width: size * d.w,
              height: size * d.w,
              animationDelay: `${d.d}ms`,
              "--dx": `${d.dx * size}px`,
              "--dy": `${d.dy * size}px`,
              "--s": d.s,
            } as React.CSSProperties
          }
        />
      ))}
    </span>
  );
}
