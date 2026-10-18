// Contrato del cliente con la API (§9). Hay dos implementaciones:
// - mock: datos ficticios en memoria + localStorage (por defecto, hasta que la API esté lista)
// - http: llama a NEXT_PUBLIC_API_URL con el usuario elegido en la cabecera
// Se elige con NEXT_PUBLIC_API_MODE=mock|http.

import type {
  AiTutor,
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

export interface ApiClient {
  /** Login con DNI (8 dígitos) y contraseña. Por ahora cuentas de prueba. */
  login(dni: string, password: string): Promise<{ userId: UUID }>;
  testAccounts(): Promise<TestAccount[]>;
  listDemoUsers(): Promise<Profile[]>;
  me(userId: UUID): Promise<Me>;

  searchTopics(query: string): Promise<Topic[]>;

  createRequest(userId: UUID, input: NewRequestInput): Promise<{ requestId: UUID }>;
  myRequests(userId: UUID): Promise<(LearningRequest & { topic: Topic })[]>;
  cancelRequest(userId: UUID, requestId: UUID): Promise<void>;
  openRequestsFeed(userId: UUID): Promise<IncomingRequest[]>;

  match(userId: UUID, requestId: UUID): Promise<MatchOptions>;
  listAiTutors(): Promise<AiTutor[]>;

  book(userId: UUID, input: BookingInput): Promise<BookingResult>;
  startGroupSession(userId: UUID, groupId: UUID): Promise<{ sessionId: UUID }>;
  session(userId: UUID, sessionId: UUID): Promise<SessionDetail>;
  roomToken(userId: UUID, sessionId: UUID): Promise<RoomToken>;
  saveSessionDoc(userId: UUID, sessionId: UUID, markdown: string): Promise<void>;
  endSession(userId: UUID, sessionId: UUID): Promise<EndResult>;
  review(userId: UUID, sessionId: UUID, stars: number, feedback: string): Promise<void>;
  mySessions(userId: UUID): Promise<SessionDetail[]>;
  myUpcoming(userId: UUID): Promise<UpcomingClass[]>;

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

  ledger(userId: UUID): Promise<LedgerLine[]>;

  resetDemo(): Promise<void>;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public code: "insufficient_funds" | "not_found" | "invalid" | "conflict" | "network" | "unauthorized" = "invalid",
  ) {
    super(message);
  }
}
