// Tipos de dominio. Reflejan el DDL de backend/database.sql (§7 del documento de diseño).

import type { FigureSlot } from "@/lib/figure";

export type UUID = string;

export type Grade = 1 | 2 | 3 | 4 | 5;
export type Level = "basico" | "intermedio" | "avanzado";
export type RequestMode = "grupo" | "individual";
export type RequestStatus = "open" | "matched" | "fulfilled" | "cancelled";
export type GroupStatus = "forming" | "scheduled" | "live" | "completed" | "cancelled";
export type SessionStatus = "live" | "completed" | "cancelled";
export type TutorKind = "human" | "ai";
export type LedgerKind = "mint" | "session_payment" | "ai_session" | "skin_purchase" | "refund" | "grant" | "adjust";
/** avatar = color del cuerpo · head = diseño de cabeza · frame · badge · profile_deco */
export type SkinKind = "avatar" | "head" | "frame" | "badge" | "profile_deco";

export interface AvatarConfig {
  color?: string;
  shape?: "blob" | "round" | "bean";
  /** Formato de la base (demo_seed.sql): paleta con nombre. */
  palette?: string;
  /** Paperdoll: partes equipadas por slot (figura canónica). */
  slots?: Partial<Record<FigureSlot, string>>;
  /** Paperdoll: tono de piel y color de pelo (hex). La ropa usa `color`. */
  skin?: string;
  hair?: string;
  /** Figure string compacto derivado (para URLs/compartir), p.ej. "aq.body=blob.hat=chullo". */
  figure?: string;
}

export interface Profile {
  id: UUID;
  username: string;
  display_name: string;
  grade: Grade;
  school: string | null;
  avatar_config: AvatarConfig;
  created_at: string;
  /** Solo el mock lo usa: la API real nunca expone la suspensión. */
  suspended_at?: string | null;
  suspended_reason?: string | null;
}

export interface Topic {
  id: UUID;
  name: string;
  proposed_by: UUID | null;
  status: "active" | "flagged";
}

export interface TutorTopic {
  tutor_id: UUID;
  topic_id: UUID;
  level: Level;
}

export interface LearningRequest {
  id: UUID;
  student_id: UUID;
  topic_id: UUID;
  detail: string | null;
  mode: RequestMode;
  status: RequestStatus;
  preferred_at: string | null;
  created_at: string;
}

export interface AiPersona {
  emoji: string;
  color: string;
  tagline: string;
  style: string;
  voice: string;
  /** Especialidad (la usa el agente); la edita el admin. */
  focus?: string;
}

/** Promoción vigente que aplica a este alumno en un tutor IA. */
export interface AiPromoInfo {
  percent_off: number;
  first_class_free: boolean;
  ends_at: string;
}

export interface AiTutor {
  id: UUID;
  name: string;
  persona: AiPersona;
  /** Precio de lista. Lo que paga el alumno es `effective_price` (si no viene, es este). */
  price_quipus: number;
  /** false = pausado por un admin: no se lista ni se reserva. */
  active?: boolean;
  effective_price?: number;
  promo?: AiPromoInfo | null;
}

export interface Group {
  id: UUID;
  topic_id: UUID;
  tutor_id: UUID | null;
  ai_tutor_id: UUID | null;
  total_price_quipus: number;
  scheduled_at: string | null;
  status: GroupStatus;
  created_at: string;
}

export interface GroupMember {
  group_id: UUID;
  student_id: UUID;
  share_quipus: number;
  status: "joined" | "left";
}

export interface Session {
  id: UUID;
  group_id: UUID | null;
  request_id: UUID | null;
  tutor_kind: TutorKind;
  tutor_id: UUID | null;
  ai_tutor_id: UUID | null;
  room_name: string;
  price_quipus: number;
  status: SessionStatus;
  started_at: string;
  ended_at: string | null;
  topic_id: UUID;
  student_ids: UUID[];
  doc_markdown: string;
}

export interface LedgerEntry {
  id: number;
  session_id: UUID | null;
  from_profile: UUID | null;
  to_profile: UUID | null;
  amount: number;
  kind: LedgerKind;
  created_at: string;
  /** Motivo de un regalo o ajuste de la plataforma. */
  note?: string | null;
}

