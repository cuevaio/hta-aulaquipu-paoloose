"use client";

// Timbre de "tu profe llegó": una campanita sintetizada con Web Audio (sin archivos de audio).
// Los navegadores no dejan sonar nada hasta que la persona toque la página una vez, así que
// installAudioUnlock() prepara el audio en el primer clic o tecla; sin eso, el aviso es solo visual.

let ctx: AudioContext | null = null;
let ringTimer: ReturnType<typeof setInterval> | null = null;
let stopTimer: ReturnType<typeof setTimeout> | null = null;
let unlockInstalled = false;

type WebkitWindow = Window & { webkitAudioContext?: typeof AudioContext };

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AC = window.AudioContext ?? (window as WebkitWindow).webkitAudioContext;
  if (!AC) return null;
  ctx ??= new AC();
  return ctx;
}

/** Deja el audio listo con el primer gesto de la persona (clic, toque o tecla). */
export function installAudioUnlock() {
  if (unlockInstalled || typeof window === "undefined") return;
  unlockInstalled = true;
  const unlock = () => {
    const c = audio();
    if (c && c.state === "suspended") void c.resume().catch(() => {});
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("keydown", unlock);
  };
  window.addEventListener("pointerdown", unlock);
  window.addEventListener("keydown", unlock);
}

/** Una nota de campana: tono base más un parcial inarmónico, con caída rápida. */
function bell(c: AudioContext, at: number, freq: number) {
  const out = c.createGain();
  out.gain.setValueAtTime(0.0001, at);
  out.gain.exponentialRampToValueAtTime(0.35, at + 0.01);
  out.gain.exponentialRampToValueAtTime(0.0001, at + 1.1);
  out.connect(c.destination);
  for (const [mult, level] of [[1, 1], [2.76, 0.35], [5.4, 0.12]] as const) {
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = "sine";
    osc.frequency.value = freq * mult;
    g.gain.value = level;
    osc.connect(g).connect(out);
    osc.start(at);
    osc.stop(at + 1.2);
  }
}

/** "Ding-dong" de timbre. */
function dingDong() {
  const c = audio();
  if (!c) return;
  void c.resume().catch(() => {});
  const t = c.currentTime + 0.02;
  bell(c, t, 880);
  bell(c, t + 0.5, 659.25);
}

export function stopRinging() {
  if (ringTimer) clearInterval(ringTimer);
  if (stopTimer) clearTimeout(stopTimer);
  ringTimer = stopTimer = null;
}

/** Suena cada ~2,2 s hasta `maxMs` o hasta stopRinging(). */
export function startRinging(maxMs = 14_000) {
  stopRinging();
  dingDong();
  ringTimer = setInterval(dingDong, 2200);
  stopTimer = setTimeout(stopRinging, maxMs);
}
