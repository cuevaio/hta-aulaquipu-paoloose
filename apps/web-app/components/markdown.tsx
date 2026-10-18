import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { isAllowedImageSrc } from "@/lib/image-hosts";

/** El modelo a veces escribe LaTeX con \( \) y \[ \]; remark-math entiende $ y $$. */
function normalizeMath(md: string): string {
  return md
    .replace(/\\\[([\s\S]+?)\\\]/g, (_, m: string) => `\n$$\n${m.trim()}\n$$\n`)
    .replace(/\\\(([\s\S]+?)\\\)/g, (_, m: string) => `$${m}$`);
}

/** Solo imágenes de hosts permitidos; el resto (el alumno edita el documento) queda bloqueado. */
function ClassImage({ src, alt }: { src?: string | Blob; alt?: string }) {
  if (typeof src !== "string" || !isAllowedImageSrc(src)) {
    return <span className="inline-block rounded-md bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">[imagen bloqueada]</span>;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- imagen externa de un host permitido
    <img src={src} alt={alt ?? ""} loading="lazy" referrerPolicy="no-referrer" className="my-2 h-auto max-w-full rounded-xl" />
  );
}

/** Markdown del documento de clase: tablas (GFM) y fórmulas (KaTeX). */
export function ClassMarkdown({ children }: { children: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: false }]]}
      components={{ img: ClassImage }}
    >
      {normalizeMath(children)}
    </ReactMarkdown>
  );
}
