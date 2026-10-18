import { Logo } from "@/components/logo";
import { QuipuIcon } from "@/components/bits";
import { cn } from "@/lib/utils";
import { IN_PROGRESS, NOT_DONE, PROBLEM_STATS, PUBLIC_URL_LABEL, REPO_URL } from "@/lib/public-content";
import type { DeckSlide } from "./deck";

// Todo el contenido se escribe para un escenario de 1920x1080: los tamaños son px del escenario, no de la pantalla.

function Frame({ kicker, title, children }: { kicker: string; title: string; children: React.ReactNode }) {
  return (
    <div className="flex h-full flex-col px-[120px] py-[80px]">
      <p className="mb-3 text-[28px] font-extrabold tracking-wide text-primary uppercase">{kicker}</p>
      <h2 className="mb-10 font-heading text-[72px] leading-[1.05] font-semibold">{title}</h2>
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  );
}

function Placeholder({ children }: { children: React.ReactNode }) {
  return <span className="rounded-lg border-4 border-dashed border-coral px-3 text-coral">{children}</span>;
}

const slideTitle: DeckSlide = {
  title: "AulaQuipu",
  notes: "Presenta el nombre y la frase. En 20 segundos: es un campus donde los alumnos de secundaria se enseñan entre sí y con tutores de IA, pagando con dinero de juego.",
  content: (
    <div className="hero-sky flex h-full flex-col justify-between px-[120px] py-[100px] text-white">
      <Logo light className="origin-left scale-[2] text-[28px]" />
      <div>
        <h1 className="font-heading text-[116px] leading-[1.02] font-semibold">
          El que sabe <span className="text-mint">enseña y gana.</span>
          <br />
          El que aprende <span className="text-gold">paga y mejora.</span>
        </h1>
        <p className="mt-10 text-[40px] text-white/80">Tutorías entre alumnos y con IA, con dinero de juego.</p>
      </div>
      <p className="flex items-center gap-4 text-[32px] font-bold text-white/80">
        <QuipuIcon className="size-9" /> Hack the Andes 2026 · Lima
      </p>
    </div>
  ),
};

const slideProblem: DeckSlide = {
  title: "El problema",
  notes: "Un profesor no llega a 30 alumnos. Lee las cuatro cifras con su fuente. Cierra con: la mayoría no aprende, y nadie aprende a manejar dinero mientras las apuestas están a un toque.",
  content: (
    <Frame kicker="El problema" title="Un profesor no llega a 30 alumnos">
      <div className="grid grid-cols-4 gap-8">
        {PROBLEM_STATS.map((s) => (
          <div key={s.label} className="flex flex-col rounded-[40px] bg-card p-10 shadow-[0_6px_0_0_var(--border)] ring-2 ring-border">
            <p className="font-heading text-[96px] leading-none font-semibold text-primary">{s.value}</p>
            <p className="mt-6 text-[34px] leading-snug font-bold">{s.label}</p>
            <p className="mt-auto pt-6 text-[26px] font-bold text-muted-foreground">Fuente: {s.source}</p>
          </div>
        ))}
      </div>
      <p className="mt-12 text-[38px] font-bold text-muted-foreground">La clase es igual para todos y el tutor privado es caro.</p>
    </Frame>
  ),
};

const slideUser: DeckSlide = {
  title: "Para quién",
  notes: "Usuario específico: alumno de secundaria peruano, de 1º a 5º. Dos perfiles que se necesitan entre sí: el que va atrasado y el que sabe y se aburre. Un mismo alumno puede ser ambos.",
  content: (
    <Frame kicker="Para quién" title="Un alumno de secundaria peruano">
      <div className="grid grid-cols-2 gap-10">
        <div className="rounded-[40px] bg-secondary p-12">
          <p className="text-[64px]" aria-hidden>📉</p>
          <h3 className="font-heading text-[52px] font-semibold">El que va atrasado</h3>
          <p className="mt-4 text-[36px] leading-snug">No entiende y no tiene a quién recurrir. En casa muchas veces nadie puede ayudarlo.</p>
        </div>
        <div className="rounded-[40px] bg-gold/20 p-12 ring-2 ring-gold/50">
          <p className="text-[64px]" aria-hidden>🚀</p>
          <h3 className="font-heading text-[52px] font-semibold">El que sabe y se aburre</h3>
          <p className="mt-4 text-[36px] leading-snug">No tiene reto ni reconocimiento, y lo que sabe no ayuda a nadie.</p>
        </div>
      </div>
      <p className="mt-10 text-[38px] font-bold">Se necesitan entre sí: AulaQuipu los junta.</p>
    </Frame>
  ),
};

