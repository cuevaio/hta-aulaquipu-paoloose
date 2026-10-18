// API de AulaQuipu (§9) como route handler catch-all. La sesión va en una cookie
// httpOnly firmada; la secret key de Supabase y las claves de LiveKit nunca salen del servidor.

import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import {
  createSessionValue,
  HttpError,
  readSessionValue,
  SESSION_COOKIE,
  SESSION_TTL_S,
} from "@/lib/server/core";
import * as h from "@/lib/server/handlers";
import * as ad from "@/lib/server/admin-handlers";
import { isAdmin, requireAdmin, requireNotSuspended } from "@/lib/server/admin";

type Ctx = { user: string; body: Record<string, unknown>; params: string[]; query: URLSearchParams };
type Handler = (ctx: Ctx) => Promise<unknown>;

interface Route {
  method: string;
  pattern: string[]; // ":x" captura un segmento
  handler: Handler;
  public?: boolean;
  /** Exige que la sesión sea de un administrador (comprobado en el servidor). */
  admin?: boolean;
}

const r = (method: string, path: string, handler: Handler, isPublic = false): Route => ({
  method,
  pattern: path.split("/").filter(Boolean),
  handler,
  public: isPublic,
});

/** Ruta del panel: sesión + admin obligatorios. */
const a = (method: string, path: string, handler: Handler): Route => ({ ...r(method, path, handler), admin: true });

const ROUTES: Route[] = [
  r("GET", "demo/accounts", () => h.testAccounts(), true),
  r("GET", "demo/users", () => h.demoUsers()),
  r("GET", "me", ({ user }) => h.me(user)),
  r("GET", "topics", ({ query }) => h.searchTopics(query.get("query") ?? "")),
  r("POST", "requests", ({ user, body }) => h.createRequest(user, body)),
  r("GET", "requests/mine", ({ user }) => h.myRequests(user)),
  r("GET", "requests/open", ({ user }) => h.openRequestsFeed(user)),
  r("POST", "requests/:id/cancel", ({ user, params }) => h.cancelRequest(user, params[0])),
  r("POST", "requests/:id/accept", ({ user, params, body }) => h.acceptRequest(user, params[0], body)),
  r("GET", "match/:id", ({ user, params }) => h.match(user, params[0])),
  r("GET", "ai-tutors", ({ user }) => h.listAiTutors(user)),
  r("POST", "sessions", ({ user, body }) => h.book(user, body)),
  r("GET", "sessions/mine", ({ user }) => h.mySessions(user)),
  r("GET", "sessions/:id", ({ user, params }) => h.session(user, params[0])),
  r("POST", "sessions/:id/token", ({ user, params }) => h.roomToken(user, params[0])),
  r("PUT", "sessions/:id/doc", ({ user, params, body }) => h.saveSessionDoc(user, params[0], body)),
  r("POST", "sessions/:id/end", ({ user, params }) => h.endSession(user, params[0])),
  r("POST", "sessions/:id/review", ({ user, params, body }) => h.review(user, params[0], body)),
  r("GET", "groups/mine", ({ user }) => h.myUpcoming(user)),
  r("POST", "groups/:id/start", ({ user, params }) => h.startGroupSession(user, params[0])),
  r("GET", "tutors/:id", ({ params }) => h.tutorProfile(params[0])),
  r("GET", "tutor/panel", ({ user }) => h.tutorPanel(user)),
  r("POST", "tutor/topics", ({ user, body }) => h.declareTopic(user, body)),
  r("DELETE", "tutor/topics/:id", ({ user, params }) => h.removeTopic(user, params[0])),
  r("PUT", "tutor/settings", ({ user, body }) => h.setTutorSettings(user, body)),
  r("GET", "reviews/mine", ({ user }) => h.myPrivateReviews(user)),
  r("GET", "skins", ({ user }) => h.skins(user)),
  r("POST", "skins/:id/buy", ({ user, params }) => h.buySkin(user, params[0])),
  r("POST", "skins/:id/equip", ({ user, params, body }) => h.equipSkin(user, params[0], body)),
  r("GET", "ledger/mine", ({ user }) => h.ledger(user)),
  r("POST", "campus/token", ({ user }) => h.campusToken(user)),

  // Panel de administración. admin/me solo pide sesión: dice si eres admin sin dar 403.
  r("GET", "admin/me", async ({ user }) => ({ isAdmin: await isAdmin(user) })),
  a("GET", "admin/metrics", () => ad.metrics()),
  a("GET", "admin/audit", () => ad.auditLog()),
  a("GET", "admin/users", ({ query }) => ad.searchUsers(query)),
  a("GET", "admin/credits/options", () => ad.creditOptions()),
  a("GET", "admin/credits/preview", ({ query }) => ad.creditsPreview(query)),
  a("POST", "admin/credits", ({ user, body }) => ad.grantCredits(user, body)),
  a("GET", "admin/ai-tutors", () => ad.aiTutorList()),
  a("POST", "admin/ai-tutors", ({ user, body }) => ad.createAiTutor(user, body)),
  a("PUT", "admin/ai-tutors/:id", ({ user, params, body }) => ad.updateAiTutor(user, params[0], body)),
  a("GET", "admin/ai-tutors/:id/price", ({ params }) => ad.aiPrice(params[0])),
  a("PUT", "admin/ai-tutors/:id/price", ({ user, params, body }) => ad.setAiPrice(user, params[0], body)),
  a("GET", "admin/promotions", () => ad.promotions()),
  a("POST", "admin/promotions", ({ user, body }) => ad.createPromotion(user, body)),
  a("PUT", "admin/promotions/:id", ({ user, params, body }) => ad.updatePromotion(user, params[0], body)),
  a("DELETE", "admin/promotions/:id", ({ user, params }) => ad.deletePromotion(user, params[0])),
  a("GET", "admin/topics", () => ad.topicList()),
  a("POST", "admin/topics/merge", ({ user, body }) => ad.mergeTopics(user, body)),
  a("PUT", "admin/topics/:id", ({ user, params, body }) => ad.updateTopic(user, params[0], body)),
  a("GET", "admin/skins", () => ad.skinList()),
  a("POST", "admin/skins", ({ user, body }) => ad.createSkin(user, body)),
  a("PUT", "admin/skins/:id", ({ user, params, body }) => ad.updateSkin(user, params[0], body)),
  a("GET", "admin/guides", () => ad.guideList()),
  a("GET", "admin/guides/:topicId", ({ params }) => ad.guideOf(params[0])),
  a("PUT", "admin/guides/:topicId", ({ user, params, body }) => ad.saveGuide(user, params[0], body)),
  a("DELETE", "admin/guides/:topicId", ({ user, params }) => ad.deleteGuide(user, params[0])),
];

