"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, GraduationCap, LayoutDashboard, HelpCircle, LogOut, ShieldCheck, User, X } from "lucide-react";
import { api, API_MODE } from "@/lib/api";
import { AI_SPOTS, STUDENT_SPOTS, TUTOR_SPOTS, type Room } from "@/lib/campus/map";
import { useQuery, useSession } from "@/components/providers";
import { Avatar } from "@/components/avatar";
import { Quipus } from "@/components/bits";
import { Logo } from "@/components/logo";
import { MissionCard, WelcomeOverlay, useFlag, writeFlag } from "@/components/campus/welcome";
import { CampusWorld, type CampusPerson, type Interactable } from "@/components/campus/world";
import { ChatPanel } from "@/components/campus/chat-panel";
import { useCampusChat } from "@/lib/campus/use-campus-chat";
import { useCampusPresence } from "@/lib/campus/use-campus-presence";
import { cn } from "@/lib/utils";

const BAR = [
  { href: "/home", label: "Tablero", icon: LayoutDashboard },
  { href: "/aprender", label: "Aprender", icon: BookOpen },
  { href: "/ensenar", label: "Enseñar", icon: GraduationCap },
  { href: "/perfil", label: "Perfil", icon: User },
];

/** Shell estilo gather: el campus 2D siempre de fondo y cada pantalla se abre como panel encima. */
export function CampusShell({ children }: { children: React.ReactNode }) {
  const { userId, ready, me, selectUser } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const panelOpen = pathname !== "/campus";
  const interactRef = useRef<(() => void) | null>(null);
  const bubbleRef = useRef<((id: string, text: string) => void) | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [banner, setBanner] = useState<Room | null>(null);
  const [near, setNear] = useState<Interactable | null>(null);
  const [menu, setMenu] = useState(false);
  const presence = useCampusPresence(ready && me ? userId : null);
  const showBubble = useCallback((id: string, text: string) => bubbleRef.current?.(id, text), []);
  const chat = useCampusChat(ready && me ? userId : null, presence, showBubble);
  const [welcomeOpen, setWelcomeOpen] = useState(false);
  const [moved, setMoved] = useState(false);
  const startPos = useRef<{ x: number; y: number } | null>(null);
  const welcomeKey = `aq:welcome:${userId}`;
  const missionKey = `aq:mission:${userId}`;
  const welcomeSeen = useFlag(welcomeKey);
  const missionSeen = useFlag(missionKey);
  // Primera visita: bienvenida automática; el botón "?" la reabre cuando quiera
  const welcome = welcomeOpen || welcomeSeen === false;
  const missionHidden = missionSeen !== false;

  const closeWelcome = useCallback(() => {
    writeFlag(welcomeKey);
    setWelcomeOpen(false);
  }, [welcomeKey]);
  const hideMission = useCallback(() => writeFlag(missionKey), [missionKey]);

  // Sin pedidos, clases ni temas declarados: aún no hizo nada en la plataforma
  const fresh = useQuery(async (u) => {
    const [reqs, panel, upcoming] = await Promise.all([api.myRequests(u), api.tutorPanel(u), api.myUpcoming(u)]);
    return reqs.length === 0 && panel.topics.length === 0 && upcoming.length === 0;
  });
  const showMission = !!fresh.data && !missionHidden && !welcome;

  useEffect(() => {
    if (ready && !userId) router.replace("/");
  }, [ready, userId, router]);

  const crowd = useQuery(async (u) => {
    const users = await api.listDemoUsers();
    const others = await Promise.all(users.filter((x) => x.id !== u).map((x) => api.tutorProfile(x.id)));
    const ais = await api.listAiTutors();
    const upcoming = await api.myUpcoming(u);
    return { others, ais, live: upcoming.some((c) => c.liveSessionId) };
  });

  const people = useMemo<CampusPerson[]>(() => {
    if (!crowd.data) return [];
    // Quienes enseñan van a la sala de tutores; el resto se reparte por el campus
    const teachers = crowd.data.others.filter((p) => p.topics.length > 0);
    const learners = crowd.data.others.filter((p) => p.topics.length === 0);
    const placed = [
      ...teachers.slice(0, TUTOR_SPOTS.length).map((p, i) => ({ p, spot: TUTOR_SPOTS[i] })),
      ...[...teachers.slice(TUTOR_SPOTS.length), ...learners]
        .slice(0, STUDENT_SPOTS.length)
        .map((p, i) => ({ p, spot: STUDENT_SPOTS[i] })),
    ];
    const students: CampusPerson[] = placed.map(({ p, spot }) => {
      const first = p.profile.display_name.split(" ")[0];
      const teaches = p.topics.length > 0;
      return {
        id: p.profile.id,
        ...spot,
        name: first,
        caption: teaches
          ? `Tutor · ★ ${p.stats.estrellas_promedio ? p.stats.estrellas_promedio.toFixed(1) : "nuevo"}`
          : `${p.profile.grade}º de secundaria`,
        href: `/tutor/${p.profile.id}`,
        prompt: `Ver el perfil de ${first}`,
        avatar: p.profile.avatar_config,
        equipped: p.equipped,
      };
    });
    const ais: CampusPerson[] = crowd.data.ais.slice(0, AI_SPOTS.length).map((a, i) => ({
      id: a.id,
      ...AI_SPOTS[i],
      name: a.name,
      caption: `Tutor IA · ${a.price_quipus} quipus`,
      href: `/tutores-ia?t=${a.id}`,
      prompt: `Tomar clase con ${a.name}`,
      ai: { emoji: a.persona.emoji, color: a.persona.color },
    }));
    // Quien está conectado camina en vivo: no se muestra además en su lugar fijo
    const live = new Set(presence.peers.map((p) => p.id));
    return [...students.filter((s) => !live.has(s.id)), ...ais];
  }, [crowd.data, presence.peers]);

  const reportPosition = presence.reportPosition;
  const onMove = useCallback(
    (pos: Parameters<typeof reportPosition>[0]) => {
      reportPosition(pos);
      if (!startPos.current) startPos.current = { x: pos.x, y: pos.y };
      else if (Math.hypot(pos.x - startPos.current.x, pos.y - startPos.current.y) > 1) setMoved(true);
    },
    [reportPosition],
  );

  const open = useCallback((href: string) => router.push(href), [router]);
  const close = useCallback(() => router.push("/campus"), [router]);

  const onRoomChange = useCallback((r: Room | null) => {
    setRoom(r);
    if (r) setBanner(r);
  }, []);

  useEffect(() => {
    if (!banner) return;
    const t = setTimeout(() => setBanner(null), 2200);
    return () => clearTimeout(t);
  }, [banner]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Escape mientras se escribe (p. ej. en el chat) solo sale del campo
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName))) return;
      if (e.key === "Escape" && panelOpen) close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [panelOpen, close]);

  if (!ready || !userId || !me)
    return (
      <div className="room-floor grid min-h-dvh place-items-center text-white">
        <p className="animate-pulse font-heading text-xl">Entrando al campus…</p>
      </div>
    );

  return (
    <div className="fixed inset-0 overflow-hidden">
      <CampusWorld
        me={{ name: me.profile.display_name.split(" ")[0], avatar: me.profile.avatar_config, equipped: me.equipped }}
        people={people}
        peers={presence.peers}
        peerPositions={presence.positions}
        onMove={onMove}
        liveClass={!!crowd.data?.live}
        onOpen={open}
        onRoomChange={onRoomChange}
        onNearChange={setNear}
        interactRef={interactRef}
        bubbleRef={bubbleRef}
      />

      {/* HUD superior */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-[60] flex items-start justify-between gap-2 p-3">
        <div className="pointer-events-auto flex items-center gap-2 rounded-2xl bg-navy/90 px-3 py-2 shadow-lg backdrop-blur">
          <Link href="/campus" aria-label="Ir al campus">
            <Logo light className="text-base" />
          </Link>
          {room && (
            <span className="hidden rounded-full bg-navy-3 px-2.5 py-1 text-xs font-bold text-white sm:inline">
              {room.emoji} {room.name}
            </span>
          )}
          {presence.online && (
            <span
              className="flex items-center gap-1.5 rounded-full bg-navy-3 px-2.5 py-1 text-xs font-bold text-white"
              title={presence.peers.length ? presence.peers.map((p) => p.name).join(", ") : "Solo tú por ahora"}
            >
              <span className="size-2 rounded-full bg-mint" />
              {presence.peers.length + 1} en línea
            </span>
          )}
        </div>
        <div className="pointer-events-auto relative flex items-center gap-2 rounded-2xl bg-navy/90 py-1.5 pr-1.5 pl-3 shadow-lg backdrop-blur">
          <Link href="/quipus" className="text-gold" aria-label={`${me.balance} quipus, ver historial`}>
            <Quipus amount={me.balance} className="text-base" />
          </Link>
          <button onClick={() => setWelcomeOpen(true)} aria-label="Ver la guía de bienvenida" title="¿Cómo funciona?" className="rounded-full p-1 text-white/80 hover:text-white">
            <HelpCircle className="size-6" />
          </button>
          <button onClick={() => setMenu((m) => !m)} aria-label="Mi cuenta" aria-expanded={menu} className="rounded-full">
            <Avatar config={me.profile.avatar_config} equipped={me.equipped} size={34} label={me.profile.display_name} />
          </button>
          {menu && (
            <div className="absolute top-full right-0 mt-2 w-56 overflow-hidden rounded-2xl bg-card text-foreground shadow-xl ring-1 ring-border">
              <p className="border-b border-border px-4 py-3 text-sm font-extrabold">
                {me.profile.display_name}
                <span className="block text-xs font-semibold text-muted-foreground">
                  {me.profile.grade}º · {me.profile.school}
                </span>
              </p>
              <Link href="/perfil" onClick={() => setMenu(false)} className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold hover:bg-muted">
                <User className="size-4" /> Mi perfil
              </Link>
              {me.is_admin && (
                <Link href="/admin" onClick={() => setMenu(false)} className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold hover:bg-muted">
                  <ShieldCheck className="size-4" /> Admin
                </Link>
              )}
              <button
                onClick={async () => {
                  setMenu(false);
                  await api.logout().catch(() => {});
                  selectUser(null);
                  router.push("/");
                }}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-sm font-bold text-destructive hover:bg-muted"
              >
                <LogOut className="size-4" /> Cerrar sesión
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Cartel al entrar a una sala */}
      {banner && !panelOpen && (
        <div key={banner.id} className={cn("pointer-events-none absolute inset-x-0 z-[55] flex justify-center px-4", showMission ? "top-44 sm:top-20" : "top-20")}>
          <div className="rounded-2xl bg-white/95 px-5 py-2.5 text-center shadow-xl animate-in fade-in slide-in-from-top-2">
            <p className="font-heading text-lg font-semibold text-navy">
              {banner.emoji} {banner.name}
            </p>
            {banner.subtitle && <p className="text-xs font-bold text-muted-foreground">{banner.subtitle}</p>}
          </div>
        </div>
      )}

      {/* Misión inicial */}
      {showMission && !panelOpen && (
        <div className="pointer-events-none absolute inset-x-0 top-[4.5rem] z-[54] flex px-3 sm:justify-start">
          <MissionCard onDismiss={hideMission} className="w-full sm:max-w-xs" />
        </div>
      )}

      {/* Acción disponible cerca */}
      {near && !panelOpen && (
        <div className="absolute inset-x-0 bottom-24 z-[55] flex justify-center px-4">
          <button
            onClick={() => interactRef.current?.()}
            className="flex items-center gap-2 rounded-2xl bg-gold py-2 pr-4 pl-2 font-extrabold text-gold-foreground shadow-[0_4px_0_0_oklch(0.7_0.15_80)] animate-in fade-in slide-in-from-bottom-2"
          >
            <kbd className="hidden rounded-lg bg-white/70 px-2 py-0.5 font-mono text-sm sm:inline">X</kbd>
            {near.prompt}
          </button>
        </div>
      )}

      {!panelOpen && !welcome && <ChatPanel chat={chat} />}

      {/* Barra inferior */}
      <nav className="absolute inset-x-0 bottom-3 z-[55] flex justify-center px-3">
        <div className="flex w-full max-w-full justify-center gap-1 sm:w-auto rounded-2xl bg-navy/90 p-1.5 shadow-xl backdrop-blur">
          {BAR.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-xl px-2 py-2 text-xs leading-tight font-bold whitespace-nowrap transition-colors sm:min-w-20 sm:flex-none sm:px-4 sm:text-sm",
                pathname === href ? "bg-mint text-navy" : "text-white/75 hover:bg-navy-3 hover:text-white",
              )}
            >
              <Icon className="size-5 shrink-0" />
              {label}
            </Link>
          ))}
        </div>
      </nav>

      {!panelOpen && !moved && !near && !welcome && (
        <p className="pointer-events-none absolute inset-x-0 bottom-24 z-[50] mx-auto w-fit max-w-[90%] rounded-xl bg-navy/80 px-3 py-2 text-center text-xs font-semibold text-white lg:hidden">
          Toca el mapa para caminar · acércate a un objeto y toca el botón
        </p>
      )}

      {welcome && <WelcomeOverlay balance={me.balance} onClose={closeWelcome} />}

      {!panelOpen && (
        <p className="pointer-events-none absolute bottom-24 left-4 z-[50] hidden rounded-xl bg-navy/70 px-3 py-2 text-[11px] font-semibold text-white/80 lg:block">
          ← ↑ → ↓ o WASD para moverte · clic en el mapa para caminar · X para interactuar
          {API_MODE === "mock" && <span className="block text-white/50">Modo demo: datos ficticios en este navegador</span>}
        </p>
      )}

      {/* Panel con la pantalla abierta */}
      {panelOpen && (
        <>
          <button aria-label="Cerrar panel" onClick={close} className="absolute inset-0 z-[65] bg-navy/25 md:bg-transparent" />
          <aside
            data-panel
            className="@container absolute inset-x-0 bottom-0 z-[70] flex h-[88dvh] flex-col overflow-hidden rounded-t-[1.75rem] bg-background shadow-2xl animate-in slide-in-from-bottom-8 md:inset-y-3 md:right-3 md:left-auto md:h-auto md:w-[min(720px,calc(100%-24px))] md:rounded-[1.75rem] md:slide-in-from-right-8"
          >
            <button
              onClick={close}
              aria-label="Cerrar y volver al campus"
              className="absolute top-3 right-3 z-10 grid size-9 place-items-center rounded-full bg-card shadow ring-1 ring-border hover:bg-muted"
            >
              <X className="size-4" />
            </button>
            <div className="flex-1 overflow-y-auto px-4 pt-5 pb-10 @xl:px-7 @xl:pt-7">{children}</div>
          </aside>
        </>
      )}
    </div>
  );
}
