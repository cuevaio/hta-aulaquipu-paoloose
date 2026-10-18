import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  ClipboardCheck,
  FileText,
  Image as ImageIcon,
  LineChart,
  MessageCircle,
  Mic,
  NotebookPen,
  Presentation,
  ShieldCheck,
  Users,
  Sparkles,
  Map,
  DoorOpen,
} from "lucide-react";
import { Logo } from "@/components/logo";
import { Card, QuipuIcon, btn } from "@/components/bits";
import { cn } from "@/lib/utils";
import { IN_PROGRESS, NOT_DONE, PROBLEM_STATS, REPO_URL, TAGLINE, TEAM_PLACEHOLDER } from "@/lib/public-content";

export const metadata: Metadata = {
  title: "AulaQuipu: el que sabe enseña y gana",
  description:
    "AulaQuipu es un campus 2D donde los alumnos de secundaria se enseñan entre sí y con tutores de IA, pagando con quipus, dinero de juego sin retiro.",
  openGraph: {
    title: "AulaQuipu: el que sabe enseña y gana",
    description: `${TAGLINE} Tutorías entre alumnos y con IA, con dinero de juego.`,
    type: "website",
    locale: "es_PE",
    siteName: "AulaQuipu",
  },
  twitter: { card: "summary", title: "AulaQuipu", description: TAGLINE },
};

const STEPS = [
  { n: 1, title: "Entras con 100 quipus", text: "Cada cuenta nueva recibe 100 quipus, dinero de juego. Con eso ya puedes aprender." },
  { n: 2, title: "Aprende pidiendo ayuda", text: "Publicas qué no entiendes, el sistema arma grupos y pagas la clase de un compañero o de un tutor IA." },
  { n: 3, title: "Enseña y gana", text: "Declaras lo que sabes, te contratan y ganas quipus, reputación y estrellas. Con ellos personalizas tu avatar." },
];

const AI_FEATURES = [
  { icon: Mic, title: "Voz en vivo", text: "Conversas con el tutor en tiempo real, como en una llamada." },
  { icon: FileText, title: "Documento", text: "El tutor escribe apuntes y tablas en un documento compartido." },
  { icon: LineChart, title: "Graficador", text: "Pide “grafica y = x²” y la curva aparece en Desmos." },
  { icon: NotebookPen, title: "Cuaderno", text: "Dibuja a mano o sube la foto de tu cuaderno y anota encima." },
  { icon: ClipboardCheck, title: "Actividades y quiz", text: "Preguntas de opción múltiple con corrección y explicación." },
  { icon: Sparkles, title: "Resumen al terminar", text: "Qué vimos, qué te costó y 3 ejercicios para practicar." },
  { icon: BookOpen, title: "Guías por tema", text: "Los administradores definen objetivos, pasos y errores comunes por tema." },
  { icon: ImageIcon, title: "Imágenes", text: "Diagramas educativos de un banco propio o de Wikimedia, con crédito." },
];

const CAMPUS = [
  { icon: Map, title: "Campus 2D multijugador", text: "Caminas con tu avatar y ves a otros alumnos conectados en tiempo real." },
  { icon: MessageCircle, title: "Chat por cercanía", text: "Los globos de texto solo llegan a quienes están cerca, en la misma sala. Empieza apagado." },
  { icon: DoorOpen, title: "Salas", text: "Biblioteca para pedir ayuda, sala de tutores para enseñar y laboratorio con aulas IA." },
];

const SAFETY = [
  "Dinero de juego: sin depósitos, sin retiros y sin precios en soles.",
  "Sin links externos: el chat los bloquea y los documentos solo muestran imágenes de orígenes permitidos.",
  "Chat opcional, apagado por defecto, con filtro de palabras, bloqueo por usuario y reportes.",
  "Moderación desde el panel de administración: suspensiones, bandeja de reportes y auditoría de cada acción.",
  "Datos en servidor con RLS: el saldo se deriva de un ledger auditable y no es editable.",
];

