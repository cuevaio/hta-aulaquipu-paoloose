"use client";

import { useEffect, useRef, useState } from "react";
import {
  Bold,
  CheckSquare,
  Code,
  Eye,
  Heading2,
  Italic,
  Link2,
  List,
  ListOrdered,
  Loader2,
  Minus,
  PencilLine,
  Quote,
  Sigma,
  Sparkles,
  Table,
  X,
} from "lucide-react";
import { ClassMarkdown } from "@/components/markdown";
import type { AssistInput, AssistMode } from "@/lib/api";
import { applyFormat, type Format } from "@/lib/doc-format";
import { cn } from "@/lib/utils";

/** El profe pide texto a la IA; devuelve el markdown generado o lanza un error con el motivo. */
export type AssistFn = (input: AssistInput) => Promise<string>;

const TOOLS: { kind: Format; label: string; icon: typeof Bold; shortcut?: string }[] = [
  { kind: "h2", label: "Título", icon: Heading2 },
  { kind: "bold", label: "Negrita (Ctrl+B)", icon: Bold, shortcut: "b" },
  { kind: "italic", label: "Cursiva (Ctrl+I)", icon: Italic, shortcut: "i" },
  { kind: "ul", label: "Lista con viñetas", icon: List },
  { kind: "ol", label: "Lista numerada", icon: ListOrdered },
  { kind: "task", label: "Lista de tareas", icon: CheckSquare },
  { kind: "quote", label: "Cita", icon: Quote },
  { kind: "code", label: "Código", icon: Code },
  { kind: "math", label: "Fórmula", icon: Sigma },
  { kind: "table", label: "Tabla", icon: Table },
  { kind: "link", label: "Enlace (Ctrl+K)", icon: Link2, shortcut: "k" },
  { kind: "hr", label: "Línea divisoria", icon: Minus },
];

const QUICK: { mode: AssistMode; label: string }[] = [
  { mode: "explain", label: "Explicar el tema" },
  { mode: "exercises", label: "3 ejercicios" },
  { mode: "summary", label: "Resumen" },
];

/**
 * Documento vivo en markdown. El texto lo controla el aula (se sincroniza por eventos;
 * con Yjs será un Y.Text compartido). Cualquiera puede editar; el tutor IA escribe en vivo.
 * Editar tiene barra de formato (negrita, listas, tablas, fórmulas…) y vista previa en vivo;
 * el profe además tiene el asistente de IA (`assist`) para generar texto y revisarlo antes de insertarlo.
 */