function LoopDiagram() {
  return (
    <svg viewBox="0 0 1500 520" className="mx-auto h-[560px] w-full" role="img" aria-label="Bucle: el que enseña gana quipus, el que aprende los paga y mejora, y vuelve a poder enseñar">
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0L10 5L0 10z" fill="var(--primary)" />
        </marker>
      </defs>
      <rect x="20" y="150" width="520" height="220" rx="44" fill="var(--mint)" />
      <text x="280" y="240" textAnchor="middle" fontSize="56" fontWeight="800" fill="var(--navy)">Enseñar</text>
      <text x="280" y="300" textAnchor="middle" fontSize="32" fontWeight="700" fill="var(--navy)">declaras lo que sabes</text>
      <text x="280" y="340" textAnchor="middle" fontSize="32" fontWeight="700" fill="var(--navy)">y te contratan</text>
      <rect x="960" y="150" width="520" height="220" rx="44" fill="var(--primary)" />
      <text x="1220" y="240" textAnchor="middle" fontSize="56" fontWeight="800" fill="#fff">Aprender</text>
      <text x="1220" y="300" textAnchor="middle" fontSize="32" fontWeight="700" fill="#fff">pides ayuda y</text>
      <text x="1220" y="340" textAnchor="middle" fontSize="32" fontWeight="700" fill="#fff">pagas la clase</text>
      <path d="M960 215 C 850 90, 650 90, 540 215" fill="none" stroke="var(--primary)" strokeWidth="8" markerEnd="url(#arrow)" />
      <text x="750" y="70" textAnchor="middle" fontSize="36" fontWeight="800" fill="var(--navy)">pagas quipus al tutor</text>
      <path d="M540 310 C 650 440, 850 440, 960 310" fill="none" stroke="var(--primary)" strokeWidth="8" markerEnd="url(#arrow)" />
      <text x="750" y="500" textAnchor="middle" fontSize="36" fontWeight="800" fill="var(--navy)">recibes saber y mejoras</text>
      <circle cx="750" cy="260" r="62" fill="var(--gold)" />
      <text x="750" y="258" textAnchor="middle" fontSize="40" fontWeight="800" fill="var(--gold-foreground)">100</text>
      <text x="750" y="294" textAnchor="middle" fontSize="24" fontWeight="800" fill="var(--gold-foreground)">quipus</text>
    </svg>
  );
}

const slideLoop: DeckSlide = {
  title: "La solución",
  notes: "Explica el bucle: empiezas con 100 quipus. Si quieres aprender, pagas una clase. Si quieres ganar, enseñas. Vuelves por una de las dos razones. El quipu es dinero de juego, nunca sale del sistema.",
  content: (
    <Frame kicker="La solución" title="Enseñar ⇄ aprender, con quipus">
      <LoopDiagram />
      <p className="mt-4 text-center text-[36px] font-bold">Todos aprenden a manejar dinero sin arriesgar dinero real.</p>
    </Frame>
  ),
};

const DEMO_STEPS = [
  "Entrar con una cuenta de prueba",
  "Caminar por el campus",
  "Pedir ayuda en un tema",
  "Entrar a clase con un tutor IA",
  "Decir “grafica y = x²” y ver la curva",
  "Responder el quiz en Actividad",
  "Terminar y leer el resumen",
  "Abrir el panel admin con métricas",
];

const slideDemo: DeckSlide = {
  title: "Demo en vivo",
  notes: "Sigue el guion en orden. Si LiveKit falla, usa el modo local. Cuenta de prueba: elige una del panel de cuentas de la pantalla de entrada. En el panel admin muestra usuarios, clases y quipus en circulación.",
  content: (
    <Frame kicker="Demo en vivo" title="Guion de 5 minutos">
      <ol className="grid grid-cols-2 gap-x-14 gap-y-5">
        {DEMO_STEPS.map((t, i) => (
          <li key={t} className="flex items-center gap-6 rounded-[32px] bg-card px-8 py-5 ring-2 ring-border">
            <span className="grid size-[72px] shrink-0 place-items-center rounded-3xl bg-primary font-heading text-[40px] font-semibold text-primary-foreground">{i + 1}</span>
            <span className="text-[36px] leading-snug font-bold">{t}</span>
          </li>
        ))}
      </ol>
    </Frame>
  ),
};

