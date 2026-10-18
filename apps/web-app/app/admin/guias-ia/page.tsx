"use client";

import { useRef, useState } from "react";
import { FileUp, Sparkles, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { useMutation, useQuery } from "@/components/providers";
import { Card, ErrorBox, Pill, Skeleton, btn, timeAgo } from "@/components/bits";
import { Empty, PageHeader, Panel, inputCls } from "@/components/admin/admin-ui";
import { GUIDE_FIELD_MAX, IMAGE_CAPTION_MAX, IMAGE_CREDIT_MAX, parseTopicImage, type AdminGuide, type TopicGuide } from "@/lib/admin-types";
import { cn } from "@/lib/utils";

const FIELDS: { key: keyof TopicGuide; label: string; hint: string }[] = [
  { key: "objectives", label: "Objetivos", hint: "Qué debe lograr el alumno al terminar la clase." },
  { key: "steps", label: "Pasos de enseñanza", hint: "El orden en que el tutor debe explicar el tema." },
  { key: "common_mistakes", label: "Errores comunes", hint: "Confusiones típicas que el tutor debe vigilar." },
  { key: "checks", label: "Comprobaciones", hint: "Preguntas o ejercicios para verificar que el alumno entendió." },
];

/** Reparte un .md/.txt por encabezados (Objetivos, Pasos, Errores, Comprobaciones); sin encabezados todo va a "Pasos". */
function splitGuideText(text: string): TopicGuide {
  const out: TopicGuide = { objectives: "", steps: "", common_mistakes: "", checks: "" };
  const keyFor = (title: string): keyof TopicGuide | null => {
    const t = title
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "");
    if (/objetiv/.test(t)) return "objectives";
    if (/paso|ensen|secuencia|plan/.test(t)) return "steps";
    if (/error|confusi|dificult/.test(t)) return "common_mistakes";
    if (/comprob|verific|pregunt|evalua|check/.test(t)) return "checks";
    return null;
  };
  let current: keyof TopicGuide | null = null;
  let matched = false;
  const loose: string[] = [];
  for (const line of text.replace(/\r\n?/g, "\n").split("\n")) {
    const h = /^\s{0,3}#{1,6}\s+(.*?)\s*#*\s*$/.exec(line);
    if (h) {
      const key = keyFor(h[1]);
      if (key) {
        current = key;
        matched = true;
        continue;
      }
    }
    if (current) out[current] += `${line}\n`;
    else loose.push(line);
  }
  if (!matched) out.steps = text.trim();
  else if (loose.join("").trim()) out.objectives = `${loose.join("\n").trim()}\n${out.objectives}`;
  for (const k of Object.keys(out) as (keyof TopicGuide)[]) out[k] = out[k].trim().slice(0, GUIDE_FIELD_MAX);
  return out;
}

/** Guías IA: una guía de enseñanza por tema, que viaja al agente en cada clase IA de ese tema. */
export default function AdminGuidesPage() {
  const list = useQuery((u) => api.admin.guides(u));
  const [topicId, setTopicId] = useState<string | null>(null);

  if (list.error && !list.data) return <ErrorBox message={list.error} />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Guías IA"
        subtitle="Define objetivos, pasos, errores comunes y comprobaciones por tema. El tutor IA las recibe al empezar una clase de ese tema y las sigue."
      />
      <div className="grid gap-4 lg:grid-cols-[17rem_minmax(0,1fr)]">
        <Panel title="Temas" hint="Los marcados ya tienen guía.">
          {!list.data && <Skeleton className="h-48" />}
          {list.data && !list.data.length && <Empty>No hay temas activos.</Empty>}
          <ul className="max-h-[32rem] space-y-1 overflow-y-auto">
            {list.data?.map((t) => (
              <li key={t.topic_id}>
                <button
                  onClick={() => setTopicId(t.topic_id)}
                  aria-current={topicId === t.topic_id ? "true" : undefined}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 rounded-2xl px-3 py-2 text-left text-sm font-bold transition-colors",
                    topicId === t.topic_id ? "bg-primary text-primary-foreground" : "hover:bg-muted",
                  )}
                >
                  <span className="min-w-0 truncate">{t.name}</span>
                  {t.has_guide && <Sparkles className="size-4 shrink-0" aria-label="Con guía" />}
                </button>
              </li>
            ))}
          </ul>
        </Panel>
        {topicId ? (
          <div className="min-w-0 space-y-4">
            <GuideEditor key={topicId} topicId={topicId} />
            <TopicImagesPanel key={`img-${topicId}`} topicId={topicId} />
          </div>
        ) : (
          <Empty>Elige un tema para ver o escribir su guía.</Empty>
        )}
      </div>
    </div>
  );
}

