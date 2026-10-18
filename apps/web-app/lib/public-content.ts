// Contenido compartido por las páginas públicas /info y /presentacion.
// Las cifras de evidencia vienen del documento de diseño (docs/superpowers/specs/2026-10-17-aulaquipu-design.md, §1.1).

export const TAGLINE_TEACH = "El que sabe enseña y gana.";
export const TAGLINE_LEARN = "El que aprende paga y mejora.";
export const TAGLINE = `${TAGLINE_TEACH} ${TAGLINE_LEARN}`;

export const REPO_URL = "https://github.com/paoloose/hacktheandes";

// PENDIENTE (equipo): reemplazar por la URL pública desplegada antes de presentar.
export const PUBLIC_URL_LABEL = "[URL pública: completar]";

export interface ProblemStat {
  value: string;
  label: string;
  source: string;
}

export const PROBLEM_STATS: ProblemStat[] = [
  {
    value: "11,3%",
    label: "de alumnos de 5º de secundaria alcanza nivel satisfactorio en lectura.",
    source: "ENLA 2025, Minedu",
  },
  {
    value: "12,8%",
    label: "alcanza nivel satisfactorio en matemática.",
    source: "ENLA 2025, Minedu",
  },
  {
    value: "< OCDE",
    label: "Perú está por debajo del promedio OCDE en competencia financiera.",
    source: "PISA 2022, OCDE",
  },
  {
    value: "949 M",
    label: "de accesos a apps de apuestas en 2025, con adolescentes expuestos.",
    source: "Apuestas 2025",
  },
];

// PENDIENTE (equipo): completar con datos reales. No se inventan cifras.
export const TEAM_PLACEHOLDER = ["[Nombre del integrante 1: rol]", "[Nombre del integrante 2: rol]", "[Nombre del integrante 3: rol]"];

export const NOT_DONE = [
  { title: "Monetización", text: "No se modela cómo entra dinero real. Cada cuenta arranca con 100 quipus y el quipu nunca sale del sistema." },
  { title: "Control parental", text: "El público es secundaria y no construimos controles parentales." },
  { title: "Gobernanza del colegio", text: "El colegio es solo contexto: no hay paneles de profesor ni integración institucional." },
  { title: "Currículo nacional", text: "Los temas no se alinean al Minedu; los proponen los alumnos." },
  { title: "App nativa", text: "Solo web responsiva con vista tipo celular." },
];

export const IN_PROGRESS = [
  { title: "Memoria de clases", text: "El agente ya integra AtomicMemory para recordar qué le costó a cada alumno, pero aún no está activa." },
  { title: "Primaria con consentimiento de padres", text: "Extender el producto a primaria requiere consentimiento de los padres y controles que hoy no existen." },
];