function Box({ x, y, w = 300, h = 110, title, sub, tone }: { x: number; y: number; w?: number; h?: number; title: string; sub: string; tone: "primary" | "mint" | "gold" | "navy" }) {
  const fill = { primary: "var(--primary)", mint: "var(--mint)", gold: "var(--gold)", navy: "var(--navy)" }[tone];
  const text = tone === "primary" || tone === "navy" ? "#fff" : "var(--navy)";
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx="28" fill={fill} />
      <text x={x + w / 2} y={y + 48} textAnchor="middle" fontSize="30" fontWeight="800" fill={text}>
        {title}
      </text>
      <text x={x + w / 2} y={y + 84} textAnchor="middle" fontSize="22" fontWeight="700" fill={text} opacity="0.85">
        {sub}
      </text>
    </g>
  );
}

function ArchitectureDiagram() {
  const line = { stroke: "var(--navy)", strokeWidth: 5, fill: "none", markerStart: "url(#a2)", markerEnd: "url(#a2)" } as const;
  return (
    <svg viewBox="0 0 1700 640" className="mx-auto h-[700px] w-full" role="img" aria-label="Arquitectura: navegador, API de Next.js, Supabase, LiveKit, agente de voz, director de clase y memoria">
      <defs>
        <marker id="a2" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M0 0L10 5L0 10z" fill="var(--navy)" />
        </marker>
      </defs>
      <Box x={40} y={250} title="Navegador" sub="Next.js · React" tone="mint" />
      <Box x={470} y={60} title="API de Next.js" sub="validación · ledger" tone="primary" />
      <Box x={950} y={60} title="Supabase" sub="Postgres · RLS" tone="navy" />
      <Box x={950} y={250} title="Director de clase" sub="modelo de texto" tone="gold" />
      <Box x={470} y={440} title="LiveKit" sub="sala en vivo" tone="primary" />
      <Box x={950} y={440} title="Agente de voz" sub="GPT-Live" tone="navy" />
      <Box x={1380} y={250} title="Acciones" sub="Desmos · Actividad · Doc" tone="mint" w={300} />
      <Box x={1380} y={440} title="AtomicMemory" sub="memoria de clases" tone="gold" />
      <path d="M340 290 H405 V115 H470" {...line} markerStart="none" />
      <path d="M770 115 H950" {...line} />
      <path d="M620 170 V305 H950" {...line} markerStart="none" />
      <path d="M340 320 H405 V495 H470" {...line} />
      <path d="M770 495 H950" {...line} />
      <path d="M1250 305 H1380" {...line} markerStart="none" />
      <path d="M1250 495 H1380" {...line} />
      <text x="850" y="610" textAnchor="middle" fontSize="26" fontWeight="700" fill="var(--muted-foreground)">
        Las acciones del director llegan al aula por el canal de datos de LiveKit.
      </text>
    </svg>
  );
}

const slideArch: DeckSlide = {
  title: "Arquitectura",
  notes: "Camino de una clase IA: el navegador entra a una sala de LiveKit donde está el agente de voz con GPT-Live. En paralelo, el director de clase (un modelo de texto, llamado desde la API) decide acciones deterministas: graficar, abrir un quiz o escribir en el documento. La API habla con Supabase. AtomicMemory aún no está activa.",
  content: (
    <Frame kicker="Arquitectura" title="Voz en vivo + director que actúa">
      <ArchitectureDiagram />
    </Frame>
  ),
};

const QUALITY = [
  ["Validación en servidor", "Toda mutación se valida en la API; la interfaz no es la barrera."],
  ["RLS y service role", "Las tablas tienen RLS; la clave de servicio nunca llega al navegador."],
  ["Ledger auditable", "El saldo se deriva del ledger y no es un número editable."],
  ["Auditoría admin", "Cada acción de administración deja una fila de auditoría."],
  ["Límites de uso", "Intentos de login, reportes y llamadas al director tienen límite."],
  ["Clave del quiz en servidor", "El alumno nunca recibe la respuesta correcta antes de contestar."],
  ["Imágenes solo de hosts permitidos", "Los documentos muestran imágenes únicamente de orígenes de confianza."],
];

