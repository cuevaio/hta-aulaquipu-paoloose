// El modelo suele repetir el título de la sección dentro de su texto ("## Velocidad" bajo
// "## Velocidad"). Esto quita esos títulos duplicados, en el documento en vivo y en el resumen.

const HEADING = /^\s*(?:#{1,6}\s+(.+?)\s*#*\s*|\*\*(.+?)\*\*:?\s*)$/;

const norm = (t: string) =>
  t
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9ñ]+/g, " ")
    .trim();

/** Texto del título si la línea es un encabezado (# …) o una línea entera en negrita; si no, null. */
export function headingText(line: string): string | null {
  const m = HEADING.exec(line);
  return m ? (m[1] ?? m[2] ?? "").trim() || null : null;
}

/** Quita el primer encabezado del texto si repite `title`. */
export function stripLeadingTitle(markdown: string, title: string): string {
  const lines = markdown.replace(/^\s*\n/, "").split("\n");
  const first = headingText(lines[0] ?? "");
  return first && norm(first) === norm(title) ? lines.slice(1).join("\n").replace(/^\s*\n/, "") : markdown;
}

/** Quita un encabezado que repite al anterior cuando entre ambos solo hay líneas vacías. */
export function dropRepeatedHeadings(markdown: string): string {
  const out: string[] = [];
  let last: string | null = null;
  for (const line of markdown.split("\n")) {
    const h = headingText(line);
    if (h !== null) {
      if (last !== null && norm(h) === norm(last)) continue;
      last = h;
    } else if (line.trim()) {
      last = null;
    }
    out.push(line);
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n");
}