export function LiveDoc({
  markdown,
  onChange,
  writer,
  assist,
}: {
  markdown: string;
  onChange: (md: string) => void;
  writer: string | null;
  assist?: AssistFn;
}) {
  const [editing, setEditing] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const area = useRef<HTMLTextAreaElement>(null);
  const selection = useRef({ start: 0, end: 0 });

  const [aiOpen, setAiOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Texto generado por revisar: no entra al documento hasta que el profe lo acepte
  const [draft, setDraft] = useState<{ markdown: string; replace: { start: number; end: number } | null } | null>(null);

  useEffect(() => {
    if (writer && scroller.current) scroller.current.scrollTop = scroller.current.scrollHeight;
  }, [markdown, writer]);

  const format = (kind: Format) => {
    const el = area.current;
    if (!el) return;
    const out = applyFormat(markdown, el.selectionStart, el.selectionEnd, kind);
    onChange(out.value);
    // El cursor y la selección se restauran cuando React ya pintó el texto nuevo
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(out.start, out.end);
    });
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!(e.ctrlKey || e.metaKey)) return;
    const tool = TOOLS.find((t) => t.shortcut === e.key.toLowerCase());
    if (!tool) return;
    e.preventDefault();
    format(tool.kind);
  };

  const remember = () => {
    const el = area.current;
    if (el) selection.current = { start: el.selectionStart, end: el.selectionEnd };
  };

  const ask = async (mode: AssistMode) => {
    if (!assist || busy) return;
    const { start, end } = selection.current;
    const selected = markdown.slice(start, end).trim();
    if (mode === "improve" && !selected) {
      setError("Selecciona en «Editar» el texto que quieres mejorar.");
      return;
    }
    setBusy(true);
    setError(null);
    setDraft(null);
    try {
      const text = await assist({ mode, prompt: prompt.trim() || undefined, selection: selected || undefined, doc: markdown.slice(-1500) });
      setDraft({ markdown: text, replace: mode === "improve" ? { start, end } : null });
    } catch (e) {
      setError(e instanceof Error ? e.message : "La IA no respondió. Intenta de nuevo.");
    } finally {
      setBusy(false);
    }
  };

  const accept = () => {
    if (!draft) return;
    const text = draft.markdown.trim();
    if (draft.replace) {
      const { start, end } = draft.replace;
      onChange(markdown.slice(0, start) + text + markdown.slice(end));
    } else {
      onChange(`${markdown.replace(/\s*$/, "")}${markdown.trim() ? "\n\n" : ""}${text}\n`);
    }
    setDraft(null);
    setPrompt("");
  };

  return (
    <div className="flex size-full flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
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
        {assist && (
          <button
            onClick={() => setAiOpen((o) => !o)}
            aria-expanded={aiOpen}
            className={cn(
              "flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-extrabold transition-colors",
              aiOpen ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary hover:bg-primary/20",
            )}
          >
            <Sparkles className="size-3.5" /> IA para el profe
          </button>
        )}
        {writer && (
          <span className="flex items-center gap-1.5 text-xs font-bold text-primary">
            <span className="size-2 animate-pulse rounded-full bg-primary" /> {writer} está escribiendo…
          </span>
        )}
      </div>

      {editing && (
        <div role="toolbar" aria-label="Formato del documento" className="flex flex-wrap gap-0.5 border-b border-border bg-muted/40 px-2 py-1">
          {TOOLS.map(({ kind, label, icon: Icon }) => (
            <button
              key={kind}
              onMouseDown={(e) => e.preventDefault()} // no le quita el foco (ni la selección) al texto
              onClick={() => format(kind)}
              title={label}
              aria-label={label}
              className="grid size-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
            >
              <Icon className="size-4" />
            </button>
          ))}
        </div>
      )}

      {assist && aiOpen && (
        <div className="space-y-2 border-b border-border bg-primary/5 p-3">
          <div className="flex flex-wrap gap-1.5">
            {QUICK.map((q) => (
              <button
                key={q.mode}
                disabled={busy}
                onClick={() => ask(q.mode)}
                className="rounded-full bg-card px-3 py-1 text-xs font-extrabold ring-1 ring-border transition hover:ring-primary disabled:opacity-50"
              >
                {q.label}
              </button>
            ))}
            <button
              disabled={busy}
              onClick={() => ask("improve")}
              className="rounded-full bg-card px-3 py-1 text-xs font-extrabold ring-1 ring-border transition hover:ring-primary disabled:opacity-50"
              title="Selecciona texto en «Editar» y pídele a la IA que lo mejore"
            >
              Mejorar lo seleccionado
            </button>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void ask("free");
            }}
            className="flex gap-2"
          >
            <input
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              maxLength={500}
              placeholder="Pídele algo: «un ejemplo con la mitocondria»…"
              aria-label="Pedido para la IA"
              className="min-w-0 flex-1 rounded-xl bg-card px-3 py-2 text-sm font-semibold ring-1 ring-border outline-none focus:ring-2 focus:ring-primary"
            />
            <button
              type="submit"
              disabled={busy || prompt.trim().length < 3}
              className="flex items-center gap-1 rounded-xl bg-primary px-3 py-2 text-sm font-extrabold text-primary-foreground disabled:opacity-50"
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />} Generar
            </button>
          </form>
          {error && <p className="text-xs font-semibold text-coral">{error}</p>}
          {draft && (
            <div className="space-y-2 rounded-xl bg-card p-3 ring-1 ring-primary/40 animate-in fade-in">
              <p className="text-xs font-extrabold text-primary">Borrador de la IA: revísalo antes de ponerlo en el documento</p>
              <div className="markdown-body max-h-52 overflow-y-auto text-sm">
                <ClassMarkdown>{draft.markdown}</ClassMarkdown>
              </div>
              <div className="flex gap-2">
                <button onClick={accept} className="rounded-xl bg-mint px-3 py-1.5 text-xs font-extrabold text-accent-foreground">
                  {draft.replace ? "Reemplazar la selección" : "Insertar en el documento"}
                </button>
                <button onClick={() => setDraft(null)} className="flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-bold text-muted-foreground hover:bg-muted">
                  <X className="size-3.5" /> Descartar
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {editing ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <textarea
            ref={area}
            value={markdown}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={onKeyDown}
            onSelect={remember}
            onBlur={remember}
            className="min-h-32 flex-1 resize-none bg-card p-4 font-mono text-sm outline-none"
            placeholder="Escribe aquí y usa la barra de arriba para dar formato (títulos, listas, tablas, fórmulas…)"
            aria-label="Documento de la clase"
          />
          <div className="max-h-[40%] min-h-0 overflow-y-auto border-t border-border bg-muted/30 p-3">
            <p className="mb-1 text-[11px] font-extrabold tracking-wide text-muted-foreground uppercase">Vista previa</p>
            <div className="markdown-body text-sm">{markdown.trim() ? <ClassMarkdown>{markdown}</ClassMarkdown> : <p className="text-muted-foreground">Aquí verás cómo queda.</p>}</div>
          </div>
        </div>
      ) : (
        <div ref={scroller} className="markdown-body flex-1 overflow-y-auto p-5">
          {markdown.trim() ? (
            <ClassMarkdown>{markdown}</ClassMarkdown>
          ) : (
            <p className="text-sm text-muted-foreground">El documento está vacío. Lo que escriban aquí lo ven todos en la clase.</p>
          )}
          {writer && <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-primary align-middle" />}
        </div>
      )}
    </div>
  );
}
