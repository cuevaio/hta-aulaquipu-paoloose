import Image from "next/image";
import { Logo } from "@/components/logo";
import { ClassMock } from "@/components/class-mock";
import { PROBLEM_STATS, PUBLIC_URL_LABEL, REPO_URL } from "@/lib/public-content";
import type { DeckSlide } from "./deck";

// Todo el contenido se escribe para un escenario de 1920x1080: los tamaños son px del escenario, no de la pantalla.
// Fondo navy, texto crema y un solo acento dorado.

function Frame({ kicker, title, children }: { kicker: string; title: string; children: React.ReactNode }) {
  return (
    <div className="flex h-full flex-col px-[120px] py-[88px]">
      <p className="mb-4 text-[28px] font-extrabold tracking-[0.18em] text-aurum uppercase">{kicker}</p>
      <h2 className="mb-12 max-w-[1500px] font-heading text-[76px] leading-[1.06] font-semibold">{title}</h2>
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  );
}

const slideTitle: DeckSlide = {
  title: "AulaQuipu",
  notes: "Presenta el nombre y la frase. En 20 segundos: es un campus donde los alumnos de secundaria se enseñan entre sí y con tutores de IA, pagando con dinero de juego.",
  content: (
    <div className="flex h-full flex-col justify-between px-[120px] py-[100px]">
      <Logo className="origin-left scale-[2] text-[28px]" />
      <h1 className="font-heading text-[124px] leading-[1.04] font-semibold">
        <span className="text-aurum">El que sabe enseña y gana.</span>
        <br />
        El que aprende paga y mejora.
      </h1>
      <p className="text-[34px] text-cream-dim">Hack the Andes 2026 · Lima</p>
    </div>
  ),
};

const slideProblem: DeckSlide = {
  title: "El problema",
  notes: "Un profesor no llega a 30 alumnos. Lee las tres cifras con su fuente. Habla del alumno de secundaria que va atrasado y del que sabe y se aburre: se necesitan entre sí. Cierra con: nadie aprende a manejar dinero mientras las apuestas están a un toque.",
  content: (
    <Frame kicker="El problema" title="Un profesor no llega a 30 alumnos">
      <div className="grid grid-cols-3 gap-16">
        {PROBLEM_STATS.map((s) => (
          <div key={s.label}>
            <p className="font-heading text-[130px] leading-none font-semibold text-aurum">{s.value}</p>
            <p className="mt-6 text-[36px] leading-snug">{s.label}</p>
            <p className="mt-4 text-[26px] text-cream-dim">{s.source}</p>
          </div>
        ))}
      </div>
    </Frame>
  ),
};

function LoopDiagram() {
  return (
    <svg viewBox="0 0 1500 460" className="mx-auto h-[560px] w-full" role="img" aria-label="Bucle: el que enseña gana quipus, el que aprende los paga y mejora, y vuelve a poder enseñar">
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0L10 5L0 10z" fill="#d9b25f" />
        </marker>
      </defs>
      <rect x="20" y="120" width="480" height="220" rx="36" fill="#d9b25f" />
      <text x="260" y="215" textAnchor="middle" fontSize="60" fontWeight="800" fill="#15142c">Enseñar</text>
      <text x="260" y="275" textAnchor="middle" fontSize="34" fontWeight="700" fill="#15142c">y ganar quipus</text>
      <rect x="1000" y="120" width="480" height="220" rx="36" fill="#2a2750" stroke="#d9b25f" strokeWidth="3" />
      <text x="1240" y="215" textAnchor="middle" fontSize="60" fontWeight="800" fill="#f4efe3">Aprender</text>
      <text x="1240" y="275" textAnchor="middle" fontSize="34" fontWeight="700" fill="#f4efe3">y pagar la clase</text>
      <path d="M1000 160 C 880 40, 620 40, 500 160" fill="none" stroke="#d9b25f" strokeWidth="6" markerEnd="url(#arrow)" />
      <path d="M500 300 C 620 420, 880 420, 1000 300" fill="none" stroke="#d9b25f" strokeWidth="6" markerEnd="url(#arrow)" />
      <text x="750" y="240" textAnchor="middle" fontSize="80" fontWeight="800" fill="#d9b25f">100</text>
      <text x="750" y="285" textAnchor="middle" fontSize="32" fontWeight="700" fill="#b9b5c9">quipus al empezar</text>
    </svg>
  );
}

const slideLoop: DeckSlide = {
  title: "La solución",
  notes: "Explica el bucle: empiezas con 100 quipus. Si quieres aprender, pagas una clase. Si quieres ganar, enseñas. Vuelves por una de las dos razones. El quipu es dinero de juego, nunca sale del sistema, así que todos practican manejar dinero sin arriesgar dinero real.",
  content: (
    <Frame kicker="La solución" title="Enseñar y aprender, con dinero de juego">
      <LoopDiagram />
    </Frame>
  ),
};

