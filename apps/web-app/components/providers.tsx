"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { api, ApiError } from "@/lib/api";
import type { Me } from "@/lib/types";
import { cn } from "@/lib/utils";

const USER_KEY = "aulaquipu-user";

interface SessionCtx {
  userId: string | null;
  ready: boolean;
  me: Me | null;
  version: number;
  selectUser: (id: string | null) => void;
  invalidate: () => void;
}

interface Toast {
  id: number;
  message: string;
  tone: "info" | "success" | "error";
}

interface ToastCtx {
  toast: (message: string, tone?: Toast["tone"]) => void;
}

const Session = createContext<SessionCtx | null>(null);
const Toasts = createContext<ToastCtx | null>(null);

// Usuario elegido, guardado en localStorage. useSyncExternalStore evita desajustes de hidratación:
// en el servidor vale `undefined` (aún no sabemos), en el cliente `string | null`.
const userListeners = new Set<() => void>();
let userCache: string | null | undefined;

function readUser(): string | null {
  if (userCache !== undefined) return userCache;
  try {
    userCache = window.localStorage.getItem(USER_KEY);
  } catch {
    userCache = null;
  }
  return userCache;
}

function writeUser(id: string | null) {
  userCache = id;
  try {
    if (id) window.localStorage.setItem(USER_KEY, id);
    else window.localStorage.removeItem(USER_KEY);
  } catch {
    // sin almacenamiento: se elige usuario en cada visita
  }
  userListeners.forEach((fn) => fn());
}

const subscribeUser = (fn: () => void) => {
  userListeners.add(fn);
  return () => {
    userListeners.delete(fn);
  };
};

export function Providers({ children }: { children: React.ReactNode }) {
  const storedUser = useSyncExternalStore(subscribeUser, readUser, () => undefined);
  const ready = storedUser !== undefined;
  const userId = storedUser ?? null;
  const [meState, setMeState] = useState<{ id: string; me: Me } | null>(null);
  const me = meState && meState.id === userId ? meState.me : null;
  const [version, setVersion] = useState(0);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(0);

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    api
      .me(userId)
      .then((m) => alive && setMeState({ id: userId, me: m }))
      .catch((e: unknown) => {
        // Solo se cierra la sesión si el servidor dice que no es válida (no por un corte de red)
        const code = e instanceof ApiError ? e.code : null;
        if (alive && (code === "unauthorized" || code === "not_found")) writeUser(null);
      });
    return () => {
      alive = false;
    };
  }, [userId, version]);

  const selectUser = useCallback((id: string | null) => writeUser(id), []);

  const invalidate = useCallback(() => setVersion((v) => v + 1), []);

  const toast = useCallback((message: string, tone: Toast["tone"] = "info") => {
    const id = ++toastId.current;
    setToasts((t) => [...t, { id, message, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);

  const session = useMemo(
    () => ({ userId, ready, me, version, selectUser, invalidate }),
    [userId, ready, me, version, selectUser, invalidate],
  );

  return (
    <Session.Provider value={session}>
      <Toasts.Provider value={useMemo(() => ({ toast }), [toast])}>
        {children}
        <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[100] flex flex-col items-center gap-2 px-4 md:bottom-6">
          {toasts.map((t) => (
            <div
              key={t.id}
              role="status"
              className={cn(
                "pointer-events-auto max-w-sm rounded-2xl px-4 py-3 text-sm font-semibold shadow-lg animate-in fade-in slide-in-from-bottom-2",
                t.tone === "error" && "bg-destructive text-white",
                t.tone === "success" && "bg-navy text-white",
                t.tone === "info" && "bg-card text-foreground ring-1 ring-border",
              )}
            >
              {t.message}
            </div>
          ))}
        </div>
      </Toasts.Provider>
    </Session.Provider>
  );
}

export function useSession() {
  const ctx = useContext(Session);
  if (!ctx) throw new Error("useSession fuera de <Providers>");
  return ctx;
}

export function useToast() {
  const ctx = useContext(Toasts);
  if (!ctx) throw new Error("useToast fuera de <Providers>");
  return ctx.toast;
}

/** Carga datos del usuario actual; se recarga cuando cambian el usuario, `deps` o tras invalidate(). */
export function useQuery<T>(fn: (userId: string) => Promise<T>, deps: unknown[] = []) {
  const { userId, version } = useSession();
  const key = JSON.stringify([userId, version, ...deps]);
  const [state, setState] = useState<{ key: string | null; data: T | null; error: string | null }>({
    key: null,
    data: null,
    error: null,
  });
  const load = useEffectEvent((u: string) => fn(u));

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    load(userId)
      .then((data) => alive && setState({ key, data, error: null }))
      .catch(
        (e: unknown) =>
          alive && setState((s) => ({ key, data: s.data, error: e instanceof Error ? e.message : "Algo salió mal" })),
      );
    return () => {
      alive = false;
    };
  }, [key, userId]);

  // Mientras recarga se conserva el dato anterior para no parpadear
  return { data: state.data, error: state.error, loading: state.key !== key };
}

/** Ejecuta una mutación, muestra el error como toast y refresca los datos del usuario. */
export function useMutation() {
  const { userId, invalidate } = useSession();
  const toast = useToast();
  const [pending, setPending] = useState(false);

  const run = useCallback(
    async <T,>(fn: (userId: string) => Promise<T>, success?: string): Promise<T | undefined> => {
      if (!userId) return undefined;
      setPending(true);
      try {
        const result = await fn(userId);
        invalidate();
        if (success) toast(success, "success");
        return result;
      } catch (e) {
        const msg = e instanceof ApiError || e instanceof Error ? e.message : "Algo salió mal";
        toast(msg, "error");
        return undefined;
      } finally {
        setPending(false);
      }
    },
    [userId, invalidate, toast],
  );

  return { run, pending };
}
