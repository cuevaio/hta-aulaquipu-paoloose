"use client";

// Avisos nativos del navegador (Notification API) para "tu profe está listo". Solo funcionan con la
// pestaña abierta (sin service worker ni push): el campus consulta tus clases cada pocos segundos.
// Todo acceso a Notification y a localStorage va protegido: puede no existir o estar bloqueado.

import { useSyncExternalStore } from "react";

export type NotifyState = "unsupported" | "default" | "granted" | "denied";

const EVENT = "aq:notify";

function read(): NotifyState {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission;
}

/** Estado del permiso; se actualiza solo al pedirlo desde esta app. */
export function useNotifyState(): NotifyState {
  return useSyncExternalStore(
    (cb) => {
      window.addEventListener(EVENT, cb);
      return () => window.removeEventListener(EVENT, cb);
    },
    read,
    () => "unsupported",
  );
}

/** Pide permiso (debe llamarse desde un clic). Devuelve el estado final. */
export async function askNotify(): Promise<NotifyState> {
  if (read() === "unsupported") return "unsupported";
  try {
    await Notification.requestPermission();
  } catch {
    /* navegadores antiguos usan callback; el estado se lee igual abajo */
  }
  window.dispatchEvent(new Event(EVENT));
  return read();
}

const ASKED_KEY = "aq:notify-asked";
let askedInMemory = false;

/**
 * Primera visita a la app en este navegador: pide el permiso una sola vez, sin esperar un clic.
 * Si el navegador lo bloquea sin gesto (p. ej. Safari) el estado sigue en "default" y quedan los
 * botones de la bienvenida y de la cola. Si lo rechazan, las invitaciones se ven solo dentro de la app.
 */
export async function askNotifyOnFirstVisit(): Promise<void> {
  if (read() !== "default") return;
  let asked = askedInMemory;
  try {
    asked = asked || localStorage.getItem(ASKED_KEY) === "1";
    localStorage.setItem(ASKED_KEY, "1");
  } catch {
    /* sin almacenamiento: se pide a lo sumo una vez por pestaña */
  }
  askedInMemory = true;
  if (!asked) await askNotify();
}

/** Muestra un aviso nativo. `tag` evita duplicados; al hacer clic se enfoca la ventana. */
export function showNotification(title: string, opts: { body: string; tag: string; onClick?: () => void }): boolean {
  if (read() !== "granted") return false;
  try {
    const n = new Notification(title, { body: opts.body, tag: opts.tag, icon: "/favicon.ico" });
    n.onclick = () => {
      window.focus();
      opts.onClick?.();
      n.close();
    };
    return true;
  } catch {
    return false;
  }
}

// ---- marcas por usuario: qué avisos ya se mostraron o se descartaron ----
const memory = new Set<string>();
const storeKey = (userId: string) => `aq:alerts:${userId}`;

function load(userId: string): Set<string> {
  try {
    const raw = localStorage.getItem(storeKey(userId));
    if (raw) return new Set(JSON.parse(raw) as string[]);
  } catch {
    /* sin almacenamiento */
  }
  return new Set(memory);
}

export function hasMark(userId: string, mark: string): boolean {
  return load(userId).has(mark) || memory.has(`${userId}|${mark}`);
}

export function addMark(userId: string, mark: string) {
  memory.add(`${userId}|${mark}`);
  try {
    const set = load(userId);
    set.add(mark);
    // Solo las últimas marcas: no crece sin límite
    localStorage.setItem(storeKey(userId), JSON.stringify([...set].slice(-100)));
  } catch {
    /* sin almacenamiento: vale mientras la pestaña siga abierta */
  }
}