function find(method: string, segments: string[]): { route: Route; params: string[] } | null {
  for (const route of ROUTES) {
    if (route.method !== method || route.pattern.length !== segments.length) continue;
    const params: string[] = [];
    const ok = route.pattern.every((p, i) => {
      if (p.startsWith(":")) {
        params.push(decodeURIComponent(segments[i]));
        return true;
      }
      return p === segments[i];
    });
    if (ok) return { route, params };
  }
  return null;
}

const json = (data: unknown, status = 200) =>
  data === undefined ? new Response(null, { status: 204 }) : Response.json(data, { status, headers: { "cache-control": "no-store" } });

const fail = (e: HttpError) => Response.json({ error: e.message, code: e.code }, { status: e.status, headers: { "cache-control": "no-store" } });

function clientIp(req: NextRequest) {
  return req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "local";
}

/** Las mutaciones solo se aceptan desde el mismo origen y con JSON (bloquea CSRF con formularios). */
function checkMutation(req: NextRequest) {
  const origin = req.headers.get("origin");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (origin && host && new URL(origin).host !== host) throw new HttpError(403, "Origen no permitido.", "forbidden");
  const type = req.headers.get("content-type") ?? "";
  if (req.method !== "DELETE" && !type.includes("application/json")) {
    throw new HttpError(415, "Se esperaba JSON.");
  }
}

async function readBody(req: NextRequest): Promise<Record<string, unknown>> {
  if (req.method === "GET" || req.method === "DELETE") return {};
  const text = await req.text();
  if (text.length > 256_000) throw new HttpError(413, "Solicitud demasiado grande.");
  if (!text) return {};
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    throw new HttpError(400, "JSON inválido.");
  }
}

const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};

async function handle(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  try {
    if (req.method !== "GET") checkMutation(req);
    const jar = await cookies();

    if (req.method === "POST" && path.join("/") === "auth/login") {
      const { userId } = await h.login(await readBody(req), clientIp(req));
      jar.set(SESSION_COOKIE, createSessionValue(userId), { ...cookieOptions, maxAge: SESSION_TTL_S });
      return json({ userId });
    }
    if (req.method === "POST" && path.join("/") === "auth/logout") {
      jar.delete(SESSION_COOKIE);
      return json(undefined);
    }

    const hit = find(req.method, path);
    if (!hit) throw new HttpError(404, "Ruta no encontrada.", "not_found");
    const user = readSessionValue(jar.get(SESSION_COOKIE)?.value);
    if (!user && !hit.route.public) throw new HttpError(401, "Tu sesión expiró. Vuelve a entrar.", "unauthorized");
    if (user && !hit.route.public) await requireNotSuspended(user);
    if (hit.route.admin) await requireAdmin(user ?? "");
    const body = await readBody(req);
    return json(await hit.route.handler({ user: user ?? "", body, params: hit.params, query: req.nextUrl.searchParams }));
  } catch (e) {
    if (e instanceof HttpError) return fail(e);
    console.error("[api]", req.method, path.join("/"), e);
    return fail(new HttpError(500, "Algo salió mal en el servidor. Intenta de nuevo."));
  }
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const DELETE = handle;
