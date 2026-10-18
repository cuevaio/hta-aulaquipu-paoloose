// Contenido compartido por las páginas públicas /info y /presentacion.
// Las cifras de evidencia vienen del documento de diseño (docs/superpowers/specs/2026-10-17-aulaquipu-design.md, §1.1).

export const TAGLINE_TEACH = "El que sabe enseña y gana.";
export const TAGLINE_LEARN = "El que aprende paga y mejora.";
export const TAGLINE = `${TAGLINE_TEACH} ${TAGLINE_LEARN}`;

export const REPO_URL = "https://github.com/paoloose/hacktheandes";
export const PUBLIC_URL = "https://hacktheandes.vercel.app/";
export const PUBLIC_URL_LABEL = "hacktheandes.vercel.app";

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
    value: "949 M",
    label: "de accesos a apps de apuestas en 2025, con adolescentes expuestos.",
    source: "Apuestas 2025",
  },
];
