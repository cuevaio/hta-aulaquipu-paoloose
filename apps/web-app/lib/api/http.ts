// Implementación HTTP del ApiClient contra la API de Next.js (app/api/[...path]).
// La identidad viaja en una cookie httpOnly firmada por el servidor tras el login;
// el parámetro userId de cada método solo existe por compatibilidad con el mock.

import type { AdminApi, ApiClient } from "@/lib/api/client";
import { ApiError } from "@/lib/api/client";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "/api";

async function call<T>(_userId: string | null, method: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      credentials: "same-origin",
      cache: "no-store",
      headers: { "content-type": "application/json" },
      body: method === "GET" || method === "DELETE" ? undefined : JSON.stringify(body ?? {}),
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

const admin: AdminApi = {
  me: (u) => call(u, "GET", "/admin/me"),
  metrics: (u) => call(u, "GET", "/admin/metrics"),
  audit: (u) => call(u, "GET", "/admin/audit"),
  searchUsers: (u, query) => call(u, "GET", `/admin/users?query=${q(query)}`),
  creditOptions: (u) => call(u, "GET", "/admin/credits/options"),
  creditsPreview: (u, scope, value) => call(u, "GET", `/admin/credits/preview?scope=${q(scope)}&value=${q(value ?? "")}`),
  grantCredits: (u, input) => call(u, "POST", "/admin/credits", input),
  aiTutors: (u) => call(u, "GET", "/admin/ai-tutors"),
  setAiPrice: (u, id, price) => call(u, "PUT", `/admin/ai-tutors/${q(id)}/price`, { price }),
  promotions: (u) => call(u, "GET", "/admin/promotions"),
  savePromotion: (u, id, input) =>
    id ? call(u, "PUT", `/admin/promotions/${q(id)}`, input) : call(u, "POST", "/admin/promotions", input),
  deletePromotion: (u, id) => call(u, "DELETE", `/admin/promotions/${q(id)}`),
  guides: (u) => call(u, "GET", "/admin/guides"),
  guide: (u, topicId) => call(u, "GET", `/admin/guides/${q(topicId)}`),
  saveGuide: (u, topicId, input) => call(u, "PUT", `/admin/guides/${q(topicId)}`, input),
  deleteGuide: (u, topicId) => call(u, "DELETE", `/admin/guides/${q(topicId)}`),
  topicImages: (u, topicId) => call(u, "GET", `/admin/topics/${q(topicId)}/images`),
  addTopicImage: (u, topicId, input) => call(u, "POST", `/admin/topics/${q(topicId)}/images`, input),
  deleteTopicImage: (u, imageId) => call(u, "DELETE", `/admin/topic-images/${q(imageId)}`),
  topics: (u) => call(u, "GET", "/admin/topics"),
  updateTopic: (u, id, patch) => call(u, "PUT", `/admin/topics/${q(id)}`, patch),
  mergeTopics: (u, sourceId, targetId) => call(u, "POST", "/admin/topics/merge", { sourceId, targetId }),
  saveAiTutor: (u, id, input) =>
    id ? call(u, "PUT", `/admin/ai-tutors/${q(id)}`, input) : call(u, "POST", "/admin/ai-tutors", input),
  skins: (u) => call(u, "GET", "/admin/skins"),
  saveSkin: (u, id, input) => (id ? call(u, "PUT", `/admin/skins/${q(id)}`, input) : call(u, "POST", "/admin/skins", input)),
  moderationUsers: (u, query) => call(u, "GET", `/admin/moderation/users?query=${q(query)}`),
  suspendUser: (u, id, reason) => call(u, "POST", `/admin/users/${q(id)}/suspend`, { reason }),
  reactivateUser: (u, id) => call(u, "POST", `/admin/users/${q(id)}/reactivate`),
  chatReports: (u) => call(u, "GET", "/admin/reports"),
  resolveReport: (u, id, suspend) => call(u, "POST", `/admin/reports/${q(id)}/resolve`, { suspend }),
  stuckSessions: (u) => call(u, "GET", "/admin/sessions/stuck"),
  cancelSession: (u, id) => call(u, "POST", `/admin/sessions/${q(id)}/cancel`),
  announcements: (u) => call(u, "GET", "/admin/announcements"),
  saveAnnouncement: (u, id, input) =>
    id ? call(u, "PUT", `/admin/announcements/${q(id)}`, input) : call(u, "POST", "/admin/announcements", input),
  deleteAnnouncement: (u, id) => call(u, "DELETE", `/admin/announcements/${q(id)}`),
};

export const httpApi: ApiClient = {
  admin,
  login: (dni, password) => call(null, "POST", "/auth/login", { dni, password }),
  logout: () => call(null, "POST", "/auth/logout"),
  testAccounts: () => call(null, "GET", "/demo/accounts"),
  listDemoUsers: () => call(null, "GET", "/demo/users"),
  me: (u) => call(u, "GET", "/me"),
  searchTopics: (query) => call(null, "GET", `/topics?query=${q(query)}`),
  createRequest: (u, input) => call(u, "POST", "/requests", input),
  myRequests: (u) => call(u, "GET", "/requests/mine"),
  cancelRequest: (u, id) => call(u, "POST", `/requests/${q(id)}/cancel`),
  openRequestsFeed: (u) => call(u, "GET", "/requests/open"),
  match: (u, id) => call(u, "GET", `/match/${q(id)}`),
  listAiTutors: (u) => call(u ?? null, "GET", "/ai-tutors"),
  book: (u, input) => call(u, "POST", "/sessions", input),
  startGroupSession: (u, groupId) => call(u, "POST", `/groups/${q(groupId)}/start`),
  session: (u, id) => call(u, "GET", `/sessions/${q(id)}`),
  roomToken: (u, id) => call(u, "POST", `/sessions/${q(id)}/token`),
  saveSessionDoc: (u, id, markdown) => call(u, "PUT", `/sessions/${q(id)}/doc`, { markdown }),
  director: (u, id, input) => call(u, "POST", `/sessions/${q(id)}/director`, input),
  answerQuiz: (u, id, quizId, index) => call(u, "POST", `/sessions/${q(id)}/quiz/${q(quizId)}/answer`, { index }),
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
  saveAvatar: (u, avatar) => call(u, "PUT", "/me/avatar", { avatar }),
  ledger: (u) => call(u, "GET", "/ledger/mine"),
  activeAnnouncements: (u) => call(u, "GET", "/announcements/active"),
  reportChat: (u, reportedId, text) => call(u, "POST", "/chat/report", { reportedId, text }),
  campusToken: (u) => call(u, "POST", "/campus/token"),
  resetDemo: async () => {
    throw new ApiError("Reiniciar la demo solo existe en modo mock.", "invalid");
  },
};
