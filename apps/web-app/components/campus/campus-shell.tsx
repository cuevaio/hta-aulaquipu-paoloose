"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, GraduationCap, LayoutDashboard, HelpCircle, LogOut, ShieldCheck, Shirt, User, X } from "lucide-react";
import { api, API_MODE } from "@/lib/api";
import { AI_SPOTS, CLASS_DOORS, type Room } from "@/lib/campus/map";
import { GUIDES, guideById, type Guide, type GuideTopic } from "@/lib/campus/guides";
import { GuideDialog, GuideSprite } from "@/components/campus/guide-dialog";
import { useQuery, useSession, useToast } from "@/components/providers";
import { Avatar } from "@/components/avatar";
import { Quipus, friendlyWhen } from "@/components/bits";
import { aiPrice } from "@/lib/pricing";
import { Logo } from "@/components/logo";
import { AvatarDialog, MissionCard, WelcomeOverlay, useFlag, writeFlag } from "@/components/campus/welcome";
import { CampusWorld, type CampusPerson, type ClassDoor, type Interactable } from "@/components/campus/world";
import { AnnouncementBanner } from "@/components/campus/announcement-banner";
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
  // Un clic rezagado (p. ej. el segundo de un doble clic en "Terminar" del aula) caería sobre el fondo
  // del panel recién abierto y lo cerraría: durante un instante tras abrirse, el fondo lo ignora.
  const panelOpenedAt = useRef(0);
  const interactRef = useRef<(() => void) | null>(null);
  const goToRef = useRef<((targetId: string | null, opts?: { trail?: boolean }) => void) | null>(null);
  const bubbleRef = useRef<((id: string, text: string) => void) | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [banner, setBanner] = useState<Room | null>(null);
  const [near, setNear] = useState<Interactable | null>(null);
  const [guideId, setGuideId] = useState<string | null>(null);
  const guide = guideId ? guideById(guideId) : undefined;
  // Mascota llevándote a un lugar (se muestra arriba mientras sigues las huellas)
  const [guiding, setGuiding] = useState<{ guide: Guide; topic: GuideTopic } | null>(null);
  const onTrailEnd = useCallback(() => setGuiding(null), []);
  // Las mascotas saludan la primera vez que pasas cerca
  const greeted = useRef(new Set<string>());
  const onNearChange = useCallback((t: Interactable | null) => {
    setNear(t);
    if (t && guideById(t.id) && !greeted.current.has(t.id)) {
      greeted.current.add(t.id);
      bubbleRef.current?.(t.id, "¡Hola! 👋 Háblame si necesitas ayuda");
    }
  }, []);
  const [menu, setMenu] = useState(false);
  const presence = useCampusPresence(ready && me ? userId : null);
  const showBubble = useCallback(
    (id: string, text: string) => bubbleRef.current?.(id, text),
    [],
  );
  const chat = useCampusChat(ready && me ? userId : null, presence, showBubble);
  const [welcomeOpen, setWelcomeOpen] = useState(false);
  const [avatarOpen, setAvatarOpen] = useState(false);
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
    const [reqs, panel, upcoming] = await Promise.all([
      api.myRequests(u),
      api.tutorPanel(u),
      api.myUpcoming(u),
    ]);
    return (
      reqs.length === 0 && panel.topics.length === 0 && upcoming.length === 0
    );
  });
  const showMission = !!fresh.data && !missionHidden && !welcome;

  useEffect(() => {
    if (ready && !userId) router.replace("/");
  }, [ready, userId, router]);

  const crowd = useQuery(async (u) => {
    const [ais, upcoming] = await Promise.all([
      api.listAiTutors(u),
      api.myUpcoming(u),
    ]);
    return { ais, upcoming };
  });

  // Cada clase del alumno es una puerta del pasillo (la 5ª muestra "+N más" si hay muchas)
  const doors = useMemo<ClassDoor[]>(() => {
    const list = crowd.data?.upcoming ?? [];
    const shown =
      list.length > CLASS_DOORS.length
        ? list.slice(0, CLASS_DOORS.length - 1)
        : list;
    const out: ClassDoor[] = shown.map((c) => {
      const live = !!c.liveSessionId;
      const who =
        c.role === "tutor"
          ? "Enseñas tú"
          : c.tutor
            ? `con ${c.tutor.display_name.split(" ")[0]}`
            : "";
      return {
        title: c.topic.name,
        subtitle: live
          ? who || "En vivo"
          : `${friendlyWhen(c.group.scheduled_at)}${who ? ` · ${who}` : ""}`,
        live,
        href: live ? `/aula/${c.liveSessionId}` : `class:${c.group.id}`,
        prompt: live
          ? `Entrar a ${c.topic.name} (en vivo)`
          : `Entrar a tu clase de ${c.topic.name}`,
      };
    });
    if (list.length > CLASS_DOORS.length)
      out.push({
        title: `+${list.length - shown.length} clases más`,
        subtitle: "Ver todas",
        live: false,
        href: "/home#clases",
        prompt: "Ver todas tus clases",
      });
    return out;
  }, [crowd.data]);

  // En el mapa solo hay quien está conectado de verdad (camina en vivo), los tutores IA, que siempre
  // atienden, y dos guías que dan consejos
  const guides = useMemo<CampusPerson[]>(
    () =>
      GUIDES.map((g) => ({
        id: g.id,
        x: g.x,
        y: g.y,
        name: g.name,
        caption: `${g.species} · habla conmigo`,
        href: `guide:${g.id}`,
        prompt: `Hablar con ${g.name}`,
        guide: { sprite: g.sprite, scale: g.scale },
      })),
    [],
  );
  const people = useMemo<CampusPerson[]>(() => {
    if (!crowd.data) return guides;
    const ais = crowd.data.ais.slice(0, AI_SPOTS.length).map((a, i) => ({
      id: a.id,
      ...AI_SPOTS[i],
      name: a.name,
      caption: `Tutor IA · ${aiPrice(a)} quipus`,
      href: `/tutores-ia?t=${a.id}`,
      prompt: `Tomar clase con ${a.name}`,
      ai: { emoji: a.persona.emoji, color: a.persona.color },
    }));
    return [...guides, ...ais];
  }, [crowd.data, guides]);

  const reportPosition = presence.reportPosition;
  const onMove = useCallback(
    (pos: Parameters<typeof reportPosition>[0]) => {
      reportPosition(pos);
      if (!startPos.current) startPos.current = { x: pos.x, y: pos.y };
      else if (
        Math.hypot(pos.x - startPos.current.x, pos.y - startPos.current.y) > 1
      )
        setMoved(true);
    },
    [reportPosition],
  );

  const toastMsg = useToast();
  const open = useCallback(
    async (href: string) => {
      // Mascota guía: abre la conversación
      if (href.startsWith("guide:")) {
        setGuideId(href.slice("guide:".length));
        return;
      }
      // Puerta de una clase agendada: se abre el aula (la sesión se crea si aún no existe)
      if (href.startsWith("class:") && userId) {
        try {
          const { sessionId } = await api.startGroupSession(
            userId,
            href.slice("class:".length),
          );
          router.push(`/aula/${sessionId}`);
        } catch (e) {
          toastMsg(
            e instanceof Error ? e.message : "No se pudo abrir el aula",
            "error",
          );
        }
        return;
      }
      router.push(href);
    },
    [router, userId, toastMsg],
  );
  const close = useCallback(() => router.push("/campus"), [router]);
  useEffect(() => {
    if (panelOpen) panelOpenedAt.current = Date.now();
  }, [panelOpen]);

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
      if (
        el &&
        (el.isContentEditable ||
          ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName))
      )
        return;
      if (e.key === "Escape" && panelOpen) close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [panelOpen, close]);

  if (!ready || !userId || !me)
    return (
      <div className="room-floor grid min-h-dvh place-items-center text-white">
        <p className="animate-pulse font-heading text-xl">
          Entrando al campus…
        </p>
      </div>
    );

  return (
    <div className="fixed inset-0 overflow-hidden">
      <CampusWorld
        me={{
          name: me.profile.display_name.split(" ")[0],
          avatar: me.profile.avatar_config,
          equipped: me.equipped,
        }}
        people={people}
        peers={presence.peers}
        peerPositions={presence.positions}
        onMove={onMove}
        doors={doors}
        onOpen={open}
        onRoomChange={onRoomChange}
        onNearChange={onNearChange}
        onTrailEnd={onTrailEnd}
        interactRef={interactRef}
        goToRef={goToRef}
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
              title={
                presence.peers.length
                  ? presence.peers.map((p) => p.name).join(", ")
                  : "Solo tú por ahora"
              }
            >
              <span className="size-2 rounded-full bg-mint" />
              {presence.peers.length + 1} en línea
            </span>
          )}
        </div>
        {/* Atajo a la próxima clase: el avatar camina solo hasta su puerta y la abre */}
        {doors[0] && !panelOpen && doors[0].href !== "/home#clases" && (
          <button
            onClick={() => goToRef.current?.(CLASS_DOORS[0].id)}
            className={cn(
              "pointer-events-auto absolute top-16 left-3 flex max-w-[calc(100%-1.5rem)] items-center gap-2 rounded-2xl px-3 py-2 text-left text-xs font-extrabold shadow-lg",
              doors[0].live
                ? "bg-coral text-white"
                : "bg-gold text-gold-foreground",
            )}
          >
            <span aria-hidden>{doors[0].live ? "🔴" : "🚪"}</span>
            <span className="min-w-0">
              <span className="block truncate">
                {doors[0].live ? "Tu clase está en vivo: ir" : "Ir a mi clase"}
              </span>
              <span className="block truncate font-semibold opacity-80">
                {doors[0].title} · {doors[0].subtitle}
              </span>
            </span>
          </button>
        )}
        <div className="pointer-events-auto relative flex items-center gap-2 rounded-2xl bg-navy/90 py-1.5 pr-1.5 pl-3 shadow-lg backdrop-blur">
          <Link
            href="/quipus"
            className="text-gold"
            aria-label={`${me.balance} quipus, ver historial`}
          >
            <Quipus amount={me.balance} className="text-base" />
          </Link>
          <button
            onClick={() => setWelcomeOpen(true)}
            aria-label="Ver la guía de bienvenida"
            title="¿Cómo funciona?"
            className="rounded-full p-1 text-white/80 hover:text-white"
          >
            <HelpCircle className="size-6" />
          </button>
          <button
            onClick={() => setMenu((m) => !m)}
            aria-label="Mi cuenta"
            aria-expanded={menu}
            className="rounded-full"
          >
            <Avatar
              config={me.profile.avatar_config}
              equipped={me.equipped}
              size={34}
              label={me.profile.display_name}
            />
          </button>
          {menu && (
            <div className="absolute top-full right-0 mt-2 w-56 overflow-hidden rounded-2xl bg-card text-foreground shadow-xl ring-1 ring-border">
              <p className="border-b border-border px-4 py-3 text-sm font-extrabold">
                {me.profile.display_name}
                <span className="block text-xs font-semibold text-muted-foreground">
                  {me.profile.grade}º · {me.profile.school}
                </span>
              </p>
              <Link
                href="/perfil"
                onClick={() => setMenu(false)}
                className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold hover:bg-muted"
              >
                <User className="size-4" /> Mi perfil
              </Link>
              <button
                onClick={() => {
                  setMenu(false);
                  setAvatarOpen(true);
                }}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-sm font-bold hover:bg-muted"
              >
                <Shirt className="size-4" /> Editar avatar
              </button>
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
        <div
          key={banner.id}
          className={cn(
            "pointer-events-none absolute inset-x-0 z-[55] flex justify-center px-4",
            showMission ? "top-44 sm:top-20" : "top-20",
          )}
        >
          <div className="rounded-2xl bg-white/95 px-5 py-2.5 text-center shadow-xl animate-in fade-in slide-in-from-top-2">
            <p className="font-heading text-lg font-semibold text-navy">
              {banner.emoji} {banner.name}
            </p>
            {banner.subtitle && (
              <p className="text-xs font-bold text-muted-foreground">
                {banner.subtitle}
              </p>
            )}
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
      {near && !panelOpen && !guide && (
        <div className="absolute inset-x-0 bottom-24 z-[55] flex justify-center px-4">
          <button
            onClick={() => interactRef.current?.()}
            className="flex items-center gap-2 rounded-2xl bg-gold py-2 pr-4 pl-2 font-extrabold text-gold-foreground shadow-[0_4px_0_0_oklch(0.7_0.15_80)] animate-in fade-in slide-in-from-bottom-2"
          >
            <kbd className="hidden rounded-lg bg-white/70 px-2 py-0.5 font-mono text-sm sm:inline">
              X
            </kbd>
            {near.prompt}
          </button>
        </div>
      )}

      {!panelOpen && !welcome && <AnnouncementBanner />}
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
                pathname === href
                  ? "bg-mint text-navy"
                  : "text-white/75 hover:bg-navy-3 hover:text-white",
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

      {guide && !welcome && (
        <GuideDialog
          guide={guide}
          onClose={() => setGuideId(null)}
          onPick={(topic) => {
            setGuideId(null);
            if (!topic.go) return;
            goToRef.current?.(topic.go.target, { trail: true });
            setGuiding({ guide, topic });
          }}
        />
      )}
      {guiding && !panelOpen && (
        <div className="pointer-events-none absolute inset-x-0 top-[4.5rem] z-[56] flex justify-center px-3">
          <div className="pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-2xl bg-card/95 p-2 pr-3 shadow-xl ring-2 ring-gold backdrop-blur animate-in fade-in slide-in-from-top-2">
            <div className="grid size-12 shrink-0 place-items-end justify-center rounded-xl bg-secondary pb-0.5">
              <GuideSprite guide={guiding.guide} box={42} />
            </div>
            <div className="min-w-0 flex-1 text-sm leading-snug">
              <p className="font-extrabold">
                👣 Sigue las huellas hasta {guiding.topic.go?.place}
              </p>
              <p className="text-xs text-muted-foreground">{guiding.topic.say}</p>
            </div>
            <button
              onClick={() => {
                goToRef.current?.(null);
                setGuiding(null);
              }}
              className="shrink-0 rounded-full px-2 py-1 text-xs font-bold text-muted-foreground hover:bg-muted"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
      {welcome && (
        <WelcomeOverlay balance={me.balance} avatar={me.profile.avatar_config} onClose={closeWelcome} />
      )}
      {avatarOpen && !welcome && (
        <AvatarDialog avatar={me.profile.avatar_config} onClose={() => setAvatarOpen(false)} />
      )}

      {!panelOpen && (
        <p className="pointer-events-none absolute bottom-24 left-4 z-[50] hidden rounded-xl bg-navy/70 px-3 py-2 text-[11px] font-semibold text-white/80 lg:block">
          ← ↑ → ↓ o WASD para moverte · clic en el mapa para caminar · X para
          interactuar
          {API_MODE === "mock" && (
            <span className="block text-white/50">
              Modo demo: datos ficticios en este navegador
            </span>
          )}
        </p>
      )}

      {/* Panel con la pantalla abierta */}
      {panelOpen && (
        <>
          <button
            aria-label="Cerrar panel"
            onClick={() => {
              if (Date.now() - panelOpenedAt.current > 800) close();
            }}
            className="absolute inset-0 z-[65] bg-navy/25 md:bg-transparent"
          />
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
            <div className="flex-1 overflow-y-auto px-4 pt-5 pb-10 @xl:px-7 @xl:pt-7">
              {children}
            </div>
          </aside>
        </>
      )}
    </div>
  );
}
