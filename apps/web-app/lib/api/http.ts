// Implementación HTTP del ApiClient contra la API Node (§9).
// Mientras no haya login, el usuario demo elegido viaja en la cabecera x-demo-user.

import type { ApiClient } from "@/lib/api/client";
import { ApiError } from "@/lib/api/client";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080/api";

async function call<T>(userId: string | null, method: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers: {
        "content-type": "application/json",
        ...(userId ? { "x-demo-user": userId } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError("No pudimos conectar con el servidor. Revisa tu conexión.", "network");
  }
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string; code?: ApiError["code"] };
    const fallback = res.status === 404 ? "not_found" : res.status === 401 ? "unauthorized" : "invalid";
    throw new ApiError(data.error ?? `Error ${res.status}`, data.code ?? fallback);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

const q = encodeURIComponent;

export const httpApi: ApiClient = {
  login: (dni, password) => call(null, "POST", "/auth/login", { dni, password }),
  testAccounts: () => call(null, "GET", "/demo/accounts"),
  listDemoUsers: () => call(null, "GET", "/demo/users"),
  me: (u) => call(u, "GET", "/me"),
  searchTopics: (query) => call(null, "GET", `/topics?query=${q(query)}`),
  createRequest: (u, input) => call(u, "POST", "/requests", input),
  myRequests: (u) => call(u, "GET", "/requests/mine"),
  cancelRequest: (u, id) => call(u, "POST", `/requests/${q(id)}/cancel`),
  openRequestsFeed: (u) => call(u, "GET", "/requests/open"),
  match: (u, id) => call(u, "GET", `/match/${q(id)}`),
  listAiTutors: () => call(null, "GET", "/ai-tutors"),
  book: (u, input) => call(u, "POST", "/sessions", input),
  startGroupSession: (u, groupId) => call(u, "POST", `/groups/${q(groupId)}/start`),
  session: (u, id) => call(u, "GET", `/sessions/${q(id)}`),
  roomToken: (u, id) => call(u, "POST", `/sessions/${q(id)}/token`),
  saveSessionDoc: (u, id, markdown) => call(u, "PUT", `/sessions/${q(id)}/doc`, { markdown }),
  endSession: (u, id) => call(u, "POST", `/sessions/${q(id)}/end`),
  review: (u, id, stars, feedback) => call(u, "POST", `/sessions/${q(id)}/review`, { stars, feedback }),
  mySessions: (u) => call(u, "GET", "/sessions/mine"),
  myUpcoming: (u) => call(u, "GET", "/groups/mine"),
  tutorProfile: (id) => call(null, "GET", `/tutors/${q(id)}`),
  tutorPanel: (u) => call(u, "GET", "/tutor/panel"),
  declareTopic: (u, topicId, level) => call(u, "POST", "/tutor/topics", { topicId, level }),
  removeTopic: (u, topicId) => call(u, "DELETE", `/tutor/topics/${q(topicId)}`),
  setTutorSettings: (u, groupPrice, availability) => call(u, "PUT", "/tutor/settings", { groupPrice, availability }),
  acceptRequest: (u, id, scheduledAt) => call(u, "POST", `/requests/${q(id)}/accept`, { scheduledAt }),
  myPrivateReviews: (u) => call(u, "GET", "/reviews/mine"),
  skins: (u) => call(u, "GET", "/skins"),
  buySkin: (u, id) => call(u, "POST", `/skins/${q(id)}/buy`),
  equipSkin: (u, id, equip) => call(u, "POST", `/skins/${q(id)}/equip`, { equip }),
  ledger: (u) => call(u, "GET", "/ledger/mine"),
  resetDemo: () => call(null, "POST", "/demo/reset"),
};
