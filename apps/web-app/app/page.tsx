"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye, EyeOff, FlaskConical, IdCard, Lock, RotateCcw } from "lucide-react";
import { api, ApiError, API_MODE, type TestAccount } from "@/lib/api";
import { useSession, useToast } from "@/components/providers";
import { Avatar } from "@/components/avatar";
import { GuideSprite } from "@/components/campus/guide-dialog";
import { furniSrc, type FurniId } from "@/lib/campus/furni";
import { KILLA } from "@/lib/campus/guides";
import { Logo } from "@/components/logo";
import { QuipuIcon, btn } from "@/components/bits";
import { resetWelcome } from "@/components/campus/welcome";
import { teacherAvatar } from "@/lib/campus/teacher-avatars";
import type { AvatarConfig } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Estudiantes del demo (seed) armados con piezas del creador de avatar. */
const withSlots = (id: string, color: string, extra: Record<string, string>): AvatarConfig => {
  const base = teacherAvatar(id, color);
  return { ...base, slots: { ...base.slots, ...extra } };
};

const HERO_FIGURES = [
  { id: "Valeria", config: withSlots("usr-valeria", "#7C6BF2", { ha: "hat_U_camocap" }), pose: { action: "wav", frame: 0 }, direction: 2, className: "top-[22%] left-[20%]", delay: "0s" },
  { id: "Diego", config: withSlots("usr-diego", "#ED5C50", { ca: "acc_chest_U_backpack" }), pose: { action: "std", frame: 0 }, direction: 3, className: "top-[25%] right-[14%]", delay: ".5s" },
  { id: "Camila", config: withSlots("usr-camila", "#E7B027", { ea: "acc_eye_U_brownglasses" }), pose: { action: "spk", frame: 0 }, direction: 2, className: "bottom-[10%] left-[40%]", delay: ".2s" },
] as const;

// Pisos del campus (components/campus/world.tsx FLOOR_COLORS): ajedrezado de dos tonos
const FLOORS = {
  b: ["#ecd2ae", "#e5c8a1"],
  q: ["#fff0c4", "#fbe7b0"],
  i: ["#e3ddff", "#d9d2fb"],
} as const;

function Room({ floor, label, className, children }: { floor: readonly [string, string]; label: string; className?: string; children?: React.ReactNode }) {
  return (
    <div
      className={cn("relative overflow-hidden rounded-xl shadow-[inset_0_6px_0_rgba(43,37,80,.35)]", className)}
      style={{ backgroundColor: floor[0], backgroundImage: `repeating-conic-gradient(${floor[1]} 0 25%, transparent 0 50%)`, backgroundSize: "28px 28px" }}
    >
      <span className="absolute top-1.5 left-2 z-10 rounded-full bg-[#15142c]/85 px-2 py-0.5 text-[10px] font-extrabold whitespace-nowrap text-cream">{label}</span>
      {children}
    </div>
  );
}

function Furni({ id, className }: { id: FurniId; className: string }) {
  // eslint-disable-next-line @next/next/no-img-element -- sprite pixel art, sin optimizar
  return <img src={furniSrc(id)} alt="" className={cn("absolute w-auto [image-rendering:pixelated]", className)} />;
}