const slideCampus: DeckSlide = {
  title: "El campus",
  notes: "Captura real del campus 2D. Los alumnos caminan, ven a otros conectados y entran a salas: biblioteca para pedir ayuda, sala de tutores para enseñar y laboratorio con aulas IA. El chat por cercanía empieza apagado.",
  content: (
    <Frame kicker="El producto" title="Un campus al que quieres volver">
      <div className="grid grid-cols-[1.5fr_1fr] items-center gap-20">
        <Image
          src="/landing/campus.jpg"
          alt="El campus 2D de AulaQuipu"
          width={1280}
          height={699}
          priority
          className="h-auto w-full rounded-3xl shadow-2xl shadow-black/60 ring-2 ring-cream/10"
        />
        <ul className="space-y-8 text-[40px] leading-snug">
          <li className="border-l-4 border-aurum pl-6">Caminas con tu avatar.</li>
          <li className="border-l-4 border-aurum pl-6">Ves a otros alumnos en tiempo real.</li>
          <li className="border-l-4 border-aurum pl-6">Entras a una sala y empieza la clase.</li>
        </ul>
      </div>
    </Frame>
  ),
};

const slideClass: DeckSlide = {
  title: "La clase",
  notes: "Guion de demo en vivo (5 minutos): entrar con una cuenta de prueba, caminar por el campus, pedir ayuda en un tema, entrar a clase con un tutor IA, decir “grafica y = x²” y ver la curva, responder el quiz en Actividad, terminar y leer el resumen, abrir el panel admin con métricas. Si LiveKit falla, usa el modo local. Cuenta de prueba: elige una del panel de cuentas de la pantalla de entrada.",
  content: (
    <Frame kicker="Demo" title="Una clase con tutor IA">
      <div className="flex items-start justify-between gap-16">
        <div className="shrink-0" style={{ width: 1100 }}>
          <div style={{ zoom: 1.5, width: 1100 / 1.5 }}>
            <ClassMock />
          </div>
        </div>
        <ul className="space-y-9 pt-6 text-[40px] leading-snug">
          <li className="border-l-4 border-aurum pl-6">Voz en vivo.</li>
          <li className="border-l-4 border-aurum pl-6">Grafica y propone actividades.</li>
          <li className="border-l-4 border-aurum pl-6">Resume al terminar.</li>
        </ul>
      </div>
    </Frame>
  ),
};

function Box({ x, y, w = 300, h = 110, title, sub, accent }: { x: number; y: number; w?: number; h?: number; title: string; sub: string; accent?: boolean }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx="24" fill={accent ? "#d9b25f" : "#2a2750"} stroke={accent ? "none" : "#d9b25f"} strokeOpacity="0.45" strokeWidth="2" />
      <text x={x + w / 2} y={y + 48} textAnchor="middle" fontSize="30" fontWeight="800" fill={accent ? "#15142c" : "#f4efe3"}>
        {title}
      </text>
      <text x={x + w / 2} y={y + 84} textAnchor="middle" fontSize="22" fontWeight="700" fill={accent ? "#15142c" : "#b9b5c9"}>
        {sub}
      </text>
    </g>
  );
}

function ArchitectureDiagram() {
  const line = { stroke: "#b9b5c9", strokeWidth: 4, fill: "none", markerStart: "url(#a2)", markerEnd: "url(#a2)" } as const;
  return (
    <svg viewBox="0 0 1700 600" className="mx-auto h-[640px] w-full" role="img" aria-label="Arquitectura: navegador, API de Next.js, Supabase, LiveKit, agente de voz, director de clase y memoria">
      <defs>
        <marker id="a2" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M0 0L10 5L0 10z" fill="#b9b5c9" />
        </marker>
      </defs>
      <Box x={40} y={245} title="Navegador" sub="Next.js" accent />
      <Box x={470} y={50} title="API" sub="validación · ledger" />
      <Box x={950} y={50} title="Supabase" sub="Postgres · RLS" />
      <Box x={950} y={245} title="Director de clase" sub="modelo de texto" accent />
      <Box x={470} y={440} title="LiveKit" sub="sala en vivo" />
      <Box x={950} y={440} title="Agente de voz" sub="GPT-Live" />
      <Box x={1380} y={245} title="Acciones" sub="Desmos · Actividad" />
      <Box x={1380} y={440} title="AtomicMemory" sub="en progreso" />
      <path d="M340 285 H405 V105 H470" {...line} markerStart="none" />
      <path d="M770 105 H950" {...line} />
      <path d="M620 160 V300 H950" {...line} markerStart="none" />
      <path d="M340 315 H405 V495 H470" {...line} />
      <path d="M770 495 H950" {...line} />
      <path d="M1250 300 H1380" {...line} markerStart="none" />
      <path d="M1250 495 H1380" {...line} />
    </svg>
  );
}

