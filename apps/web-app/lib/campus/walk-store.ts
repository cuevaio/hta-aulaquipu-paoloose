// Quién está caminando en el campus y hacia dónde mira. El bucle de movimiento de world.tsx
// avisa solo cuando algo cambia (no por frame), así que React re-renderiza solo esos avatares.

import { useSyncExternalStore } from "react";

const walking = new Set<string>();
const directions = new Map<string, number>();
const subs = new Set<() => void>();

/** Dirección Habbo por defecto: de frente, tres cuartos a la derecha. */
export const DEFAULT_DIRECTION = 2;

export function setWalking(id: string, on: boolean) {
  if (walking.has(id) === on) return;
  if (on) walking.add(id);
  else walking.delete(id);
  subs.forEach((fn) => fn());
}

export function setDirection(id: string, direction: number) {
  if ((directions.get(id) ?? DEFAULT_DIRECTION) === direction) return;
  directions.set(id, direction);
  subs.forEach((fn) => fn());
}

/**
 * Dirección Habbo (0–7) para una velocidad en pantalla (y hacia abajo), o null si está quieto.
 * Sectores de 45° desde el este: E=1, SE=2, S=3, SO=4, O=5, NO=6, N=7, NE=0.
 */
export function directionFor(vx: number, vy: number): number | null {
  if (!vx && !vy) return null;
  const sector = Math.round(Math.atan2(vy, vx) / (Math.PI / 4));
  return (((sector + 1) % 8) + 8) % 8;
}

function subscribe(fn: () => void) {
  subs.add(fn);
  return () => subs.delete(fn);
}

export function useWalking(id: string): boolean {
  return useSyncExternalStore(subscribe, () => walking.has(id), () => false);
}

export function useDirection(id: string): number {
  return useSyncExternalStore(
    subscribe,
    () => directions.get(id) ?? DEFAULT_DIRECTION,
    () => DEFAULT_DIRECTION,
  );
}
