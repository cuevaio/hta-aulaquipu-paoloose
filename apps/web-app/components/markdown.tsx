import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { ClassImage } from "@/components/class-image";
import { dropRepeatedHeadings } from "@/lib/markdown-clean";

// Códigos de color de terminal (ESC[1m … ESC[0m) que a veces escribe el modelo, como carácter real
// o como el texto "\u001b"; también quedan sueltos como "[1m" si se perdió el ESC.
const ANSI = String.raw`(?:\u001b|\\u001b|\\x1b)?\[[0-9;]*m`;
const ANSI_SPAN = new RegExp(`${ANSI}([^\\n]*?)${ANSI}`, "g");
const ANSI_ANY = new RegExp(ANSI, "g");

/** El resaltado de terminal pasa a negrita, o a fórmula si lo resaltado es LaTeX. */
function stripAnsi(md: string): string {
  return md
    .replace(ANSI_SPAN, (_, m: string) =>
      m.trim()
        ? /\\[a-z]+/i.test(m)
          ? `$${m.trim()}$`
          : `**${m.trim()}**`
        : "",
    )
    .replace(ANSI_ANY, "");
}

/** El modelo a veces escribe LaTeX con \( \) y \[ \]; remark-math entiende $ y $$. */
function normalizeMath(md: string): string {
  return stripAnsi(md)
    .replace(/\\\[([\s\S]+?)\\\]/g, (_, m: string) => `\n$$\n${m.trim()}\n$$\n`)
    .replace(/\\\(([\s\S]+?)\\\)/g, (_, m: string) => `$${m}$`);
}

/** Markdown del documento de clase: tablas (GFM) y fórmulas (KaTeX). */
export function ClassMarkdown({ children }: { children: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: false }]]}
      components={{ img: ClassImage }}
    >
      {normalizeMath(dropRepeatedHeadings(children))}
    </ReactMarkdown>
  );
}