export interface Review {
  id: UUID;
  session_id: UUID;
  reviewer_id: UUID;
  tutor_id: UUID | null;
  ai_tutor_id: UUID | null;
  stars: number;
  feedback_private: string | null;
  created_at: string;
}

export interface SkinMeta {
  accessory?:
    | "chullo"
    | "lentes"
    | "corona"
    | "audifonos"
    | "birrete"
    | "flor"
    | "gorra"
    | "cresta"
    | "gato"
    | "lazo"
    | "sombrero"
    | "rulos"
    | "antenas";
  frame?: "basico" | "dorado" | "arcoiris" | "andino";
  deco?: "andes" | "cosmos" | "selva";
  color?: string;
  /** Paperdoll: slot + id de parte del registro (lib/avatar-parts) o de un spritesheet. */
  slot?: FigureSlot;
  item?: string;
  // Claves del catálogo en la base (database.sql): se traducen en lib/skins.ts
  palette?: string;
  border?: string;
  bg?: string;
  icon?: string;
  /** Ítems de un sistema de sprites (meta.sprite). Se dibujan como capas paperdoll. */
  sprite?: boolean;
}

export interface Skin {
  id: UUID;
  name: string;
  kind: SkinKind;
  price_quipus: number;
  meta: SkinMeta;
  /** false = oculto de la tienda por un admin (solo lo ven quienes ya lo tienen). */
  active?: boolean;
}

export interface ProfileSkin {
  profile_id: UUID;
  skin_id: UUID;
  equipped: boolean;
}

// ---- Vistas / respuestas compuestas de la API (§9) ----

export interface TutorStats {
  estrellas_promedio: number;
  sesiones_completadas: number;
}

export interface Badge {
  id: string;
  name: string;
  emoji: string;
  description: string;
}

export interface Equipped {
  /** Color del cuerpo */
  avatar: Skin | null;
  /** Diseño de cabeza (gorra, peinado, orejas…); se combina con el color */
  head?: Skin | null;
  frame: Skin | null;
  deco: Skin | null;
  /** Partes paperdoll equipadas (meta.item): una por slot, capas simultáneas. */
  parts: Skin[];
}

export interface Me {
  profile: Profile;
  balance: number;
  /** Saldo menos lo ya comprometido en clases reservadas que aún no se cobran. */
  available: number;
  skins: (Skin & { owned: boolean; equipped: boolean })[];
  equipped: Equipped;
  badges: Badge[];
  stats: TutorStats;
  /** Administrador de la plataforma (muestra la entrada "Admin"). */
  is_admin?: boolean;
}

export interface PublicProfile {
  profile: Profile;
  equipped: Equipped;
  badges: Badge[];
  stats: TutorStats;
  topics: (TutorTopic & { topic: Topic })[];
  group_price_quipus: number | null;
}

export interface TutorOption {
  profile: Profile;
  equipped: Equipped;
  stats: TutorStats;
  level: Level;
  group_price_quipus: number;
}

export interface GroupOption {
  group: Group;
  members: Profile[];
  tutor: TutorOption | null;
  share_quipus: number;
}

export interface MatchOptions {
  request: LearningRequest;
  topic: Topic;
  topicWasCreated: boolean;
  groups: GroupOption[];
  tutors: TutorOption[];
  aiTutors: AiTutor[];
}

export interface IncomingRequest {
  request: LearningRequest;
  student: Profile;
  topic: Topic;
}

export interface TutorPanel {
  topics: (TutorTopic & { topic: Topic })[];
  group_price_quipus: number;
  availability: string[];
  incoming: IncomingRequest[];
  scheduled: (Group & { topic: Topic; members: Profile[] })[];
}

export interface SessionDetail {
  session: Session;
  topic: Topic;
  tutor: Profile | null;
  aiTutor: AiTutor | null;
  students: (Profile & { equipped: Equipped })[];
  tutorEquipped: Equipped | null;
  myReview: Review | null;
}

export interface LedgerLine extends LedgerEntry {
  direction: "in" | "out";
  description: string;
}

export interface PrivateReview extends Review {
  topic: Topic | null;
}

/** Anuncio vigente que se muestra como banner en el campus. */
export interface ActiveAnnouncement {
  id: UUID;
  text: string;
}
