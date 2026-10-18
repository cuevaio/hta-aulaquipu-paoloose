"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { AvatarConfig, Equipped } from "@/lib/types";
import { DEFAULT_DIRECTION, directionFor, setDirection, setWalking, useDirection, useWalking } from "@/lib/campus/walk-store";
import { Avatar } from "@/components/avatar";
import {
  CLASS_DOORS,
  COLS,
  doorTiles,
  FLOOR,
  OBJECTS,
  ROOMS,
  ROWS,
  SPAWN,
  distToRect,
  findPath,
  makeBlocked,
  roomAt,
  type Floor,
  type Room,
  type WorldObject,
} from "@/lib/campus/map";
import { BUBBLE_MS } from "@/lib/campus/chat-rules";
import { teacherAvatar, useTeacherPose } from "@/lib/campus/teacher-avatars";
import { cn } from "@/lib/utils";
import { FURNI_SIZE, furniScale, furniSrc } from "@/lib/campus/furni";
import type { CampusPeer, PeerPosition } from "@/lib/campus/use-campus-presence";

export interface CampusPerson {
  id: string;
  x: number;
  y: number;
  name: string;
  caption: string;
  href: string;
  prompt: string;
  avatar?: AvatarConfig;
  equipped?: Equipped | null;
  ai?: { emoji: string; color: string };
}

/** Una clase del alumno puesta en una puerta del pasillo. */
export interface ClassDoor {
  title: string;
  subtitle: string;
  live: boolean;
  href: string;
  prompt: string;
}

export interface Interactable {
  id: string;
  rect: { x: number; y: number; w: number; h: number };
  href: string;
  prompt: string;
}

const SPEED = 5.5; // baldosas por segundo
const tileFor = (width: number) => (width < 640 ? 40 : width < 1024 ? 48 : 56);
const RADIUS = 0.3;
const REACH = 0.95;

const FLOOR_COLORS: Record<Floor, [string, string]> = {
  "#": ["#2b2550", "#2b2550"],
  g: ["#a4dd96", "#98d58a"],
  p: ["#f4ead8", "#efe3cd"],
  b: ["#ecd2ae", "#e5c8a1"],
  i: ["#e3ddff", "#d9d2fb"],
  t: ["#cdf3e5", "#c1ecdc"],
  a: ["#d9e9ff", "#cfe1fb"],
  s: ["#ffe2cf", "#fbd7c1"],
  q: ["#fff0c4", "#fbe7b0"],
  w: ["#7cc8f2", "#7cc8f2"],
  e: ["#e8e4f0", "#dfdaea"],
  c: ["#e2ecf5", "#d7e3ef"],
};

function drawFloor(canvas: HTMLCanvasElement, T: number) {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = COLS * T * dpr;
  canvas.height = ROWS * T * dpr;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(dpr, dpr);
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const f = FLOOR[y][x];
      const [a, b] = FLOOR_COLORS[f];
      ctx.fillStyle = (x + y) % 2 ? a : b;
      ctx.fillRect(x * T, y * T, T, T);
      if (f === "#") {
        // Cara superior más clara cuando debajo hay piso: da volumen a la pared
        const below = FLOOR[y + 1]?.[x];
        if (below && below !== "#") {
          ctx.fillStyle = "#463f80";
          ctx.fillRect(x * T, y * T + T * 0.45, T, T * 0.55);
          ctx.fillStyle = "#5a52a0";
          ctx.fillRect(x * T, y * T + T * 0.45, T, 3);
        }
      } else if (f === "g") {
        ctx.fillStyle = "#7fc472";
        ctx.fillRect(x * T + T * 0.25, y * T + T * 0.3, 3, 5);
        ctx.fillRect(x * T + T * 0.7, y * T + T * 0.65, 3, 5);
      } else if (f === "w") {
        ctx.strokeStyle = "#b9e6ff";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x * T + T / 2, y * T + T / 2, T * 0.22, Math.PI * 0.1, Math.PI * 0.9);
        ctx.stroke();
      } else {
        ctx.strokeStyle = "rgba(43,37,80,0.05)";
        ctx.strokeRect(x * T + 0.5, y * T + 0.5, T - 1, T - 1);
      }
    }
  }
}

