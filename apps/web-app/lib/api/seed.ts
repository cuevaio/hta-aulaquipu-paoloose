// Datos ficticios para la demo. Imitan los seeds de backend/database.sql
// (tutores IA, skins, temas) más alumnos precargados con su mint de 100 quipus.

import type { AuditRow } from "@/lib/admin-types";
import type {
  AiTutor,
  Group,
  GroupMember,
  LearningRequest,
  LedgerEntry,
  Profile,
  ProfileSkin,
  Review,
  Session,
  Skin,
  Topic,
  TutorTopic,
} from "@/lib/types";

export interface TutorSettings {
  group_price_quipus: number;
  availability: string[];
}

export interface Credential {
  dni: string;
  password: string;
  profile_id: string;
}

/** Cuentas de prueba: solo para la demo, nunca credenciales reales. */
export const TEST_PASSWORD = "aula2026";

export interface DbState {
  version: number;
  credentials: Credential[];
  profiles: Profile[];
  topics: Topic[];
  tutor_topics: TutorTopic[];
  tutor_settings: Record<string, TutorSettings>;
  requests: LearningRequest[];
  ai_tutors: AiTutor[];
  ai_tutor_topics: { ai_tutor_id: string; topic_id: string }[];
  groups: Group[];
  group_members: GroupMember[];
  sessions: Session[];
  ledger: LedgerEntry[];
  reviews: Review[];
  skins: Skin[];
  profile_skins: ProfileSkin[];
  /** Panel de administración: perfiles admin, auditoría y promociones IA. */
  admins: string[];
  admin_audit: AuditRow[];
}

export const SEED_VERSION = 5;

const t = (id: string, name: string): Topic => ({ id, name, proposed_by: null, status: "active" });

const hoursFromNow = (h: number) => new Date(Date.now() + h * 3600_000).toISOString();
const daysAgo = (d: number) => new Date(Date.now() - d * 86400_000).toISOString();

