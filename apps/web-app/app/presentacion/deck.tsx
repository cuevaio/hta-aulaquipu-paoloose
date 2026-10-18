"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Maximize, Minimize, NotebookText } from "lucide-react";
import { cn } from "@/lib/utils";

export interface DeckSlide {
  title: string;
  notes: string;
  content: React.ReactNode;
}

const STAGE_W = 1920;
const STAGE_H = 1080;

// El hash (#3) es la única fuente de verdad del slide actual.
function subscribeHash(fn: () => void) {
  window.addEventListener("hashchange", fn);
  return () => window.removeEventListener("hashchange", fn);
}
const getHash = () => window.location.hash;
const getServerHash = () => "";

function parseIndex(hash: string, total: number) {
  const n = Number.parseInt(hash.replace("#", ""), 10);
  if (!Number.isFinite(n)) return 0;
  return Math.min(total - 1, Math.max(0, n - 1));
}

const PRINT_CSS = `
@media print {
  @page { size: ${STAGE_W}px ${STAGE_H}px; margin: 0; }
  html, body { background: #fff !important; }
  .deck-root { position: static !important; display: block !important; height: auto !important; }
  .deck-slide { position: relative !important; opacity: 1 !important; visibility: visible !important; width: ${STAGE_W}px !important; height: ${STAGE_H}px !important; break-after: page; page-break-after: always; transform: none !important; }
  .deck-frame { position: static !important; width: auto !important; height: auto !important; transform: none !important; visibility: visible !important; }
  .deck-stage { transform: none !important; position: static !important; width: auto !important; height: auto !important; }
}
`;

