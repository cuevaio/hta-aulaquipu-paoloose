"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye, EyeOff, FlaskConical, IdCard, Lock, RotateCcw } from "lucide-react";
import { api, ApiError, API_MODE, type TestAccount } from "@/lib/api";
import { useSession, useToast } from "@/components/providers";
import { Avatar, AiAvatar } from "@/components/avatar";
import { Logo } from "@/components/logo";
import { QuipuIcon, btn } from "@/components/bits";
import { cn } from "@/lib/utils";

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
        <Logo light />
        <div className="my-10 lg:my-auto">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-mint">
            <QuipuIcon /> Dinero de juego, aprendizaje de verdad
          </p>
          <h1 className="font-heading text-4xl leading-[1.05] font-semibold md:text-5xl">
            El que sabe <span className="text-mint">enseña y gana.</span>
            <br />
            El que aprende <span className="text-gold">paga y mejora.</span>
          </h1>
          <p className="mt-4 max-w-md text-white/75">
            Camina por el campus, entra a la biblioteca a pedir ayuda, a la sala de tutores a enseñar o a un aula IA cuando quieras.
          </p>
        </div>

        <div className="relative mx-auto hidden h-64 w-full max-w-md lg:block" aria-hidden>
          <div className="room-floor absolute inset-0 rounded-[2rem] ring-4 ring-white/10" />
          <div className="absolute top-5 left-5 rounded-xl bg-[#ecd2ae] px-3 py-2 text-xs font-extrabold text-navy shadow-[inset_0_-4px_0_#c9a57a]">📚 Biblioteca</div>
          <div className="absolute top-5 right-5 rounded-xl bg-[#cdf3e5] px-3 py-2 text-xs font-extrabold text-navy shadow-[inset_0_-4px_0_#a5dcc6]">🎓 Sala de profesores</div>
          <div className="absolute bottom-5 left-1/2 -translate-x-1/2 rounded-xl bg-[#e3ddff] px-3 py-2 text-xs font-extrabold text-navy shadow-[inset_0_-4px_0_#c1b8f0]">✨ Laboratorio IA</div>
          <div className="float absolute top-20 left-16">
            <Avatar config={{ color: "#7C6BF2" }} equipped={{ avatar: { id: "", name: "", kind: "avatar", price_quipus: 0, meta: { accessory: "chullo" } } }} size={52} />
          </div>
          <div className="float absolute top-24 right-20 [animation-delay:.5s]">
            <Avatar config={{ color: "#2FD3A3", shape: "round" }} size={46} />
          </div>
          <div className="float absolute bottom-16 left-24 [animation-delay:1s]">
            <AiAvatar emoji="🦙" color="#FF8A65" size={46} />
          </div>
          <div className="float absolute right-28 bottom-14 [animation-delay:.2s]">
            <Avatar config={{ color: "#FFC94D", shape: "bean" }} size={42} />
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
        </div>
      </section>
    </div>
  );
}
