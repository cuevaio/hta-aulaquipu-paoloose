// Panel de administración (solo servidor): quién es admin, quién está suspendido y la auditoría.
// Las rutas admin/* exigen sesión + admin en route.ts; nada depende de que la UI oculte botones.

import { db, env, HttpError, isMissingSchema } from "@/lib/server/core";

const CACHE_MS = 15_000;

interface Cached {
  value: boolean;
  at: number;
}

const adminCache = new Map<string, Cached>();
const suspendedCache = new Map<string, Cached>();
let warnedSchema = false;

function warnSchemaOnce() {
  if (warnedSchema) return;
  warnedSchema = true;
  console.warn("[api] falta aplicar backend/migrations/003_admin.sql: admins y suspensión desactivados hasta entonces");
}

async function cached(cache: Map<string, Cached>, id: string, load: () => Promise<boolean>): Promise<boolean> {
  const hit = cache.get(id);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;
  const value = await load();
  cache.set(id, { value, at: Date.now() });
  return value;
}

/** Perfiles administradores también pueden venir de ADMIN_PROFILE_IDS (ids separados por comas). */
function envAdmins(): string[] {
  return (env("ADMIN_PROFILE_IDS") ?? "")
    .split(",")
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);
}

export const isAdmin = (userId: string) =>
  cached(adminCache, userId, async () => {
    if (envAdmins().includes(userId.toLowerCase())) return true;
    const { data, error } = await db().from("admins").select("profile_id").eq("profile_id", userId).limit(1);
    if (error) {
      if (isMissingSchema(error)) {
        warnSchemaOnce();
        return false;
      }
      console.error("[api] no se pudo verificar admin", error.code, error.message);
      throw new HttpError(500, "Algo salió mal en el servidor. Intenta de nuevo.");
    }
    return (data?.length ?? 0) > 0;
  });

export async function requireAdmin(userId: string): Promise<void> {
  if (!(await isAdmin(userId))) throw new HttpError(403, "Solo administradores.", "forbidden");
}

/** Cuenta suspendida: se consulta con caché corto para no sumar una lectura a cada llamada. */
export const isSuspended = (userId: string) =>
  cached(suspendedCache, userId, async () => {
    const { data, error } = await db().from("profiles").select("suspended_at").eq("id", userId).limit(1);
    if (error) {
      if (isMissingSchema(error)) {
        warnSchemaOnce();
        return false;
      }
      console.error("[api] no se pudo verificar suspensión", error.code, error.message);
      throw new HttpError(500, "Algo salió mal en el servidor. Intenta de nuevo.");
    }
    return !!data?.[0]?.suspended_at;
  });

export async function requireNotSuspended(userId: string): Promise<void> {
  if (await isSuspended(userId)) throw new HttpError(403, "Tu cuenta está suspendida.", "suspended");
}

/** Para llamar tras suspender o reactivar: que el cambio se note de inmediato. */
export function forgetUser(userId: string) {
  adminCache.delete(userId);
  suspendedCache.delete(userId);
}

/** Registra una acción de admin. Toda mutación del panel debe llamarla. */
export async function audit(adminId: string, action: string, target: string | null, payload: Record<string, unknown> = {}) {
  const { error } = await db().from("admin_audit").insert({ admin_id: adminId, action, target, payload });
  if (error) {
    console.error("[api] no se pudo escribir la auditoría", action, error.code, error.message);
    throw new HttpError(500, "La acción se aplicó, pero no se pudo registrar en la auditoría.");
  }
}
