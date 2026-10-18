"use client";

import { useEffect, useRef, useState } from "react";

// Nivel de voz 0..1 para animar la boca del avatar del tutor IA.
// Camino real: la pista de audio del agente en LiveKit (RemoteAudioTrack.mediaStream) -> useAudioLevel.
// Camino simulado: speechSynthesis no expone su audio, así que usamos useSyntheticLevel.

/** Redondea para limitar re-renders: solo cambia el estado si el nivel varió lo suficiente. */
const STEP = 0.04;

export function useAudioLevel(source: MediaStream | null, opts: { smoothing?: number; gain?: number } = {}): number {
  const { smoothing = 0.6, gain = 3.5 } = opts;
  const [level, setLevel] = useState(0);

  useEffect(() => {
    if (!source || source.getAudioTracks().length === 0 || typeof window === "undefined") return;
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;

    const ctx = new Ctx();
    const node = ctx.createMediaStreamSource(source);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    node.connect(analyser);
    const buf = new Uint8Array(analyser.fftSize);
    let raf = 0;
    let smooth = 0;
    let last = 0;

    const tick = () => {
      analyser.getByteTimeDomainData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i++) {
        const v = (buf[i] - 128) / 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / buf.length);
      smooth = smooth * smoothing + Math.min(1, rms * gain) * (1 - smoothing);
      const q = Math.round(smooth / STEP) * STEP;
      if (q !== last) {
        last = q;
        setLevel(q);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      node.disconnect();
      analyser.disconnect();
      void ctx.close();
      setLevel(0);
    };
  }, [source, smoothing, gain]);

  return source ? level : 0;
}

/** Envolvente de habla plausible (senos superpuestos + sílabas) mientras `active`. */
export function useSyntheticLevel(active: boolean): number {
  const [level, setLevel] = useState(0);
  const lastRef = useRef(0);

  useEffect(() => {
    if (!active) return;
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const t = (now - t0) / 1000;
      // Sílabas ~5 Hz con modulación lenta (frases) y un poco de jitter
      const syl = Math.max(0, Math.sin(t * 2 * Math.PI * 4.6) * 0.6 + Math.sin(t * 2 * Math.PI * 7.3 + 1.3) * 0.25);
      const phrase = 0.55 + 0.45 * Math.sin(t * 2 * Math.PI * 0.45);
      const pause = Math.sin(t * 2 * Math.PI * 0.18) > 0.85 ? 0.15 : 1;
      const v = Math.min(1, Math.max(0, (syl * phrase + Math.random() * 0.08) * pause * 1.1));
      const q = Math.round(v / STEP) * STEP;
      if (q !== lastRef.current) {
        lastRef.current = q;
        setLevel(q);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      lastRef.current = 0;
      setLevel(0);
    };
  }, [active]);

  return active ? level : 0;
}
