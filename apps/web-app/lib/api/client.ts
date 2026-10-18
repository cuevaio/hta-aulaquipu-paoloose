// Contrato del cliente con la API (§9). Hay dos implementaciones:
// - mock: datos ficticios en memoria + localStorage (por defecto, hasta que la API esté lista)
// - http: llama a NEXT_PUBLIC_API_URL con el usuario elegido en la cabecera
// Se elige con NEXT_PUBLIC_API_MODE=mock|http.

import type { DirectorInput, DirectorResult, QuizVerdict } from "@/lib/director";
import type {
  AdminAiTutor,
  AdminGuide,
  AdminGuideTopic,
  AdminSkin,
  Announcement,
  AnnouncementInput,
  ChatReport,
  AdminTopic,
  AiTutorInput,
  AdminMetrics,
  AdminUser,
  AiPromotion,
  AuditRow,
  CreditOptions,
  CreditScope,
  CreditsInput,
  CreditsResult,
  MergeResult,
  ModUser,
  PromotionInput,
  SkinInput,
  StuckSession,
  TopicPatch,
  TopicGuide,
  TopicImage,
  TopicImageInput,
} from "@/lib/admin-types";
import type {
  ActiveAnnouncement,
  AiTutor,
  AvatarConfig,
  Group,
  IncomingRequest,
  LearningRequest,
  LedgerLine,
  Level,
  MatchOptions,
  Me,
  PrivateReview,
  Profile,
  PublicProfile,
  RequestMode,
  SessionDetail,
  Skin,
  Topic,
  TutorPanel,
  UUID,
} from "@/lib/types";

export interface NewRequestInput {
  text: string;
  mode: RequestMode;
  preferredAt: string | null;
}

export type BookingInput =
  | { kind: "ai"; aiTutorId: UUID; requestId: UUID | null }
  | { kind: "human"; tutorId: UUID; requestId: UUID }
  | { kind: "group"; groupId: UUID };

export interface BookingResult {
  sessionId: UUID | null;
  groupId: UUID | null;
  scheduledAt: string | null;
}

export interface TestAccount {
  dni: string;
  password: string;
  profile: Profile;
}

export interface UpcomingClass {
  group: Group;
  topic: Topic;
  role: "student" | "tutor";
  tutor: Profile | null;
  members: Profile[];
  myShare: number | null;
  liveSessionId: UUID | null;
}

/** Lobby de una clase IA compartida: el anfitrión decide cuándo empieza. */
export interface LobbyDetail {
  group: Group;
  topic: Topic;
  aiTutor: AiTutor | null;
  host: Profile | null;
  members: { profile: Profile; share: number; isHost: boolean }[];
  isMember: boolean;
  isHost: boolean;
  /** Lo que paga cada uno ahora si ya estás, o lo que pagarías al unirte. */
  shareIfJoin: number;
  liveSessionId: UUID | null;
}

/** Invitación a un lobby abierto (para quienes están conectados). */
export interface LobbyInvite {
  groupId: UUID;
  topic: Topic;
  detail: string | null;
  host: Profile | null;
  aiTutor: AiTutor | null;
  members: number;
  shareIfJoin: number;
  createdAt: string;
}

/** Estado de la "llamada" del profe a su clase: quién está conectado y si ya empezó. */
export interface GroupCall {
  liveSessionId: UUID | null;
  members: { id: UUID; name: string; online: boolean }[];
}

export type AssistMode = "explain" | "exercises" | "summary" | "improve" | "free";

export interface AssistInput {
  mode: AssistMode;
  /** Lo que pide el profe; opcional en los atajos. */
  prompt?: string;
  /** Texto seleccionado en el documento (para "mejorar"). */
  selection?: string;
  /** Final del documento, como contexto. */
  doc?: string;
}

export interface EndResult {
  alreadyEnded: boolean;
  paid: number;
  earned: number;
}

export interface RoomToken {
  livekitUrl: string | null;
  token: string | null;
  yjsUrl: string | null;
  docName: string;
}

