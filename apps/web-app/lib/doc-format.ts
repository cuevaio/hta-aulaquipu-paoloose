// Formato de markdown sobre un texto y una selección (para la barra del documento de clase).
// Función pura: recibe el texto y el rango seleccionado; devuelve el texto nuevo y la selección.

export type Format = "h2" | "bold" | "italic" | "ul" | "ol" | "task" | "quote" | "code" | "math" | "table" | "link" | "hr";

interface Result {
  value: string;
  start: number;
  end: number;
}

const WRAP: Partial<Record<Format, { mark: string; placeholder: string }>> = {
  bold: { mark: "**", placeholder: "texto en negrita" },
  italic: { mark: "*", placeholder: "texto en cursiva" },
  code: { mark: "`", placeholder: "código" },
  math: { mark: "$", placeholder: "x^2+1" },
};

const PREFIX: Partial<Record<Format, (n: number) => string>> = {
  h2: () => "## ",
  ul: () => "- ",
  ol: (n) => `${n + 1}. `,
  task: () => "- [ ] ",
  quote: () => "> ",
};

const TABLE = "| Columna 1 | Columna 2 |\n| --- | --- |\n| dato | dato |";

export function applyFormat(value: string, start: number, end: number, kind: Format): Result {
  const a = Math.min(start, end);
  const b = Math.max(start, end);

  const wrap = WRAP[kind];
  if (wrap) {
    const { mark, placeholder } = wrap;
    const selected = value.slice(a, b);
    // Si ya está envuelto, se quita (alterna)
    if (value.slice(a - mark.length, a) === mark && value.slice(b, b + mark.length) === mark && selected) {
      return { value: value.slice(0, a - mark.length) + selected + value.slice(b + mark.length), start: a - mark.length, end: b - mark.length };
    }
    const inner = selected || placeholder;
    const next = value.slice(0, a) + mark + inner + mark + value.slice(b);
    return { value: next, start: a + mark.length, end: a + mark.length + inner.length };
  }

  const prefix = PREFIX[kind];
  if (prefix) {
    // Las líneas tocadas por la selección (de su inicio al final de la última)
    const from = value.lastIndexOf("\n", a - 1) + 1;
    const toIdx = value.indexOf("\n", b);
    const to = toIdx === -1 ? value.length : toIdx;
    const lines = value.slice(from, to).split("\n");
    const marker = (n: number) => prefix(n);
    const strip = /^(#{1,6} |- \[[ x]\] |- |\d+\. |> )/;
    const all = lines.every((l) => l.trim() === "" || strip.test(l));
    const same = lines.filter((l) => l.trim()).every((l) => l.startsWith(marker(0)) || (kind === "ol" && /^\d+\. /.test(l)));
    const out = lines.map((l, i) => {
      if (l.trim() === "" && lines.length > 1) return l;
      const bare = l.replace(strip, "");
      return all && same ? bare : marker(i) + bare;
    });
    const text = out.join("\n");
    return { value: value.slice(0, from) + text + value.slice(to), start: from, end: from + text.length };
  }

  if (kind === "link") {
    const selected = value.slice(a, b) || "texto del enlace";
    const url = "https://";
    const text = `[${selected}](${url})`;
    const urlStart = a + selected.length + 3;
    return { value: value.slice(0, a) + text + value.slice(b), start: urlStart, end: urlStart + url.length };
  }

  // Bloques: tabla y línea divisoria, con línea en blanco antes y después
  const block = kind === "table" ? TABLE : "---";
  const before = value.slice(0, a);
  const after = value.slice(b);
  const lead = before.length === 0 || before.endsWith("\n\n") ? "" : before.endsWith("\n") ? "\n" : "\n\n";
  const tail = after.startsWith("\n\n") ? "" : after.startsWith("\n") ? "\n" : "\n\n";
  const next = before + lead + block + tail + after;
  const pos = before.length + lead.length + block.length;
  return { value: next, start: pos, end: pos };
}
