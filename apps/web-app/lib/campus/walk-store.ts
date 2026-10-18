// Quién está caminando en el campus. El bucle de movimiento de world.tsx avisa solo cuando alguien
// empieza o deja de caminar (no por frame), así que React re-renderiza solo esos avatares.

import { useSyncExternalStore } from "react";

const walking = new Set<string>();
const subs = new Set<() => void>();

export function setWalking(id: string, on: boolean) {
  if (walking.has(id) === on) return;
  if (on) walking.add(id);
  else walking.delete(id);
  subs.forEach((fn) => fn());
}

function subscribe(fn: () => void) {
  subs.add(fn);
  return () => subs.delete(fn);
}

export function useWalking(id: string): boolean {
  return useSyncExternalStore(subscribe, () => walking.has(id), () => false);
}