/** Panel de administración. El servidor exige sesión + admin en cada llamada (excepto me). */
export interface AdminApi {
  me(userId: UUID): Promise<{ isAdmin: boolean }>;
  metrics(userId: UUID): Promise<AdminMetrics>;
  audit(userId: UUID): Promise<AuditRow[]>;
  searchUsers(userId: UUID, query: string): Promise<AdminUser[]>;
  creditOptions(userId: UUID): Promise<CreditOptions>;
  creditsPreview(userId: UUID, scope: CreditScope, value?: string): Promise<{ count: number }>;
  grantCredits(userId: UUID, input: CreditsInput): Promise<CreditsResult>;
  aiTutors(userId: UUID): Promise<AdminAiTutor[]>;
  setAiPrice(userId: UUID, aiTutorId: UUID, price: number): Promise<void>;
  promotions(userId: UUID): Promise<AiPromotion[]>;
  /** id = null crea; con id edita. */
  savePromotion(userId: UUID, id: UUID | null, input: PromotionInput): Promise<AiPromotion>;
  deletePromotion(userId: UUID, id: UUID): Promise<void>;
  guides(userId: UUID): Promise<AdminGuideTopic[]>;
  guide(userId: UUID, topicId: UUID): Promise<AdminGuide>;
  saveGuide(userId: UUID, topicId: UUID, input: TopicGuide): Promise<AdminGuide>;
  deleteGuide(userId: UUID, topicId: UUID): Promise<void>;
  topicImages(userId: UUID, topicId: UUID): Promise<TopicImage[]>;
  addTopicImage(userId: UUID, topicId: UUID, input: TopicImageInput): Promise<TopicImage>;
  deleteTopicImage(userId: UUID, imageId: UUID): Promise<void>;
  topics(userId: UUID): Promise<AdminTopic[]>;
  updateTopic(userId: UUID, topicId: UUID, patch: TopicPatch): Promise<void>;
  /** Mueve pedidos, tutores, grupos, clases y guía de `sourceId` a `targetId` y borra el origen. */
  mergeTopics(userId: UUID, sourceId: UUID, targetId: UUID): Promise<MergeResult>;
  /** id = null crea; con id edita (persona, temas, precio y pausa). */
  saveAiTutor(userId: UUID, id: UUID | null, input: AiTutorInput): Promise<AdminAiTutor>;
  skins(userId: UUID): Promise<AdminSkin[]>;
  /** id = null crea; con id edita (el tipo no cambia). */
  saveSkin(userId: UUID, id: UUID | null, input: SkinInput): Promise<AdminSkin>;
  /** Con 2+ caracteres busca; sin búsqueda lista a los suspendidos. */
  moderationUsers(userId: UUID, query: string): Promise<ModUser[]>;
  suspendUser(userId: UUID, targetId: UUID, reason: string): Promise<void>;
  reactivateUser(userId: UUID, targetId: UUID): Promise<void>;
  chatReports(userId: UUID): Promise<ChatReport[]>;
  /** `suspend` suspende además a la persona reportada. */
  resolveReport(userId: UUID, reportId: UUID, suspend: boolean): Promise<void>;
  stuckSessions(userId: UUID): Promise<StuckSession[]>;
  /** Cierra sin cobrar y libera los quipus retenidos. */
  cancelSession(userId: UUID, sessionId: UUID): Promise<{ released: number }>;
  announcements(userId: UUID): Promise<Announcement[]>;
  saveAnnouncement(userId: UUID, id: UUID | null, input: AnnouncementInput): Promise<Announcement>;
  deleteAnnouncement(userId: UUID, id: UUID): Promise<void>;
}

export interface ApiClient {
  admin: AdminApi;

  /** Login con DNI (8 dígitos) y contraseña. Por ahora cuentas de prueba. */
  login(dni: string, password: string): Promise<{ userId: UUID }>;
  logout(): Promise<void>;
  testAccounts(): Promise<TestAccount[]>;
  listDemoUsers(): Promise<Profile[]>;
  me(userId: UUID): Promise<Me>;

  searchTopics(query: string): Promise<Topic[]>;

  createRequest(userId: UUID, input: NewRequestInput): Promise<{ requestId: UUID }>;
  myRequests(userId: UUID): Promise<(LearningRequest & { topic: Topic })[]>;
  cancelRequest(userId: UUID, requestId: UUID): Promise<void>;
  openRequestsFeed(userId: UUID): Promise<IncomingRequest[]>;