function GuideEditor({ topicId }: { topicId: string }) {
  const q = useQuery((u) => api.admin.guide(u, topicId), [topicId]);
  if (q.error && !q.data) return <ErrorBox message={q.error} />;
  if (!q.data) return <Skeleton className="h-96" />;
  return <GuideForm guide={q.data} />;
}

function GuideForm({ guide }: { guide: AdminGuide }) {
  const { run, pending } = useMutation();
  const [f, setF] = useState<TopicGuide>({
    objectives: guide.objectives,
    steps: guide.steps,
    common_mistakes: guide.common_mistakes,
    checks: guide.checks,
  });
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  const total = FIELDS.reduce((n, x) => n + f[x.key].length, 0);
  const tooLong = FIELDS.some((x) => f[x.key].length > GUIDE_FIELD_MAX);
  const empty = total === 0;

  const onFile = (file: File | undefined) => {
    setFileError(null);
    if (!file) return;
    if (file.size > 100_000) return setFileError("El archivo es muy grande (máximo 100 KB).");
    const reader = new FileReader();
    reader.onload = () => setF(splitGuideText(String(reader.result ?? "")));
    reader.onerror = () => setFileError("No pudimos leer el archivo.");
    reader.readAsText(file);
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-heading text-lg font-semibold">{guide.name}</h2>
          <p className="text-xs text-muted-foreground">{guide.updated_at ? `Actualizada ${timeAgo(guide.updated_at)}` : "Este tema aún no tiene guía."}</p>
        </div>
        <div className="flex items-center gap-2">
          <input ref={fileRef} type="file" accept=".md,.txt,text/markdown,text/plain" className="sr-only" id="guide-file" onChange={(e) => onFile(e.target.files?.[0])} />
          <label htmlFor="guide-file" className={cn(btn.soft, btn.sm, "cursor-pointer")}>
            <FileUp className="size-4" /> Importar .md / .txt
          </label>
        </div>
      </div>
      {fileError && <p className="text-xs font-semibold text-destructive">{fileError}</p>}
      <p className="text-xs text-muted-foreground">
        Al importar, los encabezados <code>## Objetivos</code>, <code>## Pasos</code>, <code>## Errores comunes</code> y <code>## Comprobaciones</code> llenan cada campo; sin encabezados, todo va a “Pasos”. Revisa y guarda.
      </p>

      {FIELDS.map((x) => (
        <label key={x.key} className="block space-y-1 text-sm font-bold">
          <span className="flex items-baseline justify-between gap-2">
            {x.label}
            <span className={cn("text-xs font-semibold tabular-nums", f[x.key].length > GUIDE_FIELD_MAX ? "text-destructive" : "text-muted-foreground")}>
              {f[x.key].length}/{GUIDE_FIELD_MAX}
            </span>
          </span>
          <textarea
            value={f[x.key]}
            onChange={(e) => setF((p) => ({ ...p, [x.key]: e.target.value }))}
            rows={5}
            aria-invalid={f[x.key].length > GUIDE_FIELD_MAX}
            placeholder={x.hint}
            className={cn(inputCls, "h-auto min-h-28 py-3 font-medium")}
          />
        </label>
      ))}

      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => run((u) => api.admin.saveGuide(u, guide.topic_id, f), `Guía de ${guide.name} guardada`)}
          disabled={pending || tooLong || empty}
          className={cn(btn.primary, btn.md)}
        >
          {pending ? "Guardando…" : "Guardar guía"}
        </button>
        {guide.updated_at && (
          <button
            onClick={() => confirm(`¿Quitar la guía de ${guide.name}?`) && run((u) => api.admin.deleteGuide(u, guide.topic_id), "Guía eliminada")}
            disabled={pending}
            className={cn(btn.ghost, btn.md, "text-destructive")}
          >
            <Trash2 className="size-4" /> Quitar guía
          </button>
        )}
        <Pill className="ml-auto bg-muted text-muted-foreground">Máx. ~4000 caracteres al agente</Pill>
      </div>
      <p className="text-xs text-muted-foreground">Se aplica a las clases IA que empiecen después de guardar.</p>
    </Card>
  );
}

