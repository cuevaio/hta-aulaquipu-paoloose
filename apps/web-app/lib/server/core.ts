// Núcleo del backend (solo servidor): entorno, cliente Supabase con secret key,
// sesión firmada en cookie y errores HTTP con mensajes en español.

import { createHmac, timingSafeEqual } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public code: "insufficient_funds" | "not_found" | "invalid" | "conflict" | "unauthorized" | "forbidden" | "suspended" | "unavailable" = "invalid",
  ) {
    super(message);
  }
}

// ---------- entorno ----------

export function env(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim() ? v.trim() : undefined;
}

function supabaseConfig() {
  const url = env("SUPABASE_URL") ?? env("NEXT_PUBLIC_SUPABASE_URL");
  const secret = env("SUPABASE_SECRET_KEY");
  if (!url || !secret) {
    throw new HttpError(
      503,
      "El servidor no está configurado: falta SUPABASE_URL o SUPABASE_SECRET_KEY en apps/web-app/.env.local.",
      "unavailable",
    );
  }
  return { url, secret };
}

let client: SupabaseClient | null = null;

/** Cliente con la secret key (service role): ignora RLS. Nunca llega al navegador. */
export function db(): SupabaseClient {
  if (client) return client;
  const { url, secret } = supabaseConfig();
  client = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
  return client;
}

// ---------- sesión (cookie firmada con HMAC) ----------

export const SESSION_COOKIE = "aq_session";
export const SESSION_TTL_S = 60 * 60 * 24 * 7;

function sessionKey(): Buffer {
  const explicit = env("AUTH_SECRET");
  if (explicit) return Buffer.from(explicit);
  // Sin AUTH_SECRET se deriva de la secret key de Supabase (nunca se expone)
  return createHmac("sha256", supabaseConfig().secret).update("aulaquipu-session-v1").digest();
}

const sign = (payload: string) => createHmac("sha256", sessionKey()).update(payload).digest("base64url");

export function createSessionValue(profileId: string): string {
  const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_S;
  const payload = `${profileId}.${exp}`;
  return `${payload}.${sign(payload)}`;
}

export function readSessionValue(value: string | undefined): string | null {
  if (!value) return null;
  const parts = value.split(".");
  if (parts.length !== 3) return null;
  const [profileId, exp, sig] = parts;
  if (!/^[0-9a-f-]{36}$/i.test(profileId) || !/^\d+$/.test(exp)) return null;
  if (Number(exp) < Date.now() / 1000) return null;
  const expected = Buffer.from(sign(`${profileId}.${exp}`));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  return profileId;
}

// ---------- errores de Postgres / RPC ----------

const RPC_ERRORS: Record<string, [number, string, HttpError["code"]]> = {
  saldo_insuficiente: [402, "No te alcanzan los quipus disponibles (las clases reservadas cuentan). Enseña para ganar más.", "insufficient_funds"],
  alumno_sin_saldo: [402, "Al alumno no le alcanzan los quipus para tu precio.", "insufficient_funds"],
  tutor_no_existe: [404, "Ese tutor no existe.", "not_found"],
  pedido_no_existe: [404, "No encontramos ese pedido.", "not_found"],
  grupo_no_existe: [404, "No encontramos ese grupo.", "not_found"],
  skin_no_existe: [404, "Ese artículo no existe.", "not_found"],
  pedido_no_disponible: [409, "Este pedido ya fue tomado.", "conflict"],
  grupo_no_disponible: [409, "Este grupo ya no acepta alumnos.", "conflict"],
  grupo_lleno: [409, "El grupo ya está completo (máximo 5).", "conflict"],
  clase_terminada: [409, "Esta clase ya terminó.", "conflict"],
  grupo_sin_tutor: [409, "Este grupo aún no tiene tutor.", "conflict"],
  grupo_vacio: [409, "Este grupo no tiene alumnos.", "conflict"],
  no_eres_parte: [403, "No eres parte de esta clase.", "forbidden"],
  no_puedes_contratarte: [400, "No puedes reservarte una clase a ti mismo.", "invalid"],
  no_puedes_ensenarte: [400, "No puedes aceptar tu propio pedido.", "invalid"],
  no_puedes_unirte_a_tu_clase: [400, "No puedes unirte a una clase que tú enseñas.", "invalid"],
  tutor_no_ensena_tema: [400, "Ese tutor no enseña este tema.", "invalid"],
  credito_monto_invalido: [400, "El monto va de 1 a 10000 quipus (positivo regala, negativo descuenta).", "invalid"],
  credito_motivo_invalido: [400, "El motivo debe tener entre 3 y 140 caracteres.", "invalid"],
  credito_alcance_invalido: [400, "Elige a quién aplicar los créditos.", "invalid"],
  perfil_no_existe: [404, "No encontramos a ese alumno.", "not_found"],
  tema_no_existe: [404, "Ese tema no existe.", "not_found"],
  tema_invalido: [400, "Elige dos temas distintos para unir.", "invalid"],
  clase_no_existe: [404, "No encontramos esa clase.", "not_found"],
  tutor_pausado: [409, "Este tutor IA está en pausa por ahora. Elige otro.", "conflict"],
  tutor_no_disponible: [409, "Este tutor IA no está disponible ahora. Elige otro.", "conflict"],
  no_eres_anfitrion: [403, "Solo quien abrió la clase puede iniciarla.", "forbidden"],
};

/** Códigos de Postgres/PostgREST cuando falta una tabla, función o columna (migración sin aplicar). */
const MISSING_SCHEMA = new Set(["42P01", "42883", "42703", "PGRST202", "PGRST204", "PGRST205"]);

export const isMissingSchema = (err: PgError | null | undefined) => !!err?.code && MISSING_SCHEMA.has(err.code);

interface PgError {
  message: string;
  code?: string;
}

export function fromDbError(err: PgError): HttpError {
  for (const [key, [status, msg, code]] of Object.entries(RPC_ERRORS)) {
    if (err.message?.includes(key)) return new HttpError(status, msg, code);
  }
  if (err.code === "23505") return new HttpError(409, "Eso ya estaba registrado.", "conflict");
  if (isMissingSchema(err)) {
    console.error("[api] falta aplicar una migración", err.code, err.message);
    return new HttpError(503, "Falta aplicar la migración 003_admin.sql en la base de datos.", "unavailable");
  }
  console.error("[api] error de base de datos", err.code, err.message);
  return new HttpError(500, "Algo salió mal en el servidor. Intenta de nuevo.", "invalid");
}

/** Desenvuelve una respuesta de supabase-js lanzando HttpError si falló. */
export async function must<T>(query: PromiseLike<{ data: unknown; error: PgError | null }>): Promise<T> {
  const { data, error } = await query;
  if (error) throw fromDbError(error);
  return data as T;
}

export async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  return must<T>(db().rpc(fn, args));
}
