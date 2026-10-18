import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Logo } from "@/components/logo";
import { ClassMock } from "@/components/class-mock";
import { PROBLEM_STATS, PUBLIC_URL_LABEL, REPO_URL, TAGLINE } from "@/lib/public-content";

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

const CTA =
  "inline-flex h-12 items-center justify-center gap-2 rounded-full bg-aurum px-7 font-extrabold text-ink transition-colors hover:bg-aurum-hi focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-aurum-hi";
const QUIET = "text-cream-dim underline-offset-4 hover:text-cream hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-aurum-hi";

const CLASS_POINTS = [
  "Hablas con el tutor en voz alta, como en una llamada.",
  "Grafica y propone actividades cuando las necesitas.",
  "Al terminar, te resume qué viste y qué practicar.",
];

const STEPS = [
  ["Entras con 100 quipus", "Dinero de juego, sin retiros. Con eso ya puedes aprender."],
  ["Pides ayuda y pagas la clase", "A un compañero o a un tutor de IA, sobre lo que no entiendes."],
  ["Enseñas y ganas", "Declaras lo que sabes, te contratan y usas lo ganado para personalizar tu avatar."],
];

export default function InfoPage() {
  const [reading, math, betting] = PROBLEM_STATS;
  return (
    <main className="min-h-dvh flex-1 bg-ink text-cream">
      <div className="mx-auto w-full max-w-6xl px-5 md:px-10">
        <header className="flex items-center justify-between py-6">
          <Logo gold />
          <Link href="/presentacion" className={`${QUIET} text-sm font-bold`}>
            Presentación
          </Link>
        </header>

        <section aria-labelledby="titulo" className="grid items-center gap-12 pt-10 pb-20 lg:grid-cols-[1fr_1.15fr] lg:gap-14 lg:pt-20 lg:pb-28">
          <div>
            <h1 id="titulo" className="font-heading text-4xl leading-[1.08] font-semibold sm:text-5xl lg:text-6xl">
              <span className="text-aurum">El que sabe enseña y gana.</span>
              <br />
              El que aprende paga y mejora.
            </h1>
            <p className="mt-6 max-w-md text-lg leading-relaxed text-cream-dim">
              Un campus donde los alumnos de secundaria se enseñan entre sí y con tutores de IA, usando dinero de juego.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-x-7 gap-y-4">
              <Link href="/" className={CTA}>
                Entrar al campus <ArrowRight className="size-5" aria-hidden />
              </Link>
              <Link href="/presentacion" className={QUIET}>
                Ver la presentación
              </Link>
            </div>
          </div>
          <Image
            src="/landing/campus.jpg"
            alt="El campus 2D de AulaQuipu con avatares de alumnos caminando entre las salas"
            width={1280}
            height={699}
            priority
            sizes="(min-width: 1024px) 620px, 100vw"
            className="h-auto w-full rounded-2xl shadow-2xl shadow-black/50 ring-1 ring-cream/10"
          />
        </section>

        <section aria-labelledby="problema" className="border-t border-cream/10 py-20 md:py-28">
          <div className="max-w-3xl">
            <h2 id="problema" className="mb-6 text-sm font-extrabold tracking-widest text-aurum uppercase">
              El problema
            </h2>
            <p className="font-heading text-2xl leading-snug sm:text-3xl">
              Solo <strong className="font-semibold text-aurum">{reading.value}</strong> de los alumnos de 5º de secundaria alcanza nivel satisfactorio en lectura y{" "}
              <strong className="font-semibold text-aurum">{math.value}</strong> en matemática. Mientras tanto, las apps de apuestas sumaron{" "}
              <strong className="font-semibold text-aurum">{betting.value}</strong> de accesos en 2025.
            </p>
            <p className="mt-6 text-sm text-cream-dim">Fuentes: ENLA 2025 (Minedu); accesos a apps de apuestas, 2025.</p>
          </div>
        </section>

        <section aria-labelledby="clase" className="border-t border-cream/10 py-20 md:py-28">
          <h2 id="clase" className="mb-10 font-heading text-3xl font-semibold sm:text-4xl">
            Así se ve una clase
          </h2>
          <div className="grid items-center gap-10 lg:grid-cols-[1.4fr_1fr] lg:gap-14">
            <ClassMock />
            <ul className="space-y-5 text-lg leading-snug">
              {CLASS_POINTS.map((t) => (
                <li key={t} className="border-l-2 border-aurum pl-4">
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section aria-labelledby="como" className="border-t border-cream/10 py-20 md:py-28">
          <h2 id="como" className="mb-10 font-heading text-3xl font-semibold sm:text-4xl">
            Cómo funciona
          </h2>
          <ol className="max-w-3xl space-y-8">
            {STEPS.map(([title, text], i) => (
              <li key={title} className="grid grid-cols-[3rem_1fr] items-baseline gap-2">
                <span className="font-heading text-4xl text-aurum">{i + 1}</span>
                <div>
                  <p className="font-heading text-xl font-semibold">{title}</p>
                  <p className="mt-1 text-cream-dim">{text}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      </div>

      <section aria-labelledby="cierre" className="bg-ink-2 py-20 text-center md:py-24">
        <div className="mx-auto max-w-2xl px-5">
          <h2 id="cierre" className="font-heading text-3xl font-semibold sm:text-4xl">
            Tu primera clase te espera.
          </h2>
          <p className="mt-3 text-cream-dim">Empiezas con 100 quipus.</p>
          <Link href="/" className={`${CTA} mt-8`}>
            Entrar al campus <ArrowRight className="size-5" aria-hidden />
          </Link>
        </div>
      </section>

      <footer className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-5 py-8 text-sm text-cream-dim md:flex-row md:items-center md:justify-between md:px-10">
        <p>Hack the Andes 2026 · {PUBLIC_URL_LABEL}</p>
        <nav aria-label="Enlaces" className="flex gap-6">
          <a href={REPO_URL} rel="noopener noreferrer" className={QUIET}>
            Código en GitHub
          </a>
          <Link href="/presentacion" className={QUIET}>
            Presentación
          </Link>
        </nav>
      </footer>
    </main>
  );
}
