"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Check, Sparkles, User, Users } from "lucide-react";
import { api } from "@/lib/api";
import type { RequestMode, Topic } from "@/lib/types";
import { useMutation, useQuery, useSession } from "@/components/providers";
import { MyRequests } from "@/components/my-requests";
import { Quipus, Skeleton, btn } from "@/components/bits";
import { OTHER_SUBJECT, SUBJECTS, subjectOf, type Subject } from "@/lib/subjects";
import { cn } from "@/lib/utils";

const SLOTS = [
  { id: "ya", label: "Lo antes posible", emoji: "⚡" },
  { id: "tarde", label: "Hoy en la tarde", emoji: "🌇" },
  { id: "manana", label: "Mañana", emoji: "📅" },
  { id: "finde", label: "El fin de semana", emoji: "🛋️" },
] as const;
type SlotId = (typeof SLOTS)[number]["id"];

function slotDate(id: SlotId): string | null {
  const d = new Date();
  if (id === "tarde") d.setHours(17, 0, 0, 0);
  else if (id === "manana") {
    d.setDate(d.getDate() + 1);
    d.setHours(16, 0, 0, 0);
  } else if (id === "finde") {
    d.setDate(d.getDate() + ((6 - d.getDay() + 7) % 7 || 7));
    d.setHours(10, 0, 0, 0);
  } else return null;
  return d.toISOString();
}

const DETAIL_HINTS: Record<string, string> = {
  mate: "Ej.: no sé cuándo usar el MCM, me pierdo con los signos…",
  comu: "Ej.: no sé cómo empezar la conclusión de mi texto…",
  ciencia: "Ej.: confundo velocidad y aceleración…",
  ingles: "Ej.: me trabo con el pasado de los verbos…",
  historia: "Ej.: no entiendo las causas de la independencia…",
  tec: "Ej.: no entiendo los bucles en Python…",
};

const fold = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