const slideArch: DeckSlide = {
  title: "Arquitectura",
  notes: "Camino de una clase IA: el navegador entra a una sala de LiveKit donde está el agente de voz con GPT-Live. En paralelo, el director de clase (un modelo de texto, llamado desde la API) decide acciones deterministas: graficar, abrir un quiz o escribir en el documento, y llegan al aula por el canal de datos de LiveKit. La API habla con Supabase. AtomicMemory aún no está activa.",
  content: (
    <Frame kicker="Arquitectura" title="Voz en vivo y un director que actúa">
      <ArchitectureDiagram />
    </Frame>
  ),
};

const QUALITY = [
  ["Validación en servidor", "La interfaz no es la barrera."],
  ["Saldo auditable", "Se deriva de un ledger, no se edita."],
  ["RLS en cada tabla", "La clave de servicio nunca llega al navegador."],
  ["Sin links externos", "El chat los bloquea y las imágenes vienen de orígenes de confianza."],
];

const slideQuality: DeckSlide = {
  title: "Seguridad",
  notes: "El público son menores, así que la seguridad es parte del producto. Destaca el ledger (saldo derivado), que la clave del quiz vive en el servidor, que cada acción admin deja auditoría y que el chat es opcional y empieza apagado, con filtro, bloqueo y reportes.",
  content: (
    <Frame kicker="Calidad técnica" title="Pensado para menores de edad">
      <ul className="grid grid-cols-2 gap-x-20 gap-y-12">
        {QUALITY.map(([t, d]) => (
          <li key={t} className="border-l-4 border-aurum pl-8">
            <p className="font-heading text-[48px] leading-tight font-semibold">{t}</p>
            <p className="mt-2 text-[32px] leading-snug text-cream-dim">{d}</p>
          </li>
        ))}
      </ul>
    </Frame>
  ),
};

const slideImpact: DeckSlide = {
  title: "Tracción y alcance",
  notes: "COMPLETAR antes de presentar con cifras reales del panel admin. No presentes números que no estén en el panel. Si aún no hay datos, di qué medirías y por qué. Fuera por decisión: monetización real, control parental, panel de profesor, currículo del Minedu y app nativa. En progreso: memoria de clases (integrada, no activa) y primaria con consentimiento de padres.",
  content: (
    <Frame kicker="Tracción y alcance" title="Qué mediremos y qué dejamos fuera">
      <div className="grid grid-cols-3 gap-12">
        {["Usuarios registrados", "Clases completadas", "Quipus en circulación"].map((l) => (
          <div key={l} className="border-t-2 border-dashed border-cream-dim/60 pt-6">
            <p className="font-heading text-[88px] leading-none font-semibold text-cream-dim">—</p>
            <p className="mt-4 text-[34px] font-bold">{l}</p>
            <p className="mt-1 text-[26px] text-cream-dim">Pendiente: completar con el panel admin</p>
          </div>
        ))}
      </div>
      <p className="mt-16 max-w-[1500px] text-[36px] leading-snug text-cream-dim">
        Fuera, por decisión: monetización real, control parental, panel de profesor, currículo del Minedu y app nativa.
      </p>
      <p className="mt-6 max-w-[1500px] text-[36px] leading-snug">En progreso: memoria de clases y primaria con consentimiento de padres.</p>
    </Frame>
  ),
};

const slideThanks: DeckSlide = {
  title: "Gracias",
  notes: "Cierra con la frase y deja esta pantalla para preguntas.",
  content: (
    <div className="flex h-full flex-col justify-between px-[120px] py-[100px]">
      <Logo className="origin-left scale-[2] text-[28px]" />
      <div>
        <h2 className="font-heading text-[120px] leading-[1.04] font-semibold">
          Pruébalo ahora<span className="text-aurum">.</span>
        </h2>
        <p className="mt-10 font-mono text-[56px] font-bold text-aurum">{PUBLIC_URL_LABEL}</p>
        <p className="mt-6 font-mono text-[34px] text-cream-dim">{REPO_URL.replace("https://", "")}</p>
      </div>
      <p className="text-[34px] text-cream-dim">El que sabe enseña y gana. El que aprende paga y mejora.</p>
    </div>
  ),
};

export const SLIDES: DeckSlide[] = [slideTitle, slideProblem, slideLoop, slideCampus, slideClass, slideArch, slideQuality, slideImpact, slideThanks];