export function buildSeed(): DbState {
  const topics: Topic[] = [
    t("top-fracciones", "Fracciones"),
    t("top-ecuaciones", "Ecuaciones lineales"),
    t("top-funciones", "Funciones y gráficas"),
    t("top-trigonometria", "Trigonometría"),
    t("top-geometria", "Geometría"),
    t("top-porcentajes", "Porcentajes"),
    t("top-probabilidad", "Probabilidad"),
    t("top-comprension", "Comprensión lectora"),
    t("top-redaccion", "Redacción"),
    t("top-ingles", "Inglés básico"),
    t("top-quimica", "Química: tabla periódica"),
    t("top-fisica", "Física: movimiento"),
  ];

  const p = (
    id: string,
    username: string,
    display_name: string,
    grade: 1 | 2 | 3 | 4 | 5,
    school: string,
    color: string,
    shape: "blob" | "round" | "bean" = "blob",
  ): Profile => ({
    id,
    username,
    display_name,
    grade,
    school,
    avatar_config: { color, shape },
    created_at: daysAgo(3),
  });

  const profiles: Profile[] = [
    p("usr-valeria", "valeria", "Valeria Quispe", 5, "IE Mariscal Cáceres", "#7C6BF2", "blob"),
    p("usr-diego", "diego", "Diego Mamani", 2, "IE José Olaya", "#2FD3A3", "round"),
    p("usr-camila", "camila", "Camila Huamán", 2, "IE Santa Rosa", "#FF8A65", "bean"),
    p("usr-mateo", "mateo", "Mateo Rojas", 4, "Colegio San Martín", "#4FA3FF", "round"),
    p("usr-lucia", "lucia", "Lucía Flores", 1, "IE José Olaya", "#FFC94D", "blob"),
    p("usr-andres", "andres", "Andrés Condori", 2, "IE Mariscal Cáceres", "#F06EAA", "bean"),
  ];

  const ai_tutors: AiTutor[] = [
    {
      id: "ai-amaru",
      name: "Profe Amaru",
      price_quipus: 30,
      persona: {
        emoji: "🦙",
        color: "#7C6BF2",
        tagline: "Matemática con paciencia andina",
        style: "Explica con ejemplos del mercado y la chacra; pregunta mucho antes de avanzar.",
        voice: "cálida",
      },
    },
    {
      id: "ai-killa",
      name: "Killa",
      price_quipus: 30,
      persona: {
        emoji: "🌙",
        color: "#2FD3A3",
        tagline: "Ciencias y gráficas que se mueven",
        style: "Visual y curiosa: grafica todo en Desmos mientras explica.",
        voice: "enérgica",
      },
    },
    {
      id: "ai-rimay",
      name: "Rimay",
      price_quipus: 30,
      persona: {
        emoji: "📚",
        color: "#FF8A65",
        tagline: "Lectura, redacción e inglés",
        style: "Arma esquemas y tablas en el documento; corrige con cariño.",
        voice: "serena",
      },
    },
  ];

  const ai_tutor_topics = [
    ...["top-fracciones", "top-ecuaciones", "top-porcentajes", "top-probabilidad", "top-geometria"].map((x) => ({
      ai_tutor_id: "ai-amaru",
      topic_id: x,
    })),
    ...["top-funciones", "top-trigonometria", "top-fisica", "top-quimica", "top-ecuaciones"].map((x) => ({
      ai_tutor_id: "ai-killa",
      topic_id: x,
    })),
    ...["top-comprension", "top-redaccion", "top-ingles"].map((x) => ({ ai_tutor_id: "ai-rimay", topic_id: x })),
  ];

  const tutor_topics: TutorTopic[] = [
    { tutor_id: "usr-valeria", topic_id: "top-fracciones", level: "avanzado" },
    { tutor_id: "usr-valeria", topic_id: "top-ecuaciones", level: "avanzado" },
    { tutor_id: "usr-valeria", topic_id: "top-funciones", level: "intermedio" },
    { tutor_id: "usr-mateo", topic_id: "top-fracciones", level: "intermedio" },
    { tutor_id: "usr-mateo", topic_id: "top-fisica", level: "avanzado" },
    { tutor_id: "usr-mateo", topic_id: "top-ingles", level: "basico" },
  ];

  const tutor_settings: Record<string, TutorSettings> = {
    "usr-valeria": { group_price_quipus: 24, availability: ["Lun 16:00", "Mié 16:00", "Vie 15:00"] },
    "usr-mateo": { group_price_quipus: 18, availability: ["Mar 17:00", "Jue 17:00"] },
  };

  const skins: Skin[] = [
    { id: "skn-blob", name: "Blob clásico", kind: "avatar", price_quipus: 0, meta: {} },
    { id: "skn-chullo", name: "Chullo andino", kind: "avatar", price_quipus: 15, meta: { accessory: "chullo" } },
    { id: "skn-lentes", name: "Lentes de sol", kind: "avatar", price_quipus: 10, meta: { accessory: "lentes" } },
    { id: "skn-audifonos", name: "Audífonos", kind: "avatar", price_quipus: 20, meta: { accessory: "audifonos" } },
    { id: "skn-birrete", name: "Birrete", kind: "avatar", price_quipus: 25, meta: { accessory: "birrete" } },
    { id: "skn-corona", name: "Corona inca", kind: "avatar", price_quipus: 45, meta: { accessory: "corona" } },
    { id: "skn-marco-basico", name: "Marco básico", kind: "frame", price_quipus: 0, meta: { frame: "basico" } },
    { id: "skn-marco-dorado", name: "Marco dorado", kind: "frame", price_quipus: 25, meta: { frame: "dorado" } },
    { id: "skn-marco-andino", name: "Marco andino", kind: "frame", price_quipus: 30, meta: { frame: "andino" } },
    { id: "skn-marco-arcoiris", name: "Marco arcoíris", kind: "frame", price_quipus: 35, meta: { frame: "arcoiris" } },
    { id: "skn-deco-andes", name: "Fondo Andes", kind: "profile_deco", price_quipus: 20, meta: { deco: "andes" } },
    { id: "skn-deco-cosmos", name: "Fondo cósmico", kind: "profile_deco", price_quipus: 30, meta: { deco: "cosmos" } },
    { id: "skn-deco-selva", name: "Fondo selva", kind: "profile_deco", price_quipus: 20, meta: { deco: "selva" } },
  ];

  const freeSkins = skins.filter((s) => s.price_quipus === 0);
  const profile_skins: ProfileSkin[] = profiles.flatMap((pr) =>
    freeSkins.map((s) => ({ profile_id: pr.id, skin_id: s.id, equipped: true })),
  );
  // Valeria ya tiene algo de prestigio para que el demo no arranque vacío
  profile_skins.push({ profile_id: "usr-valeria", skin_id: "skn-chullo", equipped: true });
  profile_skins.push({ profile_id: "usr-valeria", skin_id: "skn-marco-dorado", equipped: true });
  profile_skins.forEach((ps) => {
    if (ps.profile_id === "usr-valeria" && ps.skin_id === "skn-marco-basico") ps.equipped = false;
  });

  let ledgerId = 1;
  const ledger: LedgerEntry[] = profiles.map((pr) => ({
    id: ledgerId++,
    session_id: null,
    from_profile: null,
    to_profile: pr.id,
    amount: 100,
    kind: "mint",
    created_at: daysAgo(3),
  }));

  // Historia previa: Valeria ya dio una clase a Lucía y Andrés
  const pastSession: Session = {
    id: "ses-pasada-1",
    group_id: "grp-pasado-1",
    request_id: null,
    tutor_kind: "human",
    tutor_id: "usr-valeria",
    ai_tutor_id: null,
    room_name: "session-ses-pasada-1",
    price_quipus: 20,
    status: "completed",
    started_at: daysAgo(1),
    ended_at: daysAgo(1),
    topic_id: "top-ecuaciones",
    student_ids: ["usr-lucia", "usr-andres"],
    doc_markdown: "# Ecuaciones lineales\n\nDespejar x: lo que suma pasa restando.",
  };
  const groups: Group[] = [
    {
      id: "grp-pasado-1",
      topic_id: "top-ecuaciones",
      tutor_id: "usr-valeria",
      ai_tutor_id: null,
      total_price_quipus: 20,
      scheduled_at: daysAgo(1),
      status: "completed",
      created_at: daysAgo(2),
    },
    {
      id: "grp-fracciones",
      topic_id: "top-fracciones",
      tutor_id: "usr-valeria",
      ai_tutor_id: null,
      total_price_quipus: 24,
      scheduled_at: hoursFromNow(26),
      status: "forming",
      created_at: daysAgo(0),
    },
  ];
  const group_members: GroupMember[] = [
    { group_id: "grp-pasado-1", student_id: "usr-lucia", share_quipus: 10, status: "joined" },
    { group_id: "grp-pasado-1", student_id: "usr-andres", share_quipus: 10, status: "joined" },
    { group_id: "grp-fracciones", student_id: "usr-camila", share_quipus: 12, status: "joined" },
    { group_id: "grp-fracciones", student_id: "usr-andres", share_quipus: 12, status: "joined" },
  ];
  ledger.push(
    {
      id: ledgerId++,
      session_id: "ses-pasada-1",
      from_profile: "usr-lucia",
      to_profile: "usr-valeria",
      amount: 10,
      kind: "session_payment",
      created_at: daysAgo(1),
    },
    {
      id: ledgerId++,
      session_id: "ses-pasada-1",
      from_profile: "usr-andres",
      to_profile: "usr-valeria",
      amount: 10,
      kind: "session_payment",
      created_at: daysAgo(1),
    },
  );
  const reviews: Review[] = [
    {
      id: "rev-1",
      session_id: "ses-pasada-1",
      reviewer_id: "usr-lucia",
      tutor_id: "usr-valeria",
      ai_tutor_id: null,
      stars: 5,
      feedback_private: "Me encantó cómo explicaste con la balanza. ¡Por fin entendí!",
      created_at: daysAgo(1),
    },
    {
      id: "rev-2",
      session_id: "ses-pasada-1",
      reviewer_id: "usr-andres",
      tutor_id: "usr-valeria",
      ai_tutor_id: null,
      stars: 4,
      feedback_private: "Muy buena, pero fuiste un poco rápido al final.",
      created_at: daysAgo(1),
    },
  ];

  const requests: LearningRequest[] = [
    {
      id: "req-camila",
      student_id: "usr-camila",
      topic_id: "top-fracciones",
      detail: "No entiendo cómo sumar fracciones con distinto denominador",
      mode: "grupo",
      status: "matched",
      preferred_at: null,
      created_at: daysAgo(0),
    },
    {
      id: "req-andres",
      student_id: "usr-andres",
      topic_id: "top-fracciones",
      detail: "Fracciones para el examen del viernes",
      mode: "grupo",
      status: "matched",
      preferred_at: null,
      created_at: daysAgo(0),
    },
    {
      id: "req-lucia",
      student_id: "usr-lucia",
      topic_id: "top-porcentajes",
      detail: "¿Cómo calculo un descuento del 15%?",
      mode: "grupo",
      status: "open",
      preferred_at: null,
      created_at: daysAgo(0),
    },
    {
      id: "req-andres-2",
      student_id: "usr-andres",
      topic_id: "top-funciones",
      detail: "Graficar funciones lineales, me pierdo con la pendiente",
      mode: "individual",
      status: "open",
      preferred_at: null,
      created_at: daysAgo(0),
    },
  ];

  const dnis: Record<string, string> = {
    "usr-valeria": "70123456",
    "usr-diego": "71234567",
    "usr-camila": "72345678",
    "usr-mateo": "73456789",
    "usr-lucia": "74567890",
    "usr-andres": "75678901",
  };
  const credentials: Credential[] = profiles.map((pr) => ({ dni: dnis[pr.id], password: TEST_PASSWORD, profile_id: pr.id }));

  return {
    version: SEED_VERSION,
    credentials,
    profiles,
    topics,
    tutor_topics,
    tutor_settings,
    requests,
    ai_tutors,
    ai_tutor_topics,
    groups,
    group_members,
    sessions: [pastSession],
    ledger,
    reviews,
    skins,
    profile_skins,
    // El administrador demo es la primera cuenta de prueba (como valentina5 en la base real)
    admins: ["usr-valeria"],
    admin_audit: [],
  };
}

