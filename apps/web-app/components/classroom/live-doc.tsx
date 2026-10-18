"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Eye, PencilLine } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Documento vivo en markdown. El texto lo controla el aula (se sincroniza por eventos;
 * con Yjs será un Y.Text compartido). Cualquiera puede editar; el tutor IA escribe en vivo.
 */
export function LiveDoc({
  markdown,
  onChange,
  writer,
}: {
  markdown: string;
  onChange: (md: string) => void;
  writer: string | null;
}) {
  const [editing, setEditing] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (writer && scroller.current) scroller.current.scrollTop = scroller.current.scrollHeight;
  }, [markdown, writer]);

  return (
    <div className="flex size-full flex-col">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <div className="flex rounded-xl bg-muted p-0.5">
          <button
            onClick={() => setEditing(false)}
            className={cn("flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold", !editing && "bg-card shadow-sm")}
          >
            <Eye className="size-3.5" /> Ver
          </button>
          <button
            onClick={() => setEditing(true)}
            className={cn("flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold", editing && "bg-card shadow-sm")}
          >
            <PencilLine className="size-3.5" /> Editar
          </button>
        </div>
        {writer && (
          <span className="flex items-center gap-1.5 text-xs font-bold text-primary">
            <span className="size-2 animate-pulse rounded-full bg-primary" /> {writer} está escribiendo…
          </span>
        )}
      </div>
      {editing ? (
        <textarea
          value={markdown}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 resize-none bg-card p-4 font-mono text-sm outline-none"
          placeholder="Escribe en markdown: # títulos, - listas, | tablas |"
          aria-label="Documento de la clase"
        />
      ) : (
        <div ref={scroller} className="markdown-body flex-1 overflow-y-auto p-5">
          {markdown.trim() ? (
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
          ) : (
            <p className="text-sm text-muted-foreground">El documento está vacío. Lo que escriban aquí lo ven todos en la clase.</p>
          )}
          {writer && <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-primary align-middle" />}
        </div>
      )}
    </div>
  );
}