const OBJECT_STYLE: Partial<Record<WorldObject["kind"], string>> = {
  shelf: "bg-[#9a6a44] shadow-[inset_0_-6px_0_#7a5233]",
  kiosk: "bg-primary shadow-[inset_0_-6px_0_oklch(0.4_0.2_282)]",
  table: "bg-[#d4a676] shadow-[inset_0_-5px_0_#b68756]",
  board: "bg-white ring-2 ring-[#2b2550]/15 shadow-[inset_0_-5px_0_#e6e1f5]",
  rug: "bg-primary/10 ring-2 ring-primary/15 rounded-2xl",
  sofa: "bg-coral shadow-[inset_0_-6px_0_#e06b48]",
  bench: "bg-[#b9895c] shadow-[inset_0_-5px_0_#946a43]",
  mirror: "bg-[#c9ecff] ring-4 ring-[#d4a676] shadow-[inset_0_-5px_0_#a8d8f5]",
  desk: "bg-[#e0bd92] shadow-[inset_0_-5px_0_#c49e70]",
  counter: "bg-mint shadow-[inset_0_-6px_0_var(--mint-deep)]",
  display: "bg-white ring-2 ring-[#2b2550]/10 shadow-[inset_0_-4px_0_#ece7fa]",
  vault: "bg-[#6b7088] shadow-[inset_0_-6px_0_#50546a]",
  locker: "bg-[#7ea6d6] shadow-[inset_0_-6px_0_#5b84b8] ring-1 ring-[#5b84b8]/40",
  gate: "bg-[#8a5a3c] shadow-[inset_0_-6px_0_#6b432b] ring-2 ring-[#2b2550]/20",
};
const BIG_EMOJI = new Set(["plant", "tree", "fountain"]);

/** Avatar del campus que anima sus pasos cuando su dueño camina (estado en walk-store). */
/** Tutor IA de pie que da clase: cambia de pose solo (ver useTeacherPose). */
function TeacherNpc({ id, color, size, label }: { id: string; color: string; size: number; label: string }) {
  const pose = useTeacherPose(id);
  return <Avatar config={teacherAvatar(id, color)} pose={pose} size={size} label={label} bare />;
}

function WalkingAvatar({ id, ...props }: React.ComponentProps<typeof Avatar> & { id: string }) {
  const walking = useWalking(id);
  const direction = useDirection(id);
  return <Avatar {...props} walking={walking} direction={direction} puff bare />;
}