const slideQuality: DeckSlide = {
  title: "Calidad técnica y seguridad",
  notes: "El público son menores, así que la seguridad es parte del producto. Destaca el ledger (saldo derivado), que la clave del quiz vive en el servidor y que ninguna acción admin queda sin auditar.",
  content: (
    <Frame kicker="Calidad técnica" title="Seguridad pensada para menores">
      <ul className="grid grid-cols-2 gap-x-10 gap-y-6">
        {QUALITY.map(([t, d]) => (
          <li key={t} className="rounded-[32px] bg-card px-8 py-6 ring-2 ring-border">
            <p className="font-heading text-[40px] font-semibold text-primary">{t}</p>
            <p className="mt-1 text-[30px] leading-snug">{d}</p>
          </li>
        ))}
      </ul>
    </Frame>
  ),
};

const slideImpact: DeckSlide = {
  title: "Impacto y tracción",
  notes: "COMPLETAR antes de presentar con cifras reales del panel admin. No presentes números que no estén en el panel. Si aún no hay datos, di qué medirías y por qué.",
  content: (
    <Frame kicker="Impacto y tracción" title="Qué mediremos">
      <div className="grid grid-cols-4 gap-8">
        {["Usuarios registrados", "Clases completadas", "Quipus en circulación", "Alumnos que enseñan y aprenden"].map((l) => (
          <div key={l} className="rounded-[36px] border-4 border-dashed border-coral/70 bg-card p-8">
            <p className="font-heading text-[80px] leading-none font-semibold text-coral">[ ? ]</p>
            <p className="mt-4 text-[32px] font-bold">{l}</p>
            <p className="mt-2 text-[24px] font-bold text-coral">Pendiente: completar con el panel admin</p>
          </div>
        ))}
      </div>
      <ul className="mt-10 space-y-3 text-[34px] font-bold">
        <li>Retención al día siguiente: ¿vuelven a ganar o a aprender?</li>
        <li>Avance real: quiz y resumen de cada clase, antes y después.</li>
        <li>Equilibrio de la economía: quipus que entran frente a los que se gastan.</li>
      </ul>
    </Frame>
  ),
};

const slideScope: DeckSlide = {
  title: "Qué quedó fuera",
  notes: "Claridad: decidimos qué no hacer. Lo de la derecha es lo que sigue y es honesto: la memoria de clases está integrada en el agente pero no activa; primaria requiere consentimiento de padres.",
  content: (
    <Frame kicker="Alcance" title="Qué quedó fuera y qué sigue">
      <div className="grid grid-cols-2 gap-12">
        <div>
          <h3 className="mb-4 font-heading text-[44px] font-semibold">Fuera, por decisión</h3>
          <ul className="space-y-3">
            {NOT_DONE.map((n) => (
              <li key={n.title} className="text-[32px] leading-snug">
                <span className="font-extrabold">{n.title}.</span> <span className="text-muted-foreground">{n.text}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="mb-4 font-heading text-[44px] font-semibold">En progreso</h3>
          <ul className="space-y-4">
            {IN_PROGRESS.map((n) => (
              <li key={n.title} className="rounded-[28px] bg-secondary p-6 text-[32px] leading-snug">
                <span className="font-extrabold">{n.title}.</span> {n.text}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Frame>
  ),
};

const slideThanks: DeckSlide = {
  title: "Gracias",
  notes: "Cierra con la frase y deja esta pantalla para preguntas. Recuerda completar la URL pública.",
  content: (
    <div className="hero-sky flex h-full flex-col justify-between px-[120px] py-[100px] text-white">
      <Logo light className="origin-left scale-[2] text-[28px]" />
      <div>
        <h2 className="font-heading text-[104px] leading-[1.02] font-semibold">
          Gracias. <span className="text-mint">¿Preguntas?</span>
        </h2>
        <dl className="mt-14 space-y-5 text-[40px]">
          <div className="flex gap-6">
            <dt className="w-[220px] font-extrabold text-gold">Pruébalo</dt>
            <dd className={cn("font-bold")}>
              <Placeholder>{PUBLIC_URL_LABEL}</Placeholder>
            </dd>
          </div>
          <div className="flex gap-6">
            <dt className="w-[220px] font-extrabold text-gold">Código</dt>
            <dd className="font-mono font-bold">{REPO_URL.replace("https://", "")}</dd>
          </div>
          <div className="flex gap-6">
            <dt className="w-[220px] font-extrabold text-gold">Más info</dt>
            <dd className="font-mono font-bold">/info</dd>
          </div>
        </dl>
      </div>
      <p className="text-[32px] font-bold text-white/70">El que sabe enseña y gana. El que aprende paga y mejora.</p>
    </div>
  ),
};

export const SLIDES: DeckSlide[] = [slideTitle, slideProblem, slideUser, slideLoop, slideDemo, slideArch, slideQuality, slideImpact, slideScope, slideThanks];