  match(userId: UUID, requestId: UUID): Promise<MatchOptions>;
  /** Con `userId` trae el precio efectivo (promociones) para ese alumno. */
  listAiTutors(userId?: UUID): Promise<AiTutor[]>;

  book(userId: UUID, input: BookingInput): Promise<BookingResult>;
  startGroupSession(userId: UUID, groupId: UUID): Promise<{ sessionId: UUID }>;
  session(userId: UUID, sessionId: UUID): Promise<SessionDetail>;
  roomToken(userId: UUID, sessionId: UUID): Promise<RoomToken>;
  saveSessionDoc(userId: UUID, sessionId: UUID, markdown: string): Promise<void>;
  /** Director de clase: decide graficar / quiz / imagen a partir de lo dicho. Falla (503/429) sin romper el aula. */
  director(userId: UUID, sessionId: UUID, input: DirectorInput): Promise<DirectorResult>;
  /** Califica una pregunta enviada por el director (la clave vive en el servidor). */
  answerQuiz(userId: UUID, sessionId: UUID, quizId: string, index: number): Promise<QuizVerdict>;
  endSession(userId: UUID, sessionId: UUID): Promise<EndResult>;
  review(userId: UUID, sessionId: UUID, stars: number, feedback: string): Promise<void>;
  mySessions(userId: UUID): Promise<SessionDetail[]>;
  myUpcoming(userId: UUID): Promise<UpcomingClass[]>;
  /** Abre un lobby de clase IA compartida con tu tema; tú eres el anfitrión. */
  createAiLobby(userId: UUID, input: { aiTutorId: UUID; text: string }): Promise<{ groupId: UUID }>;
  lobby(userId: UUID, groupId: UUID): Promise<LobbyDetail>;
  leaveLobby(userId: UUID, groupId: UUID): Promise<void>;
  /** Solo el anfitrión: empieza la clase para todos los del lobby. */
  startLobby(userId: UUID, groupId: UUID): Promise<{ sessionId: UUID }>;
  /** Lobbies abiertos en los que podrías entrar (las invitaciones del campus). */
  openLobbies(userId: UUID): Promise<LobbyInvite[]>;
  /** El profe llama a su clase: devuelve quién está conectado y la adelanta a ahora si estaba más tarde. */
  callGroup(userId: UUID, groupId: UUID): Promise<GroupCall>;
  /** Asistente de IA del profe: genera texto en markdown para el documento de la clase. */
  assistDoc(userId: UUID, sessionId: UUID, input: AssistInput): Promise<{ markdown: string }>;

  tutorProfile(tutorId: UUID): Promise<PublicProfile>;
  tutorPanel(userId: UUID): Promise<TutorPanel>;
  declareTopic(userId: UUID, topicId: UUID, level: Level): Promise<void>;
  removeTopic(userId: UUID, topicId: UUID): Promise<void>;
  setTutorSettings(userId: UUID, groupPrice: number, availability: string[]): Promise<void>;
  acceptRequest(userId: UUID, requestId: UUID, scheduledAt: string): Promise<{ groupId: UUID }>;
  myPrivateReviews(userId: UUID): Promise<PrivateReview[]>;

  skins(userId: UUID): Promise<(Skin & { owned: boolean; equipped: boolean })[]>;
  buySkin(userId: UUID, skinId: UUID): Promise<void>;
  equipSkin(userId: UUID, skinId: UUID, equip: boolean): Promise<void>;
  /** Guarda el avatar del creador (solo piezas y colores del catálogo gratis). */
  saveAvatar(userId: UUID, avatar: AvatarConfig): Promise<void>;

  ledger(userId: UUID): Promise<LedgerLine[]>;

  /** Anuncios vigentes para el banner del campus. */
  activeAnnouncements(userId: UUID): Promise<ActiveAnnouncement[]>;
  /** Reporta un mensaje del chat del campus (texto de hasta 140 caracteres). */
  reportChat(userId: UUID, reportedId: UUID, text: string): Promise<void>;

  /** Token para el campus compartido (LiveKit). null si el servidor no tiene LiveKit. */
  campusToken(userId: UUID): Promise<{ url: string; token: string } | null>;

  resetDemo(): Promise<void>;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public code: "insufficient_funds" | "not_found" | "invalid" | "conflict" | "network" | "unauthorized" | "forbidden" | "suspended" = "invalid",
  ) {
    super(message);
  }
}