export function CampusWorld({
  me,
  people,
  peers,
  peerPositions,
  onMove,
  doors,
  onOpen,
  onRoomChange,
  onNearChange,
  onTrailEnd,
  interactRef,
  goToRef,
  bubbleRef,
}: {
  me: { name: string; avatar: AvatarConfig; equipped: Equipped | null };
  people: CampusPerson[];
  /** Personas conectadas al campus en este momento (multijugador). */
  peers: CampusPeer[];
  peerPositions: React.RefObject<Map<string, PeerPosition>>;
  onMove: (pos: PeerPosition) => void;
  /** Clases del alumno: cada una ocupa una puerta del pasillo, en orden. */
  doors: ClassDoor[];
  onOpen: (href: string) => void;
  onRoomChange: (room: Room | null) => void;
  onNearChange: (target: Interactable | null) => void;
  /** Termina un camino guiado: `arrived` si llegó, `false` si el alumno tomó el control. */
  onTrailEnd?: (arrived: boolean) => void;
  /** El HUD llama a esto para interactuar con lo que está cerca (botón en móvil). */
  interactRef: React.RefObject<(() => void) | null>;
  /**
   * Camina solo hasta un objetivo (p. ej. "door-0") y lo abre al llegar. Con `trail` dibuja el camino
   * en el piso (guías). `null` detiene la caminata.
   */
  goToRef: React.RefObject<((targetId: string | null, opts?: { trail?: boolean }) => void) | null>;
  /** El chat llama a esto para mostrar un globo sobre alguien ("me" = el jugador). */
  bubbleRef: React.RefObject<((id: string, text: string) => void) | null>;
}) {
  const viewport = useRef<HTMLDivElement>(null);
  const world = useRef<HTMLDivElement>(null);
  const player = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [T, setT] = useState(() => (typeof window !== "undefined" ? tileFor(window.innerWidth) : 48));
  const [nearId, setNearId] = useState<string | null>(null);

  const pos = useRef({ ...SPAWN });
  const cam = useRef({ x: 0, y: 0 });
  const keys = useRef(new Set<string>());
  const path = useRef<{ x: number; y: number }[]>([]);
  const pending = useRef<Interactable | null>(null);
  const callbacks = useRef({ onOpen, onRoomChange, onNearChange, onMove, onTrailEnd });
  // Camino guiado: huellas por casilla (se apagan al pisarlas) y el objetivo marcado
  const [trail, setTrail] = useState<{ cells: { x: number; y: number; angle: number }[]; goal: Interactable["rect"] } | null>(null);
  const trailEls = useRef<(HTMLDivElement | null)[]>([]);
  const trailStep = useRef(-1); // -1 = sin camino guiado
  const facing = useRef(DEFAULT_DIRECTION);
  // Elementos y posición dibujada de cada persona conectada (se interpola hacia la recibida)
  const peerEls = useRef(new Map<string, HTMLDivElement>());
  const peerDrawn = useRef(new Map<string, { x: number; y: number }>());

  const bubbleTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  // Globos de chat: se escriben directo en el DOM (como las posiciones) y se apagan solos
  useEffect(() => {
    const timers = bubbleTimers.current;
    bubbleRef.current = (id, text) => {
      const holder = id === "me" ? player.current : peerEls.current.get(id);
      const el = holder?.querySelector<HTMLElement>("[data-bubble]");
      if (!el) return;
      el.textContent = text;
      el.classList.remove("hidden");
      clearTimeout(timers.get(id));
      timers.set(id, setTimeout(() => el.classList.add("hidden"), BUBBLE_MS));
    };
    return () => {
      bubbleRef.current = null;
      timers.forEach(clearTimeout);
      timers.clear();
    };
  }, [bubbleRef]);

  const targets = useMemo<Interactable[]>(
    () => [
      ...OBJECTS.filter((o) => o.href).map((o) => ({
        id: o.id,
        rect: { x: o.x, y: o.y, w: o.w, h: o.h },
        href: o.href!,
        prompt: o.prompt ?? o.label ?? "",
      })),
      ...people.map((p) => ({ id: p.id, rect: { x: p.x, y: p.y, w: 1, h: 1 }, href: p.href, prompt: p.prompt })),
      // Solo existen las puertas que tienen una clase
      // Todas las puertas se pueden usar: con clase entras; sin clase te lleva a pedir una
      ...CLASS_DOORS.map((slot, i) => {
        const d = doors[i];
        return d
          ? { id: slot.id, rect: slot, href: d.href, prompt: d.prompt }
          : { id: slot.id, rect: slot, href: "/aprender", prompt: "Aún no tienes clase en esta puerta · pide una" };
      }),
    ],
    [people, doors],
  );
  const blocked = useMemo(() => makeBlocked([...people, ...doorTiles(CLASS_DOORS.length)]), [people]);

  useEffect(() => {
    callbacks.current = { onOpen, onRoomChange, onNearChange, onMove, onTrailEnd };
  }, [onOpen, onRoomChange, onNearChange, onMove, onTrailEnd]);

  useEffect(() => {
    const onResize = () => setT(tileFor(window.innerWidth));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (canvas.current) drawFloor(canvas.current, T);
  }, [T]);

  // Bucle de juego: movimiento, cámara y proximidad. Muta el DOM directo para no re-renderizar a 60 fps.
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let lastNear: string | null = null;
    let lastRoom: string | null | undefined;

    const isBlocked = (x: number, y: number) => {
      const tx = Math.floor(x);
      const ty = Math.floor(y);
      return tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS || blocked[ty][tx];
    };
    const free = (x: number, y: number) =>
      !isBlocked(x - RADIUS, y - RADIUS) &&
      !isBlocked(x + RADIUS, y - RADIUS) &&
      !isBlocked(x - RADIUS, y + RADIUS) &&
      !isBlocked(x + RADIUS, y + RADIUS);

    const nearest = () => {
      let best: Interactable | null = null;
      let bestD = REACH;
      for (const t of targets) {
        const d = distToRect(pos.current.x, pos.current.y, t.rect);
        if (d <= bestD) {
          bestD = d;
          best = t;
        }
      }
      return best;
    };

    const endTrail = (arrived: boolean) => {
      if (trailStep.current < 0) return;
      trailStep.current = -1;
      setTrail(null);
      callbacks.current.onTrailEnd?.(arrived);
    };

    interactRef.current = () => {
      const t = nearest();
      if (t) callbacks.current.onOpen(t.href);
    };

    goToRef.current = (targetId, opts) => {
      endTrail(false);
      if (targetId === null) {
        path.current = [];
        pending.current = null;
        return;
      }
      const t = targets.find((x) => x.id === targetId);
      if (!t) return;
      if (distToRect(pos.current.x, pos.current.y, t.rect) <= REACH) {
        callbacks.current.onOpen(t.href);
        return;
      }
      const found = findPath(blocked, pos.current, (x, y) => distToRect(x + 0.5, y + 0.5, t.rect) <= REACH);
      if (found) {
        path.current = found;
        pending.current = t;
        if (opts?.trail) {
          // Cada huella apunta a la siguiente casilla; la última, al objetivo
          const goal = { x: t.rect.x + t.rect.w / 2, y: t.rect.y + t.rect.h / 2 };
          const cells = found.map((c, i) => {
            const next = found[i + 1] ?? goal;
            return { ...c, angle: (Math.atan2(next.y - c.y, next.x - c.x) * 180) / Math.PI };
          });
          trailStep.current = 0;
          setTrail({ cells, goal: t.rect });
        }
      }
    };

    const step = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const p = pos.current;
      let vx = 0;
      let vy = 0;
      const k = keys.current;
      if (k.has("arrowleft") || k.has("a")) vx -= 1;
      if (k.has("arrowright") || k.has("d")) vx += 1;
      if (k.has("arrowup") || k.has("w")) vy -= 1;
      if (k.has("arrowdown") || k.has("s")) vy += 1;

      let moving = false;
      if (vx || vy) {
        path.current = [];
        pending.current = null;
        endTrail(false);
        const len = Math.hypot(vx, vy);
        const nx = p.x + (vx / len) * SPEED * dt;
        const ny = p.y + (vy / len) * SPEED * dt;
        if (free(nx, p.y)) p.x = nx;
        if (free(p.x, ny)) p.y = ny;
        moving = true;
      } else if (path.current.length) {
        const wp = path.current[0];
        const dx = wp.x - p.x;
        const dy = wp.y - p.y;
        const d = Math.hypot(dx, dy);
        const stepLen = SPEED * dt;
        if (d <= stepLen) {
          p.x = wp.x;
          p.y = wp.y;
          path.current.shift();
          if (trailStep.current >= 0) trailEls.current[trailStep.current++]?.classList.add("passed");
          if (!path.current.length && pending.current) {
            const t = pending.current;
            pending.current = null;
            endTrail(true);
            callbacks.current.onOpen(t.href);
          }
        } else {
          p.x += (dx / d) * stepLen;
          p.y += (dy / d) * stepLen;
        }
        vx = dx;
        vy = dy;
        moving = true;
      }

      // Cámara centrada en el jugador, sin salirse del mapa
      const vp = viewport.current;
      if (vp && world.current && player.current) {
        const W = COLS * T;
        const H = ROWS * T;
        const vw = vp.clientWidth;
        const vh = vp.clientHeight;
        cam.current.x = W <= vw ? (W - vw) / 2 : Math.min(Math.max(p.x * T - vw / 2, 0), W - vw);
        cam.current.y = H <= vh ? (H - vh) / 2 : Math.min(Math.max(p.y * T - vh / 2, 0), H - vh);
        world.current.style.transform = `translate3d(${-cam.current.x}px, ${-cam.current.y}px, 0)`;
        player.current.style.transform = `translate3d(${p.x * T - T / 2}px, ${p.y * T - T * 0.85}px, 0)`;
        player.current.style.zIndex = String(Math.floor(p.y * 10) + 5);
        player.current.classList.toggle("walking", moving);
        setWalking("me", moving);
        facing.current = directionFor(vx, vy) ?? facing.current;
        setDirection("me", facing.current);

        // Personas conectadas: se acercan suavemente a la última posición recibida
        const k = Math.min(1, dt * 12);
        for (const [id, el] of peerEls.current) {
          const target = peerPositions.current?.get(id);
          if (!target) {
            el.style.opacity = "0";
            setWalking(id, false);
            continue;
          }
          let d = peerDrawn.current.get(id);
          if (!d || Math.hypot(target.x - d.x, target.y - d.y) > 6) d = { x: target.x, y: target.y };
          d.x += (target.x - d.x) * k;
          d.y += (target.y - d.y) * k;
          peerDrawn.current.set(id, d);
          const moving = Math.hypot(target.x - d.x, target.y - d.y) > 0.03;
          el.style.opacity = "1";
          el.style.transform = `translate3d(${d.x * T - T / 2}px, ${d.y * T - T * 0.85}px, 0)`;
          el.style.zIndex = String(Math.floor(d.y * 10) + 5);
          el.classList.toggle("walking", moving);
          setWalking(id, moving);
          setDirection(id, target.d);
        }
      }
      callbacks.current.onMove({ x: p.x, y: p.y, d: facing.current });

      const near = nearest();
      if ((near?.id ?? null) !== lastNear) {
        lastNear = near?.id ?? null;
        setNearId(lastNear);
        callbacks.current.onNearChange(near);
      }
      const room = roomAt(p.x, p.y);
      if ((room?.id ?? null) !== lastRoom) {
        lastRoom = room?.id ?? null;
        callbacks.current.onRoomChange(room);
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [T, blocked, targets, interactRef, goToRef, peerPositions]);

  // Teclado: movimiento + X/Enter/Espacio para interactuar (no mientras se escribe)
  useEffect(() => {
    const typing = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      return !!el && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName) || !!el.closest("[data-panel]"));
    };
    const MOVE = ["arrowleft", "arrowright", "arrowup", "arrowdown", "a", "d", "w", "s"];
    const down = (e: KeyboardEvent) => {
      if (typing(e)) return;
      const k = e.key.toLowerCase();
      if (MOVE.includes(k)) {
        keys.current.add(k);
        e.preventDefault();
      } else if (k === "x" || k === "enter" || k === " ") {
        interactRef.current?.();
        e.preventDefault();
      }
    };
    const up = (e: KeyboardEvent) => keys.current.delete(e.key.toLowerCase());
    const blur = () => keys.current.clear();
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, [interactRef]);

  // Tocar/clic para caminar; si tocas algo interactivo, camina hasta ahí y lo abre
  const onPointerDown = (e: React.PointerEvent) => {
    const vp = viewport.current;
    if (!vp) return;
    const r = vp.getBoundingClientRect();
    const wx = (e.clientX - r.left + cam.current.x) / T;
    const wy = (e.clientY - r.top + cam.current.y) / T;
    const hit = targets.find((t) => distToRect(wx, wy, t.rect) === 0);
    if (hit && distToRect(pos.current.x, pos.current.y, hit.rect) <= REACH) {
      callbacks.current.onOpen(hit.href);
      return;
    }
    const tx = Math.floor(wx);
    const ty = Math.floor(wy);
    const found = hit
      ? findPath(blocked, pos.current, (x, y) => distToRect(x + 0.5, y + 0.5, hit.rect) <= REACH)
      : findPath(blocked, pos.current, (x, y) => Math.abs(x - tx) + Math.abs(y - ty) <= (blocked[ty]?.[tx] ? 1 : 0));
    if (found) {
      goToRef.current?.(null);
      path.current = found;
      pending.current = hit ?? null;
    }
  };

  const W = COLS * T;
  const H = ROWS * T;

  return (
    <div
      ref={viewport}
      onPointerDown={onPointerDown}
      className="absolute inset-0 touch-none overflow-hidden bg-[#1f1b3d] select-none"
      role="application"
      aria-label="Campus de AulaQuipu. Muévete con las flechas o tocando el mapa; presiona X para interactuar."
    >
      <div ref={world} className="absolute top-0 left-0 will-change-transform" style={{ width: W, height: H }}>
        <canvas ref={canvas} className="absolute inset-0" style={{ width: W, height: H }} />

        {/* Nombre de cada sala pintado en el piso */}
        {ROOMS.filter((r) => r.id !== "patio").map((r) => (
          <div
            key={r.id}
            className="pointer-events-none absolute flex -translate-x-1/2 flex-col items-center text-center font-heading leading-none font-semibold text-navy/25"
            style={{ left: (r.x + r.w / 2) * T, top: (r.y + r.h - 1.6) * T, fontSize: T * 0.5 }}
          >
            {r.name}
            {r.subtitle && <span style={{ fontSize: T * 0.28 }}>{r.subtitle}</span>}
          </div>
        ))}

        {/* Camino guiado: huellas en el piso hasta el objetivo */}
        {trail && (
          <>
            {trail.cells.map((c, i) => (
              <div
                key={`${c.x}-${c.y}-${i}`}
                ref={(el) => {
                  trailEls.current[i] = el;
                }}
                className="trail-step pointer-events-none absolute grid place-items-center"
                style={{ left: (c.x - 0.5) * T, top: (c.y - 0.5) * T, width: T, height: T, zIndex: 2, animationDelay: `${i * 35}ms` }}
              >
                {/* Disco oscuro detrás: la flecha se lee sobre cualquier piso, claro u oscuro */}
                <div className="grid place-items-center rounded-full bg-navy/45 shadow-[0_0_0_2px_rgb(255_255_255/0.35)]" style={{ width: T * 0.6, height: T * 0.6 }}>
                  <svg
                    viewBox="0 0 24 24"
                    className="trail-arrow"
                    style={{ width: T * 0.42, height: T * 0.42, transform: `rotate(${c.angle}deg)`, animationDelay: `${i * 90}ms` }}
                    aria-hidden
                  >
                    <path d="M8 4l8 8-8 8" fill="none" stroke="rgb(0 0 0 / 0.35)" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M8 4l8 8-8 8" fill="none" stroke="oklch(0.86 0.16 85)" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </div>
            ))}
            <div
              className="trail-goal pointer-events-none absolute rounded-2xl ring-4 ring-gold"
              style={{
                left: trail.goal.x * T - 4,
                top: trail.goal.y * T - 4,
                width: trail.goal.w * T + 8,
                height: trail.goal.h * T + 8,
                zIndex: 3,
              }}
            />
          </>
        )}

        {OBJECTS.map((o) => {
          const big = BIG_EMOJI.has(o.kind);
          const near = nearId === o.id;
          return (
            <div
              key={o.id}
              className={cn(
                "absolute grid place-items-center rounded-[10px] transition-shadow",
                !o.sprites && OBJECT_STYLE[o.kind],
                o.href && "cursor-pointer",
                near && !o.sprites && "ring-4 ring-gold",
              )}
              style={{
                left: o.x * T + 2,
                top: o.y * T + 2,
                width: o.w * T - 4,
                height: o.h * T - 4,
                zIndex: o.kind === "rug" ? 1 : (o.y + o.h) * 10,
              }}
            >
              {o.sprites && (
                // Pixel art apoyado en el piso del objeto: puede sobresalir hacia arriba (estantes, árboles)
                <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-around">
                  {o.sprites.map((id, i) => {
                    const [w, h] = FURNI_SIZE[id];
                    const k = furniScale(T, o.scale);
                    return (
                      // eslint-disable-next-line @next/next/no-img-element -- sprites diminutos, sin optimizar
                      <img
                        key={i}
                        src={furniSrc(id)}
                        alt=""
                        draggable={false}
                        width={Math.round(w * k)}
                        height={Math.round(h * k)}
                        className={cn("max-w-none [image-rendering:pixelated]", near && "drop-shadow-[0_0_6px_var(--color-gold)]")}
                      />
                    );
                  })}
                </div>
              )}
              {o.emoji && !o.sprites && (
                <span style={{ fontSize: big ? T * (o.kind === "fountain" ? 1.5 : 0.95) : T * 0.5 }} className={cn(big && "-translate-y-1 drop-shadow")}>
                  {o.kind === "shelf" || o.kind === "desk" ? o.emoji.repeat(Math.max(1, o.w - 1)) : o.emoji}
                </span>
              )}
              {o.label && (
                <span
                  className={cn(
                    "absolute -top-3 left-1/2 -translate-x-1/2 -translate-y-full rounded-full px-2 py-0.5 text-[11px] font-extrabold whitespace-nowrap shadow-md",
                    near ? "bg-gold text-gold-foreground" : "bg-navy text-white",
                  )}
                >
                  {o.label}
                </span>
              )}
            </div>
          );
        })}

        {/* Puertas del pasillo: siempre están; las de tus clases tienen su cartel y la próxima "llama" */}
        {CLASS_DOORS.map((slot, i) => {
          const d = doors[i];
          const near = nearId === slot.id;
          // La puerta de tu próxima clase suena como una llamada, para que la veas
          const calling = !!d && (d.live || i === 0);
          return (
            <div
              key={slot.id}
              className={cn(
                "absolute flex cursor-pointer flex-col items-center justify-end rounded-t-[14px] border-x-4 border-t-4 transition-shadow",
                !d ? "border-[#5a4a3e] bg-[#7d6a5c]" : d.live ? "border-coral bg-[#b5704a]" : "border-[#6b432b] bg-[#9a6a44]",
                near && "ring-4 ring-gold",
              )}
              style={{ left: slot.x * T + 4, top: slot.y * T - T * 0.55, width: slot.w * T - 8, height: T * 1.5, zIndex: (slot.y + 1) * 10 }}
            >
              <span className={cn("absolute top-1/2 right-2 size-2 rounded-full", d ? "bg-gold" : "bg-white/40")} aria-hidden />
              {d ? (
                <span
                  className={cn(
                    "absolute -top-2 left-1/2 max-w-[150%] -translate-x-1/2 -translate-y-full truncate rounded-lg px-2 py-0.5 text-center text-[10px] leading-tight font-extrabold whitespace-nowrap shadow-md",
                    near ? "bg-gold text-gold-foreground" : "bg-navy text-white",
                  )}
                >
                  {d.title}
                  <span className="block font-semibold opacity-80">{d.subtitle}</span>
                </span>
              ) : (
                near && (
                  <span className="absolute -top-2 left-1/2 -translate-x-1/2 -translate-y-full rounded-lg bg-white/95 px-2 py-0.5 text-center text-[10px] leading-tight font-extrabold whitespace-nowrap text-navy shadow-md">
                    Sin clase todavía
                    <span className="block font-semibold text-muted-foreground">Pide una en la 📚 Biblioteca</span>
                  </span>
                )
              )}
              {calling && (
                <span
                  className="absolute top-2 left-1/2 grid size-7 -translate-x-1/2 place-items-center rounded-full bg-gold shadow-lg ring-2 ring-white"
                  aria-label="Tu clase te espera"
                  title="Tu clase te espera"
                >
                  <span className="bell-ring-short text-sm leading-none" aria-hidden>
                    🔔
                  </span>
                  <span className="ping-short absolute inset-0 rounded-full bg-gold/60" aria-hidden />
                </span>
              )}
              {d?.live && (
                <span className="mb-1 flex items-center gap-1 rounded-full bg-coral px-1.5 py-px text-[9px] font-black text-white">
                  <span className="size-1.5 animate-pulse rounded-full bg-white" /> EN VIVO
                </span>
              )}
            </div>
          );
        })}

        {people.map((p) => (
          <div
            key={p.id}
            className="absolute flex cursor-pointer flex-col items-center"
            style={{ left: p.x * T, top: p.y * T - T * 0.35, width: T, zIndex: (p.y + 1) * 10 + 5 }}
          >
            <div className={cn("float", nearId === p.id && "rounded-xl ring-4 ring-gold")}>
              {p.ai ? (
                // Tutor IA de pie como un profe más; la etiqueta con su emoji recuerda que es IA
                <div className="relative">
                  <TeacherNpc id={p.id} color={p.ai.color} size={T * 0.95} label={p.name} />
                  <span
                    className="absolute -right-3 bottom-0 flex items-center gap-0.5 rounded-full bg-navy px-1 py-px text-[9px] font-black text-mint ring-2 ring-white"
                    aria-hidden
                  >
                    <span className="text-[11px] leading-none">{p.ai.emoji}</span> IA
                  </span>
                </div>
              ) : (
                <Avatar config={p.avatar ?? {}} equipped={p.equipped} size={T * 0.95} label={p.name} bare />
              )}
            </div>
            <span className="mt-0.5 rounded-full bg-navy/85 px-1.5 py-px text-[10px] font-bold whitespace-nowrap text-white">{p.name}</span>
            {nearId !== p.id && <span className="text-[9px] font-bold whitespace-nowrap text-navy/60">{p.caption}</span>}
          </div>
        ))}

        {/* Personas conectadas ahora mismo */}
        {peers.map((peer) => (
          <div
            key={peer.id}
            ref={(el) => {
              if (el) peerEls.current.set(peer.id, el);
              else {
                peerEls.current.delete(peer.id);
                peerDrawn.current.delete(peer.id);
              }
            }}
            onPointerDown={(e) => {
              e.stopPropagation();
              callbacks.current.onOpen(`/tutor/${peer.id}`);
            }}
            className="absolute top-0 left-0 flex cursor-pointer flex-col items-center opacity-0 transition-opacity"
            style={{ width: T }}
            title={`Ver el perfil de ${peer.name}`}
          >
            <div
              data-bubble
              aria-live="polite"
              style={{ marginBottom: T }}
              className="hidden absolute bottom-full left-1/2 z-10 w-max max-w-[11rem] -translate-x-1/2 rounded-2xl rounded-bl-sm bg-white px-2.5 py-1.5 text-xs leading-snug font-semibold break-words text-navy shadow-lg ring-1 ring-black/10"
            />
            <div className="player-body">
              <WalkingAvatar id={peer.id} config={peer.avatar} equipped={peer.equipped} size={T * 0.95} label={peer.name} />
            </div>
            <span className="mt-0.5 flex items-center gap-1 rounded-full bg-navy/85 px-1.5 py-px text-[10px] font-bold whitespace-nowrap text-white">
              <span className="size-1.5 rounded-full bg-success" />
              {peer.name}
            </span>
          </div>
        ))}

        {/* Jugador */}
        <div ref={player} className="pointer-events-none absolute top-0 left-0 flex flex-col items-center" style={{ width: T }}>
          <div
              data-bubble
              aria-live="polite"
              style={{ marginBottom: T }}
              className="hidden absolute bottom-full left-1/2 z-10 w-max max-w-[11rem] -translate-x-1/2 rounded-2xl rounded-bl-sm bg-white px-2.5 py-1.5 text-xs leading-snug font-semibold break-words text-navy shadow-lg ring-1 ring-black/10"
            />
          <div className="player-body">
            <WalkingAvatar id="me" config={me.avatar} equipped={me.equipped} size={T * 0.95} label={me.name} />
          </div>
          <span className="mt-0.5 rounded-full bg-mint px-1.5 py-px text-[10px] font-black whitespace-nowrap text-navy shadow">
            {me.name} (tú)
          </span>
        </div>
      </div>
    </div>
  );
}