const TECH = [
  { name: "Next.js", note: "App Router, API y campus" },
  { name: "Supabase / Postgres", note: "Datos, RLS y ledger" },
  { name: "LiveKit", note: "Salas, voz y canal de datos" },
  { name: "GPT-Live", note: "Voz del tutor IA" },
  { name: "Director de clase", note: "Modelo de texto que decide acciones" },
  { name: "Desmos", note: "Graficador en vivo" },
  { name: "AtomicMemory", note: "Memoria de clases (en progreso)" },
];

function Section({ id, title, kicker, children }: { id: string; title: string; kicker?: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="mx-auto w-full max-w-5xl px-4 py-12 md:px-8 md:py-16">
      {kicker && <p className="mb-2 text-sm font-extrabold tracking-wide text-primary uppercase">{kicker}</p>}
      <h2 id={id} className="mb-6 font-heading text-3xl font-semibold md:text-4xl">
        {title}
      </h2>
      {children}
    </section>
  );
}

export default function InfoPage() {
  return (
    <main className="flex-1">
      <header className="hero-sky text-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-5 md:px-8">
          <Logo light />
          <nav aria-label="Principal" className="flex items-center gap-2 text-sm font-extrabold">
            <Link href="/presentacion" className="rounded-xl px-3 py-2 text-white/80 hover:text-white">
              Presentación
            </Link>
            <Link href="/" className={cn(btn.mint, "h-10 px-4 text-sm")}>
              Entrar
            </Link>
          </nav>
        </div>
        <div className="mx-auto max-w-5xl px-4 pt-10 pb-16 md:px-8 md:pt-16 md:pb-24">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-mint">
            <QuipuIcon /> Hack the Andes 2026
          </p>
          <h1 className="font-heading text-4xl leading-[1.05] font-semibold md:text-6xl">
            El que sabe <span className="text-mint">enseña y gana.</span>
            <br />
            El que aprende <span className="text-gold">paga y mejora.</span>
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-white/80">
            AulaQuipu es un campus donde los alumnos de secundaria se enseñan entre sí y con tutores de IA, y todos aprenden a manejar dinero sin arriesgar dinero real.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/" className={cn(btn.mint, btn.lg)}>
              Entrar al campus <ArrowRight className="size-5" />
            </Link>
            <Link href="/presentacion" className={cn(btn.soft, btn.lg)}>
              <Presentation className="size-5" /> Ver presentación
            </Link>
          </div>
        </div>
      </header>

      <Section id="problema" kicker="El problema" title="Un profesor no llega a 30 alumnos">
        <p className="mb-6 max-w-3xl text-muted-foreground">
          En un salón peruano la clase es igual para todos: no sirve a quien va atrasado, aburre a quien ya sabe y el tutor privado es caro. Mientras tanto nadie aprende a manejar dinero en la práctica.
        </p>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PROBLEM_STATS.map((s) => (
            <li key={s.label}>
              <Card className="h-full">
                <p className="font-heading text-4xl font-semibold text-primary">{s.value}</p>
                <p className="mt-2 font-bold">{s.label}</p>
                <p className="mt-3 text-xs font-bold text-muted-foreground">Fuente: {s.source}</p>
              </Card>
            </li>
          ))}
        </ul>
      </Section>

      <Section id="como" kicker="Cómo funciona" title="Tres pasos, un bucle">
        <ol className="grid gap-4 md:grid-cols-3">
          {STEPS.map((s) => (
            <li key={s.n}>
              <Card className="h-full">
                <span className="mb-3 grid size-10 place-items-center rounded-2xl bg-primary font-heading text-lg font-semibold text-primary-foreground">{s.n}</span>
                <h3 className="font-heading text-xl font-semibold">{s.title}</h3>
                <p className="mt-2 text-muted-foreground">{s.text}</p>
              </Card>
            </li>
          ))}
        </ol>
        <p className="mt-6 font-bold">Vuelves por una de dos razones: llenar tu billetera enseñando o vaciarla aprendiendo.</p>
      </Section>

      <Section id="tutores-ia" kicker="Tutores IA" title="Una clase completa, en vivo">
        <p className="mb-6 max-w-3xl text-muted-foreground">
          Un tutor con voz da la clase y un director de clase, basado en un modelo de texto, decide las acciones: graficar, abrir una actividad o escribir en el documento.
        </p>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {AI_FEATURES.map(({ icon: Icon, title, text }) => (
            <li key={title}>
              <Card className="h-full">
                <Icon className="mb-3 size-6 text-primary" aria-hidden />
                <h3 className="font-extrabold">{title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{text}</p>
              </Card>
            </li>
          ))}
        </ul>
      </Section>

      <Section id="campus" kicker="Campus" title="Un lugar al que quieres volver">
        <ul className="grid gap-4 md:grid-cols-3">
          {CAMPUS.map(({ icon: Icon, title, text }) => (
            <li key={title}>
              <Card className="h-full">
                <Icon className="mb-3 size-6 text-primary" aria-hidden />
                <h3 className="font-heading text-xl font-semibold">{title}</h3>
                <p className="mt-2 text-muted-foreground">{text}</p>
              </Card>
            </li>
          ))}
        </ul>
      </Section>

      <Section id="seguridad" kicker="Seguridad y menores" title="Pensado para menores de edad">
        <Card className="bg-gold/15 ring-gold/40">
          <ul className="space-y-3">
            {SAFETY.map((t) => (
              <li key={t} className="flex gap-3 font-semibold">
                <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
                {t}
              </li>
            ))}
          </ul>
        </Card>
      </Section>

      <Section id="tecnologia" kicker="Tecnología" title="Qué hay debajo">
        <ul className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {TECH.map((t) => (
            <li key={t.name} className="rounded-2xl bg-card p-4 ring-1 ring-border">
              <p className="font-extrabold">{t.name}</p>
              <p className="text-sm text-muted-foreground">{t.note}</p>
            </li>
          ))}
        </ul>
      </Section>

      <Section id="fuera" kicker="Alcance" title="Qué quedó fuera">
        <ul className="grid gap-3 md:grid-cols-2">
          {NOT_DONE.map((n) => (
            <li key={n.title} className="rounded-2xl bg-card p-4 ring-1 ring-border">
              <p className="font-extrabold">{n.title}</p>
              <p className="text-sm text-muted-foreground">{n.text}</p>
            </li>
          ))}
        </ul>
        <h3 className="mt-8 mb-3 font-heading text-xl font-semibold">En progreso</h3>
        <ul className="grid gap-3 md:grid-cols-2">
          {IN_PROGRESS.map((n) => (
            <li key={n.title} className="rounded-2xl bg-secondary p-4">
              <p className="font-extrabold">{n.title}</p>
              <p className="text-sm text-muted-foreground">{n.text}</p>
            </li>
          ))}
        </ul>
      </Section>

      <Section id="equipo" kicker="Equipo" title="Quiénes lo hicieron">
        {/* PENDIENTE (equipo): reemplazar por los nombres reales en lib/public-content.ts */}
        <ul className="grid gap-3 md:grid-cols-3">
          {TEAM_PLACEHOLDER.map((t) => (
            <li key={t} className="flex items-center gap-3 rounded-2xl bg-card p-4 ring-1 ring-border">
              <Users className="size-5 text-muted-foreground" aria-hidden />
              <span className="font-bold text-muted-foreground">{t}</span>
            </li>
          ))}
        </ul>
      </Section>

      <footer className="hero-sky text-white">
        <div className="mx-auto flex max-w-5xl flex-col items-start gap-6 px-4 py-10 md:flex-row md:items-center md:justify-between md:px-8">
          <div>
            <Logo light />
            <p className="mt-2 text-sm text-white/70">Hack the Andes 2026, Lima.</p>
          </div>
          <nav aria-label="Enlaces" className="flex flex-wrap gap-x-5 gap-y-2 text-sm font-extrabold">
            <Link href="/" className="hover:underline">Entrar al campus</Link>
            <Link href="/presentacion" className="hover:underline">Presentación</Link>
            <a href={REPO_URL} className="hover:underline" rel="noopener noreferrer">Código en GitHub</a>
          </nav>
        </div>
      </footer>
    </main>
  );
}