// Sinónimos para normalizar texto libre a un tema (estrategia "fuzzy" del §14).
export const TOPIC_KEYWORDS: Record<string, string[]> = {
  "top-fracciones": ["fraccion", "fracción", "fracciones", "denominador", "numerador", "quebrado"],
  "top-ecuaciones": ["ecuacion", "ecuación", "ecuaciones", "despejar", "incognita", "incógnita"],
  "top-funciones": ["funcion", "función", "funciones", "grafica", "gráfica", "pendiente", "recta", "parabola", "parábola"],
  "top-trigonometria": ["trigonometria", "trigonometría", "seno", "coseno", "tangente", "angulo", "ángulo"],
  "top-geometria": ["geometria", "geometría", "area", "área", "perimetro", "perímetro", "triangulo", "triángulo", "pitagoras", "pitágoras"],
  "top-porcentajes": ["porcentaje", "porcentajes", "descuento", "%", "interes", "interés", "igv"],
  "top-probabilidad": ["probabilidad", "dado", "azar", "estadistica", "estadística"],
  "top-comprension": ["lectura", "comprension", "comprensión", "texto", "leer", "inferencia"],
  "top-redaccion": ["redaccion", "redacción", "ensayo", "escribir", "ortografia", "ortografía"],
  "top-ingles": ["ingles", "inglés", "english", "verb", "verbo to be"],
  "top-quimica": ["quimica", "química", "tabla periodica", "tabla periódica", "elemento", "atomo", "átomo"],
  "top-fisica": ["fisica", "física", "velocidad", "movimiento", "aceleracion", "aceleración", "mru"],
};