export default function NewRequestPage() {
  const router = useRouter();
  const { me } = useSession();
  const { run, pending } = useMutation();
  const topics = useQuery(() => api.searchTopics(""));
  // Desde el perfil de un tutor llegan ?tema=<nombre>&tutor=<id>: se salta directo al último paso
  const params = useSearchParams();
  const tema = params.get("tema")?.slice(0, 80) ?? null;
  const tutorId = params.get("tutor");

  // Mientras no toques nada se usa lo que vino del perfil del tutor; al interactuar pasa a ser tuyo
  const [touched, setTouched] = useState(false);
  const [step, setStepState] = useState<1 | 2 | 3>(1);
  const [subjectState, setSubject] = useState<Subject | null>(null);
  const [topicState, setTopic] = useState<Topic | null>(null);
  const [freeTextState, setFreeText] = useState("");
  const [detail, setDetail] = useState("");
  const [mode, setMode] = useState<RequestMode>("grupo");
  const [when, setWhen] = useState<SlotId>("ya");

  const prefilled = useMemo(
    () => (tema && topics.data ? topics.data.find((t) => fold(t.name) === fold(tema)) ?? null : null),
    [tema, topics.data],
  );
  const topic = touched ? topicState : prefilled;
  const subject = touched ? subjectState : prefilled ? subjectOf(prefilled.name) : tema ? OTHER_SUBJECT : null;
  const freeText = touched ? freeTextState : tema && !prefilled ? `Quiero aprender ${tema}` : "";
  const currentStep: 1 | 2 | 3 = touched ? step : prefilled ? 3 : tema ? 2 : 1;

  /** Congela lo precargado como selección propia antes del primer cambio. */
  const own = () => {
    if (touched) return;
    setTouched(true);
    setSubject(subject);
    setTopic(topic);
    setFreeText(freeText);
    setStepState(currentStep);
  };
  const setStep = (n: 1 | 2 | 3) => {
    own();
    setStepState(n);
  };

  const subjectTopics = useMemo(
    () => (subject && topics.data ? topics.data.filter((t) => subjectOf(t.name).id === subject.id) : []),
    [subject, topics.data],
  );

  const text = topic ? (detail.trim() ? `${topic.name}: ${detail.trim()}` : `Quiero aprender ${topic.name}`) : freeText.trim();
  const canGoOn = !!topic || freeText.trim().length >= 3;

  const pickSubject = (s: Subject) => {
    own();
    setSubject(s);
    setTopic(null);
    setStepState(2);
  };
  const pickTopic = (t: Topic) => {
    own();
    setTopic(t);
    setFreeText("");
    setStepState(3);
  };
  const typeFree = (v: string) => {
    own();
    setFreeText(v);
    setTopic(null);
  };

  const submit = async () => {
    const res = await run((u) => api.createRequest(u, { text, mode, preferredAt: slotDate(when) }));
    if (res) router.push(`/match/${res.requestId}${tutorId ? `?tutor=${encodeURIComponent(tutorId)}` : ""}`);
  };

  return (
    <div className="mx-auto max-w-2xl pb-24">
      {/* Encabezado con progreso */}
      <div className="mb-6">
        <div className="flex items-center gap-2">
          {currentStep > 1 && (
            <button
              onClick={() => setStep(currentStep === 3 ? 2 : 1)}
              className={cn(btn.ghost, "-ml-2 size-9 p-0")}
              aria-label="Volver al paso anterior"
            >
              <ArrowLeft className="size-5" />
            </button>
          )}
          <p className="text-sm font-bold text-primary">Quiero aprender · paso {currentStep} de 3</p>
        </div>
        <div className="mt-2 flex gap-1.5" aria-hidden>
          {[1, 2, 3].map((n) => (
            <span key={n} className={cn("h-1.5 flex-1 rounded-full transition-colors", n <= currentStep ? "bg-primary" : "bg-muted")} />
          ))}
        </div>
      </div>

      {/* ① Materia */}
      {currentStep === 1 && (
        <section className="space-y-5 animate-in fade-in">
          <div>
            <h1 className="font-heading text-3xl font-semibold">¿De qué materia es?</h1>
            <p className="mt-1 text-muted-foreground">Elige una y luego te ayudamos a ubicar el tema.</p>
          </div>
          <div className="grid grid-cols-2 gap-3 @xl:grid-cols-3">
            {[...SUBJECTS, OTHER_SUBJECT].map((s) => (
              <button
                key={s.id}
                onClick={() => pickSubject(s)}
                className={cn(
                  "flex flex-col items-start gap-3 rounded-3xl p-4 text-left ring-1 ring-border transition-all hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98]",
                  s.tone,
                )}
              >
                <span className="text-4xl" aria-hidden>
                  {s.emoji}
                </span>
                <span className="font-heading text-lg leading-tight font-semibold">{s.name}</span>
              </button>
            ))}
          </div>
          <div className="pt-6">
            <MyRequests title="Lo que ya pediste" hideWhenEmpty />
          </div>
        </section>
      )}

      {/* ② Tema */}
      {currentStep === 2 && (
        <section className="space-y-5 animate-in fade-in">
          <div>
            <p className="text-3xl" aria-hidden>
              {subject?.emoji ?? "✍️"}
            </p>
            <h1 className="mt-1 font-heading text-3xl font-semibold">
              {!subject || subject.id === OTHER_SUBJECT.id ? "Cuéntanos qué necesitas" : "¿Qué tema se te complica?"}
            </h1>
          </div>

          {subject && subject.id !== OTHER_SUBJECT.id && (
            <>
              {topics.loading && !topics.data && <Skeleton className="h-24" />}
              <div className="flex flex-wrap gap-2">
                {subjectTopics.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => pickTopic(t)}
                    className={cn(
                      "rounded-2xl bg-card px-4 py-3 text-base font-extrabold ring-1 ring-border transition-all hover:ring-2 hover:ring-primary active:scale-[0.98]",
                      topic?.id === t.id && "bg-primary text-primary-foreground ring-primary",
                    )}
                  >
                    {t.name}
                  </button>
                ))}
              </div>
              <p className="pt-2 text-sm font-bold text-muted-foreground">¿No está en la lista? Escríbelo:</p>
            </>
          )}

          <textarea
            value={freeText}
            onChange={(e) => typeFree(e.target.value)}
            placeholder={DETAIL_HINTS[subject?.id ?? ""] ?? "Ej.: quiero aprender a hacer un ensayo para el viernes…"}
            rows={3}
            maxLength={280}
            className="w-full resize-none rounded-2xl bg-card p-4 text-base font-semibold ring-1 ring-border outline-none placeholder:font-medium placeholder:text-muted-foreground focus:ring-4 focus:ring-ring/20"
            aria-label="Escribe el tema que necesitas"
          />
        </section>
      )}

      {/* ③ Cómo y cuándo */}
      {currentStep === 3 && (
        <section className="space-y-6 animate-in fade-in">
          <div>
            <p className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-sm font-extrabold text-primary">
              {subject?.emoji} {topic?.name ?? "Tema libre"}
            </p>
            <h1 className="mt-3 font-heading text-3xl font-semibold">¿Cómo y cuándo?</h1>
          </div>

          {topic && (
            <div>
              <label htmlFor="detalle" className="mb-1.5 block text-sm font-extrabold">
                ¿Qué parte exactamente? <span className="font-semibold text-muted-foreground">(opcional, ayuda a tu tutor)</span>
              </label>
              <input
                id="detalle"
                value={detail}
                onChange={(e) => setDetail(e.target.value)}
                maxLength={200}
                placeholder={DETAIL_HINTS[subject?.id ?? ""] ?? "Ej.: tengo examen el viernes"}
                className="w-full rounded-2xl bg-card px-4 py-3 text-base font-semibold ring-1 ring-border outline-none placeholder:font-medium placeholder:text-muted-foreground focus:ring-4 focus:ring-ring/20"
              />
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 @xl:grid-cols-2">
            {(
              [
                { v: "grupo", icon: Users, title: "Con otros chicos", body: "Se reparten el precio: pagas solo una parte.", tag: "Más barato" },
                { v: "individual", icon: User, title: "Solo yo", body: "Toda la atención del tutor para ti. Pagas la clase completa." },
              ] as const
            ).map((o) => (
              <button
                key={o.v}
                onClick={() => setMode(o.v)}
                aria-pressed={mode === o.v}
                className={cn(
                  "relative flex items-start gap-3 rounded-3xl bg-card p-4 text-left ring-1 ring-border transition-all",
                  mode === o.v && "bg-primary/5 ring-2 ring-primary",
                )}
              >
                <span className={cn("grid size-10 shrink-0 place-items-center rounded-2xl", mode === o.v ? "bg-primary text-white" : "bg-muted")}>
                  <o.icon className="size-5" />
                </span>
                <span className="min-w-0">
                  <span className="flex items-center gap-2 font-extrabold">
                    {o.title}
                    {"tag" in o && <span className="rounded-full bg-mint px-2 py-0.5 text-[10px] font-black text-accent-foreground">{o.tag}</span>}
                  </span>
                  <span className="text-sm text-muted-foreground">{o.body}</span>
                </span>
                {mode === o.v && <Check className="absolute top-3 right-3 size-5 text-primary" />}
              </button>
            ))}
          </div>

          <div>
            <p className="mb-2 font-extrabold">¿Cuándo te viene bien?</p>
            <div className="grid grid-cols-2 gap-2 @xl:grid-cols-4">
              {SLOTS.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setWhen(s.id)}
                  aria-pressed={when === s.id}
                  className={cn(
                    "flex items-center gap-2 rounded-2xl px-3 py-3 text-sm font-bold ring-1 ring-border transition-colors",
                    when === s.id ? "bg-navy text-white ring-navy" : "bg-card",
                  )}
                >
                  <span aria-hidden>{s.emoji}</span> {s.label}
                </button>
              ))}
            </div>
          </div>

          <p className="flex items-start gap-2 rounded-2xl bg-secondary p-3 text-sm text-secondary-foreground">
            <Sparkles className="mt-0.5 size-4 shrink-0" />
            <span>
              Te mostramos quién puede enseñarte y cuánto cuesta. Si no hay nadie, un tutor IA te enseña al toque. Tienes{" "}
              <Quipus amount={me?.available ?? 0} className="text-sm" /> disponibles; nada se cobra hasta que termine la clase.
            </span>
          </p>
        </section>
      )}

      {/* Botón fijo abajo: siempre visible en el celular */}
      {currentStep > 1 && (
        <div className="sticky bottom-0 -mx-4 mt-6 bg-gradient-to-t from-background via-background to-transparent px-4 pt-6 pb-2 @xl:-mx-7 @xl:px-7">
          {currentStep === 2 ? (
            <button disabled={!canGoOn} onClick={() => setStep(3)} className={cn(btn.primary, btn.lg, "w-full")}>
              Siguiente
            </button>
          ) : (
            <button disabled={pending || text.length < 3} onClick={submit} className={cn(btn.primary, btn.lg, "w-full")}>
              {pending ? "Buscando…" : "Ver quién me puede enseñar"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