export default function LoginPage() {
  const router = useRouter();
  const { selectUser, userId, me, invalidate } = useSession();
  const toast = useToast();
  const [dni, setDni] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [accounts, setAccounts] = useState<TestAccount[] | null>(null);

  useEffect(() => {
    api.testAccounts().then(setAccounts).catch(() => setAccounts([]));
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!/^\d{8}$/.test(dni)) return setError("Ingresa tu DNI de 8 dígitos.");
    if (!password) return setError("Ingresa tu contraseña.");
    setPending(true);
    try {
      const { userId } = await api.login(dni, password);
      selectUser(userId);
      resetWelcome(userId);
      // Next conserva esta página oculta al navegar: se deja el formulario listo para el próximo login
      setPending(false);
      setPassword("");
      router.push("/campus");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No pudimos iniciar sesión. Intenta de nuevo.");
      setPending(false);
    }
  };

  return (
    <div className="grid min-h-dvh grid-cols-1 lg:grid-cols-[1.1fr_1fr]">
      {/* Lado ilustrado: un pedacito del campus */}
      <section className="hero-sky relative flex flex-col overflow-hidden px-6 py-6 text-white md:px-12 md:py-10">
        <Logo />
        <div className="my-10 lg:my-auto">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-aurum/15 px-3 py-1 text-xs font-bold text-aurum-hi ring-1 ring-aurum/40">
            <QuipuIcon /> Dinero de juego, aprendizaje de verdad
          </p>
          <h1 className="font-heading text-4xl leading-[1.05] font-semibold md:text-5xl">
            El que sabe <span className="text-aurum">enseña y gana.</span>
            <br />
            El que aprende <span className="text-cream">paga y mejora.</span>
          </h1>
          <p className="mt-4 max-w-md text-white/75">
            Camina por el campus, entra a la biblioteca a pedir ayuda, a la sala de tutores a enseñar o a un aula IA cuando quieras.
          </p>
        </div>

        {/* Un pedacito del campus de verdad: mismos pisos, muros y muebles que el mapa */}
        <div className="relative mx-auto mt-2 aspect-[4/3] w-full max-w-md overflow-hidden rounded-[1.75rem] bg-[#2b2550] p-2 shadow-2xl ring-1 ring-white/10" aria-hidden>
          <div className="grid h-full grid-cols-2 grid-rows-[1fr_1.1fr] gap-2">
            <Room floor={FLOORS.b} label="Biblioteca">
              <Furni id="uni_bookshelf" className="top-2 right-3 h-[58%]" />
              <Furni id="ducket_c25_plantpot" className="bottom-2 left-2 h-[36%]" />
            </Room>
            <Room floor={FLOORS.q} label="Sala de profesores">
              <Furni id="school_chalkboard" className="top-3 left-3 h-[44%]" />
            </Room>
            <Room floor={FLOORS.i} label="Laboratorio IA" className="col-span-2">
              <Furni id="school_c22_table" className="right-[30%] bottom-3 h-[34%]" />
              <Furni id="nft_h26_jungleplant1" className="right-2 bottom-2 h-[52%]" />
            </Room>
          </div>
          {HERO_FIGURES.map((f) => (
            <div key={f.id} className={cn("float absolute", f.className)} style={{ animationDelay: f.delay }}>
              <Avatar config={f.config} size={48} bare pose={f.pose} direction={f.direction} label={f.id} />
            </div>
          ))}
          {/* Tutora IA: Killa, la llama del campus */}
          <div className="float absolute bottom-[9%] left-[13%] flex flex-col items-center [animation-delay:1s]">
            <GuideSprite guide={KILLA} box={64} />
            <span className="-mt-1 rounded-full bg-[#15142c] px-2 py-0.5 text-[10px] font-black text-aurum ring-1 ring-aurum/60">IA · Killa</span>
          </div>
        </div>
      </section>

      {/* Formulario */}
      <section className="flex items-center justify-center px-4 py-10 md:px-10">
        <div className="w-full max-w-md space-y-6">
          {userId && me && (
            <button
              onClick={() => router.push("/campus")}
              className="flex w-full items-center gap-3 rounded-3xl bg-card p-3 text-left ring-1 ring-border transition-colors hover:ring-primary"
            >
              <Avatar config={me.profile.avatar_config} equipped={me.equipped} size={44} />
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-bold text-muted-foreground">Sesión abierta</span>
                <span className="block truncate font-extrabold">Continuar como {me.profile.display_name}</span>
              </span>
              <ArrowRight className="size-5 text-primary" />
            </button>
          )}

          <div>
            <h2 className="font-heading text-3xl font-semibold">Entra a tu campus</h2>
            <p className="text-muted-foreground">Usa tu DNI y tu contraseña.</p>
          </div>

          <form onSubmit={submit} className="space-y-4" noValidate>
            <div>
              <label htmlFor="dni" className="mb-1.5 block text-sm font-extrabold">
                DNI
              </label>
              <div className="flex items-center gap-2 rounded-2xl bg-card px-4 ring-1 ring-border focus-within:ring-4 focus-within:ring-ring/25">
                <IdCard className="size-5 text-muted-foreground" />
                <input
                  id="dni"
                  value={dni}
                  onChange={(e) => setDni(e.target.value.replace(/\D/g, "").slice(0, 8))}
                  inputMode="numeric"
                  autoComplete="username"
                  placeholder="12345678"
                  className="h-12 min-w-0 flex-1 bg-transparent font-mono text-lg font-bold tracking-widest outline-none placeholder:font-sans placeholder:font-medium placeholder:tracking-normal placeholder:text-muted-foreground/60"
                  aria-invalid={!!error}
                />
                <span className="text-xs font-bold text-muted-foreground tabular-nums">{dni.length}/8</span>
              </div>
            </div>
            <div>
              <label htmlFor="password" className="mb-1.5 block text-sm font-extrabold">
                Contraseña
              </label>
              <div className="flex items-center gap-2 rounded-2xl bg-card px-4 ring-1 ring-border focus-within:ring-4 focus-within:ring-ring/25">
                <Lock className="size-5 text-muted-foreground" />
                <input
                  id="password"
                  type={show ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="h-12 min-w-0 flex-1 bg-transparent font-bold outline-none placeholder:text-muted-foreground/60"
                  aria-invalid={!!error}
                />
                <button
                  type="button"
                  onClick={() => setShow((s) => !s)}
                  className="rounded-lg p-1 text-muted-foreground hover:text-foreground"
                  aria-label={show ? "Ocultar contraseña" : "Mostrar contraseña"}
                >
                  {show ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
                </button>
              </div>
            </div>
            {error && (
              <p role="alert" className="rounded-2xl bg-destructive/10 px-4 py-3 text-sm font-bold text-destructive">
                {error}
              </p>
            )}
            <button type="submit" disabled={pending} className={cn(btn.primary, btn.lg, "w-full")}>
              {pending ? "Entrando…" : "Entrar al campus"}
            </button>
          </form>

          {/* Cuentas de prueba (solo mientras no hay registro real) */}
          <div className="rounded-3xl bg-gold/15 p-4 ring-1 ring-gold/40">
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="flex items-center gap-1.5 text-sm font-extrabold text-gold-foreground">
                <FlaskConical className="size-4" /> Cuentas de prueba
              </p>
              {API_MODE === "mock" && (
                <button
                  onClick={async () => {
                    await api.resetDemo();
                    selectUser(null);
                    invalidate();
                    toast("Demo reiniciada", "success");
                  }}
                  className="flex items-center gap-1 text-xs font-bold text-gold-foreground/80 hover:underline"
                >
                  <RotateCcw className="size-3.5" /> Reiniciar demo
                </button>
              )}
            </div>
            <p className="mb-2 text-xs font-semibold text-gold-foreground/80">
              Toca una para llenar el formulario. Contraseña de todas: <code className="rounded bg-white/70 px-1 font-bold">{accounts?.[0]?.password ?? "…"}</code>
            </p>
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              {accounts?.map((a) => (
                <button
                  key={a.dni}
                  type="button"
                  onClick={() => {
                    setDni(a.dni);
                    setPassword(a.password);
                    setError(null);
                  }}
                  className={cn(
                    "flex items-center gap-2 rounded-2xl bg-white/70 p-2 text-left transition-colors hover:bg-white",
                    dni === a.dni && "ring-2 ring-primary",
                  )}
                >
                  <Avatar config={a.profile.avatar_config} size={32} label={a.profile.display_name} />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-extrabold text-foreground">{a.profile.display_name}</span>
                    <span className="block font-mono text-xs font-bold text-muted-foreground">{a.dni}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>

          <nav aria-label="Más información" className="flex justify-center gap-4 text-sm font-bold text-muted-foreground">
            <Link href="/info" className="hover:text-foreground hover:underline">
              Sobre AulaQuipu
            </Link>
            <Link href="/presentacion" className="hover:text-foreground hover:underline">
              Presentación
            </Link>
          </nav>
        </div>
      </section>
    </div>
  );
}