/** Banco de imágenes del tema: el tutor IA las muestra en la clase antes de buscar en Wikimedia. */
function TopicImagesPanel({ topicId }: { topicId: string }) {
  const q = useQuery((u) => api.admin.topicImages(u, topicId), [topicId]);
  const { run, pending } = useMutation();
  const [url, setUrl] = useState("");
  const [caption, setCaption] = useState("");
  const [credit, setCredit] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const missing = !!q.error && !q.data && /004/.test(q.error);

  const add = async () => {
    const parsed = parseTopicImage({ url, caption, credit });
    if ("error" in parsed) return setFormError(parsed.error);
    setFormError(null);
    const created = await run((u) => api.admin.addTopicImage(u, topicId, parsed.value), "Imagen agregada");
    if (created) {
      setUrl("");
      setCaption("");
      setCredit("");
    }
  };

  return (
    <Panel
      title="Imágenes del tema"
      hint="El tutor IA muestra estas imágenes en el documento de la clase; si el tema no tiene, busca en Wikimedia Commons."
    >
      {missing && (
        <p role="status" className="rounded-2xl bg-muted px-4 py-3 text-sm font-semibold">
          Falta aplicar 004: la migración <code>004_topic_images.sql</code> aún no está en la base de datos. El resto de la página funciona con normalidad.
        </p>
      )}
      {q.error && !q.data && !missing && <ErrorBox message={q.error} />}
      {!q.data && !q.error && <Skeleton className="h-24" />}
      {q.data && !q.data.length && <Empty>Este tema aún no tiene imágenes propias.</Empty>}
      {q.data && q.data.length > 0 && (
        <ul className="grid gap-3 sm:grid-cols-2">
          {q.data.map((img) => (
            <li key={img.id} className="flex gap-3 rounded-2xl border border-border p-3">
              {/* eslint-disable-next-line @next/next/no-img-element -- URL externa elegida por el admin */}
              <img src={img.url} alt={img.caption} loading="lazy" referrerPolicy="no-referrer" className="size-20 shrink-0 rounded-xl bg-muted object-cover" />
              <div className="min-w-0 flex-1 space-y-1">
                <p className="text-sm font-bold">{img.caption}</p>
                {img.credit && <p className="truncate text-xs text-muted-foreground">{img.credit}</p>}
                <button
                  onClick={() => confirm("¿Quitar esta imagen del tema?") && run((u) => api.admin.deleteTopicImage(u, img.id), "Imagen eliminada")}
                  disabled={pending}
                  className={cn(btn.ghost, btn.sm, "text-destructive")}
                >
                  <Trash2 className="size-4" /> Quitar
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {!missing && (
        <div className="space-y-2">
          <label className="block space-y-1 text-sm font-bold">
            URL de la imagen (https)
            <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://upload.wikimedia.org/…" className={inputCls} />
          </label>
          <label className="block space-y-1 text-sm font-bold">
            <span className="flex justify-between gap-2">
              Descripción
              <span className="text-xs font-semibold tabular-nums text-muted-foreground">{caption.length}/{IMAGE_CAPTION_MAX}</span>
            </span>
            <input value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Partes de una célula animal" className={inputCls} />
          </label>
          <label className="block space-y-1 text-sm font-bold">
            <span className="flex justify-between gap-2">
              Crédito y licencia (opcional)
              <span className="text-xs font-semibold tabular-nums text-muted-foreground">{credit.length}/{IMAGE_CREDIT_MAX}</span>
            </span>
            <input value={credit} onChange={(e) => setCredit(e.target.value)} placeholder="Autor, CC BY-SA 4.0" className={inputCls} />
          </label>
          {formError && <p className="text-xs font-semibold text-destructive">{formError}</p>}
          <button onClick={add} disabled={pending || !url.trim() || !caption.trim()} className={cn(btn.primary, btn.md)}>
            {pending ? "Guardando…" : "Agregar imagen"}
          </button>
          <p className="text-xs text-muted-foreground">En clase solo se muestran imágenes de upload.wikimedia.org o del almacenamiento del proyecto.</p>
        </div>
      )}
    </Panel>
  );
}