export function Deck({ slides }: { slides: DeckSlide[] }) {
  const total = slides.length;
  const hash = useSyncExternalStore(subscribeHash, getHash, getServerHash);
  const index = parseIndex(hash, total);

  const [notes, setNotes] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [immersive, setImmersive] = useState(false);
  const [scale, setScale] = useState<number | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const areaRef = useRef<HTMLDivElement>(null);
  const touch = useRef<{ x: number; y: number } | null>(null);

  const go = useCallback(
    (to: number) => {
      const next = Math.min(total - 1, Math.max(0, to));
      // replaceState evita llenar el historial; el evento avisa a useSyncExternalStore
      window.history.replaceState(null, "", `#${next + 1}`);
      window.dispatchEvent(new Event("hashchange"));
    },
    [total],
  );

  const toggleFullscreen = useCallback(async () => {
    const el = rootRef.current;
    if (document.fullscreenElement) {
      await document.exitFullscreen().catch(() => {});
      return;
    }
    if (immersive) {
      setImmersive(false);
      return;
    }
    if (el?.requestFullscreen) {
      try {
        await el.requestFullscreen();
        return;
      } catch {
        // cae al modo inmersivo
      }
    }
    // Sin Fullscreen API (p. ej. iPhone): se ocultan los controles para ganar espacio
    setImmersive(true);
  }, [immersive]);

  useEffect(() => {
    const onChange = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  useLayoutEffect(() => {
    const area = areaRef.current;
    if (!area) return;
    const measure = () => {
      const { width, height } = area.getBoundingClientRect();
      if (width > 0 && height > 0) setScale(Math.min(width / STAGE_W, height / STAGE_H));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(area);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      switch (e.key) {
        case "ArrowRight":
        case "PageDown":
        case "ArrowDown":
          e.preventDefault();
          go(index + 1);
          break;
        case " ":
          e.preventDefault();
          go(e.shiftKey ? index - 1 : index + 1);
          break;
        case "ArrowLeft":
        case "PageUp":
        case "ArrowUp":
          e.preventDefault();
          go(index - 1);
          break;
        case "Home":
          e.preventDefault();
          go(0);
          break;
        case "End":
          e.preventDefault();
          go(total - 1);
          break;
        case "n":
        case "N":
          setNotes((v) => !v);
          break;
        case "f":
        case "F":
          void toggleFullscreen();
          break;
        case "Escape":
          setImmersive(false);
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, index, total, toggleFullscreen]);

  const onAreaClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("a,button")) return;
    if (window.getSelection()?.toString()) return;
    const rect = e.currentTarget.getBoundingClientRect();
    go(e.clientX - rect.left < rect.width / 2 ? index - 1 : index + 1);
  };

  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touch.current = { x: t.clientX, y: t.clientY };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touch.current;
    touch.current = null;
    if (!start) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      // el deslizamiento ya navega: evita que el toque posterior cuente como clic
      e.preventDefault();
      go(dx < 0 ? index + 1 : index - 1);
    }
  };

  const showChrome = !immersive;
  const pct = total > 1 ? (index / (total - 1)) * 100 : 100;

  return (
    <div ref={rootRef} className="deck-root fixed inset-0 flex flex-col bg-navy text-white">
      <style>{PRINT_CSS}</style>

      <div
        className={cn("h-1.5 shrink-0 bg-white/10 print:hidden", !showChrome && "hidden")}
        role="progressbar"
        aria-label="Progreso de la presentación"
        aria-valuemin={1}
        aria-valuemax={total}
        aria-valuenow={index + 1}
      >
        <div className="h-full bg-mint motion-safe:transition-[width] motion-safe:duration-300" style={{ width: `${pct}%` }} />
      </div>

      <div
        ref={areaRef}
        onClick={onAreaClick}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        className="relative min-h-0 flex-1 touch-pan-y overflow-hidden select-none"
      >
        <div
          className="deck-frame absolute top-1/2 left-1/2"
          style={{
            width: STAGE_W * (scale ?? 0),
            height: STAGE_H * (scale ?? 0),
            transform: "translate(-50%, -50%)",
            visibility: scale === null ? "hidden" : "visible",
          }}
        >
          <div className="deck-stage absolute top-0 left-0 origin-top-left" style={{ width: STAGE_W, height: STAGE_H, transform: `scale(${scale ?? 0})` }}>
            {slides.map((s, i) => (
              <section
                key={s.title}
                aria-label={`Diapositiva ${i + 1} de ${total}: ${s.title}`}
                aria-hidden={i !== index}
                inert={i !== index}
                className={cn(
                  "deck-slide absolute inset-0 overflow-hidden bg-background text-foreground motion-safe:transition-opacity motion-safe:duration-300",
                  i === index ? "opacity-100" : "pointer-events-none opacity-0",
                )}
              >
                {s.content}
              </section>
            ))}
          </div>
        </div>
      </div>

      {notes && (
        <aside aria-label="Notas del orador" className="max-h-[32dvh] shrink-0 overflow-y-auto bg-navy-2 px-5 py-3 text-base leading-relaxed print:hidden">
          <p className="mb-1 text-xs font-extrabold tracking-wide text-mint uppercase">Notas · {slides[index].title}</p>
          <p className="max-w-4xl text-white/90">{slides[index].notes}</p>
        </aside>
      )}

      <div className={cn("flex shrink-0 items-center gap-2 bg-navy-2 px-3 py-2 print:hidden", !showChrome && "hidden")}>
        <Link href="/info" className="rounded-xl px-3 py-2 text-sm font-extrabold text-white/70 hover:text-white">
          Salir
        </Link>
        <div className="mx-auto flex items-center gap-2">
          <button type="button" onClick={() => go(index - 1)} disabled={index === 0} aria-label="Diapositiva anterior" className="rounded-xl p-2 hover:bg-white/10 disabled:opacity-30">
            <ChevronLeft className="size-5" />
          </button>
          <span className="min-w-16 text-center text-sm font-extrabold tabular-nums" aria-live="polite">
            {index + 1} / {total}
          </span>
          <button type="button" onClick={() => go(index + 1)} disabled={index === total - 1} aria-label="Diapositiva siguiente" className="rounded-xl p-2 hover:bg-white/10 disabled:opacity-30">
            <ChevronRight className="size-5" />
          </button>
        </div>
        <button type="button" onClick={() => setNotes((v) => !v)} aria-pressed={notes} aria-label="Notas del orador (N)" title="Notas (N)" className={cn("rounded-xl p-2 hover:bg-white/10", notes && "bg-white/15")}>
          <NotebookText className="size-5" />
        </button>
        <button type="button" onClick={() => void toggleFullscreen()} aria-label={fullscreen ? "Salir de pantalla completa" : "Pantalla completa (F)"} title="Pantalla completa (F)" className="rounded-xl p-2 hover:bg-white/10">
          {fullscreen ? <Minimize className="size-5" /> : <Maximize className="size-5" />}
        </button>
      </div>

      {immersive && (
        <button type="button" onClick={() => setImmersive(false)} aria-label="Mostrar controles" className="absolute right-2 bottom-2 rounded-full bg-navy/70 p-2 text-white/80 print:hidden">
          <Minimize className="size-4" />
        </button>
      )}
    </div>
  );
}
