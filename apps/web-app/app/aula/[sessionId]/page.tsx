"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Camera,
  CameraOff,
  FileText,
  LineChart,
  MessageCircle,
  Mic,
  MicOff,
  NotebookPen,
  PenTool,
  PhoneOff,
  Send,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { api } from "@/lib/api";
import { useMutation, useQuery, useSession, useToast } from "@/components/providers";
import { Logo } from "@/components/logo";
import { Quipus, btn } from "@/components/bits";
import { DesmosGraph, type DesmosHandle } from "@/components/classroom/desmos";
import { LiveDoc } from "@/components/classroom/live-doc";
import { Whiteboard } from "@/components/classroom/whiteboard";
import { ParticipantCard, type Participant } from "@/components/classroom/participant-card";
import { tableToMarkdown, upsertSection, type ClassroomEvent, type ClassroomTool, type Stroke } from "@/lib/classroom/events";
import { useClassroomRoom } from "@/lib/classroom/use-classroom-room";
import { SimulatedAiTutor } from "@/lib/classroom/ai-engine";
import { scriptFor } from "@/lib/classroom/ai-scripts";
import { useSyntheticLevel } from "@/lib/classroom/use-audio-level";
import type { TutorAvatarState, TutorGaze } from "@/components/classroom/ai-tutor-avatar";
import { cn } from "@/lib/utils";

const TOOLS: { id: ClassroomTool; label: string; icon: typeof FileText }[] = [
  { id: "doc", label: "Documento", icon: FileText },
  { id: "graph", label: "Graficador", icon: LineChart },
  { id: "board", label: "Pizarra", icon: PenTool },
  { id: "notebook", label: "Cuaderno", icon: NotebookPen },
];

interface ChatLine {
  id: number;
  /** Segmento de transcripción: las actualizaciones del mismo segmento reemplazan la línea. */
  segment?: string;
  actor: string;
  name: string;
  text: string;
  kind: "chat" | "speech" | "ask" | "system";
}

function useElapsed(since: string | undefined) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!since) return "00:00";
  const s = Math.max(0, Math.floor((now - new Date(since).getTime()) / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export default function ClassroomPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const router = useRouter();
  const { userId, ready, me } = useSession();
  const toast = useToast();
  const { data, error } = useQuery((u) => api.session(u, sessionId), [sessionId]);
  const { run, pending } = useMutation();

  const desmos = useRef<DesmosHandle>(null);
  const chatId = useRef(0);
  const writerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [tool, setTool] = useState<ClassroomTool>("doc");
  // null = aún sin cambios locales: se muestra el documento guardado de la sesión
  const [docDraft, setDocDraft] = useState<string | null>(null);
  const [writer, setWriter] = useState<string | null>(null);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [notebookImg, setNotebookImg] = useState<string | null>(null);
  const [speaking, setSpeaking] = useState<Record<string, boolean>>({});
  const [caption, setCaption] = useState<{ actor: string; text: string } | null>(null);
  const [chat, setChat] = useState<ChatLine[]>([]);
  const [question, setQuestion] = useState<string | null>(null);
  const [answer, setAnswer] = useState("");
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [micOn, setMicOn] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [voice, setVoice] = useState(true);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const tutorRef = useRef<SimulatedAiTutor | null>(null);
  const docSync = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Actividad breve del tutor IA (escribiendo / graficando) y hacia dónde mira
  const [tutorBusy, setTutorBusy] = useState<"writing" | "graphing" | null>(null);
  const [tutorGaze, setTutorGaze] = useState<TutorGaze>("center");
  const busyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const elapsed = useElapsed(data?.session.started_at);
  const myActor = `profile:${userId}`;
  const aiKey = data?.aiTutor ? `ai:${data.aiTutor.id}` : null;
  const myName = me?.profile.display_name.split(" ")[0] ?? "Tú";

  const onRoomClosed = useCallback(() => router.replace(`/resumen/${sessionId}`), [router, sessionId]);
  const onMediaError = useCallback((m: string) => toast(m, "error"), [toast]);
  const live = useClassroomRoom({
    sessionId,
    userId,
    // Se conecta cuando ya conocemos la clase y el nombre (si no, reconectaría al cambiar)
    enabled: !!data && !!me && data.session.status === "live",
    isAi: data?.session.tutor_kind === "ai",
    aiActor: data?.aiTutor ? `ai:${data.aiTutor.id}` : null,
    myName,
    voice,
    onRoomClosed,
    onMediaError,
  });
  const transport = live.transport;
  const realtime = live.mode === "livekit";

  useEffect(() => {
    if (ready && !userId) router.replace("/");
  }, [ready, userId, router]);

  // Si la sesión ya terminó, el lugar correcto es el resumen
  useEffect(() => {
    if (data && data.session.status !== "live") router.replace(`/resumen/${sessionId}`);
  }, [data, sessionId, router]);

  const savedDoc = data?.session.doc_markdown ?? "";
  const doc = docDraft ?? savedDoc;
  const docLoaded = !!data;

  const names = useMemo(() => {
    const m: Record<string, string> = {};
    if (!data) return m;
    if (data.aiTutor) m[`ai:${data.aiTutor.id}`] = data.aiTutor.name;
    if (data.tutor) m[`profile:${data.tutor.id}`] = data.tutor.display_name.split(" ")[0];
    data.students.forEach((s) => (m[`profile:${s.id}`] = s.display_name.split(" ")[0]));
    return m;
  }, [data]);

  const pushChat = useCallback((line: Omit<ChatLine, "id">) => {
    setChat((c) => {
      const i = line.segment ? c.findIndex((x) => x.segment === line.segment) : -1;
      if (i >= 0) return c.map((x, j) => (j === i ? { ...x, text: line.text } : x));
      return [...c.slice(-80), { ...line, id: ++chatId.current }];
    });
  }, []);

  // Consumidor único de eventos: aplica cada herramienta al estado del aula
  useEffect(() => {
    if (!transport) return;
    return transport.subscribe((e: ClassroomEvent) => {
      const fromAi = !!aiKey && e.actor === aiKey;
      const markBusy = (kind: "writing" | "graphing") => {
        if (!fromAi) return;
        setTutorBusy(kind);
        if (busyTimer.current) clearTimeout(busyTimer.current);
        busyTimer.current = setTimeout(() => setTutorBusy(null), 1500);
      };
      const markWriter = () => {
        setWriter(names[e.actor] ?? "Alguien");
        if (writerTimer.current) clearTimeout(writerTimer.current);
        writerTimer.current = setTimeout(() => setWriter(null), 900);
      };
      switch (e.type) {
        case "doc_write":
          setDocDraft((d) => (e.mode === "append" ? (d ?? savedDoc) + e.markdown : e.markdown));
          if (e.actor !== myActor) markWriter();
          markBusy("writing");
          break;
        case "doc_append_table":
          setDocDraft((d) => (d ?? savedDoc) + tableToMarkdown(e.rows, e.title));
          markWriter();
          markBusy("writing");
          break;
        case "doc_section":
          setDocDraft((d) => upsertSection(d ?? savedDoc, e.section, e.markdown));
          markWriter();
          markBusy("writing");
          break;
        case "notebook_image":
          setNotebookImg(e.url);
          if (e.actor !== myActor) setTool("notebook");
          break;
        case "graph_set":
          desmos.current?.setExpression(e.id, e.latex, e.color);
          markBusy("graphing");
          break;
        case "graph_remove":
          desmos.current?.removeExpression(e.id);
          markBusy("graphing");
          break;
        case "board_draw":
          setStrokes((s) => [...s, e.stroke]);
          break;
        case "board_clear":
          setStrokes((s) => s.filter((x) => x.target !== e.target));
          break;
        case "focus_tool":
          setTool(e.tool);
          if (fromAi) setTutorGaze(e.tool === "doc" ? "left" : e.tool === "graph" ? "right" : "down");
          break;
        case "speech":
          setCaption({ actor: e.actor, text: e.text });
          // Con segmento (LiveKit) la línea se va completando; sin segmento (modo local) solo la final
          if (e.segment || !e.partial)
            pushChat({ actor: e.actor, name: names[e.actor] ?? "Tutor", text: e.text, kind: "speech", segment: e.segment });
          break;
        case "speaking":
          setSpeaking((s) => ({ ...s, [e.actor]: e.on }));
          break;
        case "ask_student":
          setQuestion(e.question);
          break;
        case "chat":
          pushChat({ actor: e.actor, name: e.name, text: e.text, kind: "chat" });
          break;
        case "session_event":
          if (e.kind === "join") pushChat({ actor: e.actor, name: "", text: `${names[e.actor] ?? "Alguien"} entró al aula`, kind: "system" });
          // Otro participante terminó la clase: todos pasan al resumen
          if (e.kind === "completed" && e.actor !== myActor) setTimeout(onRoomClosed, 1200);
          break;
      }
    });
  }, [transport, names, myActor, pushChat, savedDoc, onRoomClosed, aiKey]);

  useEffect(
    () => () => {
      if (busyTimer.current) clearTimeout(busyTimer.current);
    },
    [],
  );

  // Nivel de voz del tutor IA: sintético en ambos modos (con LiveKit, `speaking` llega de ActiveSpeakersChanged).
  // Siguiente paso: exponer la pista de audio del agente y pasarla como `audioStream` en ParticipantCard.
  const aiSpeaking = !!aiKey && !!speaking[aiKey];
  const aiLevel = useSyntheticLevel(aiSpeaking);
  const aiState: TutorAvatarState = tutorBusy ?? (aiSpeaking ? "speaking" : question ? "listening" : "idle");

  // Tutor IA simulado: solo sin LiveKit. En vivo, el agent-worker entra a la sala por su cuenta.
  useEffect(() => {
    if (!transport || transport.kind !== "local") return;
    if (!data || !docLoaded || data.session.status !== "live" || !data.aiTutor) return;
    const tutor = new SimulatedAiTutor(transport, `ai:${data.aiTutor.id}`, data.aiTutor.name);
    tutor.voice = voice;
    tutorRef.current = tutor;
    const student = data.students[0]?.display_name.split(" ")[0] ?? "";
    const resumed = data.session.doc_markdown.trim().length > 0;
    const steps = resumed
      ? [{ say: `¡Volviste, ${student}! Tu documento sigue aquí. Pregúntame lo que quieras por el chat o termina la clase cuando quieras.` }]
      : scriptFor(data.topic.id, data.topic.name, student);
    tutor.run(steps);
    return () => {
      tutor.stop();
      tutorRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.session.id, docLoaded, transport]);

  // Avisos de LiveKit hacia el chat
  useEffect(() => {
    if (!realtime || !data?.aiTutor) return;
    pushChat({ actor: "sistema", name: "", text: `Conectado en vivo. Háblale a ${data.aiTutor.name} o escríbele por aquí.`, kind: "system" });
  }, [realtime, data?.aiTutor, pushChat]);

  useEffect(() => {
    if (tutorRef.current) tutorRef.current.voice = voice;
    if (!voice && typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
  }, [voice]);

  // Autoguardado del documento (con Yjs lo persistirá el servidor y-websocket)
  useEffect(() => {
    if (docDraft === null || !userId) return;
    const t = setTimeout(() => api.saveSessionDoc(userId, sessionId, doc).catch(() => {}), 1500);
    return () => clearTimeout(t);
  }, [doc, docDraft, userId, sessionId]);

  // Liberar la cámara al salir
  useEffect(() => () => stream?.getTracks().forEach((t) => t.stop()), [stream]);

  const toggleCam = async () => {
    if (realtime) return live.toggleCam();
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      setStream(null);
      return;
    }
    try {
      setStream(await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 }, audio: false }));
    } catch {
      toast("No pudimos acceder a tu cámara. Revisa los permisos del navegador.", "error");
    }
  };

  const toggleMic = async () => {
    if (realtime) return live.toggleMic();
    if (micOn) return setMicOn(false);
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      s.getTracks().forEach((t) => t.stop()); // solo verificamos permiso; LiveKit publicará el audio
      setMicOn(true);
    } catch {
      toast("No pudimos acceder a tu micrófono.", "error");
    }
  };

  const sendChat = (text: string) => {
    const t = text.trim();
    if (!t || !transport) return;
    transport.send({ type: "chat", actor: myActor, name: myName, text: t });
  };

  // Edición del documento: se aplica al instante y se sincroniza con los demás con un respiro
  const editDoc = (md: string) => {
    setDocDraft(md);
    if (docSync.current) clearTimeout(docSync.current);
    docSync.current = setTimeout(() => transport?.publish({ type: "doc_write", actor: myActor, markdown: md, mode: "replace" }), 350);
  };

  const submitAnswer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!answer.trim()) return;
    sendChat(answer);
    setAnswer("");
    setQuestion(null);
  };

  const endClass = async () => {
    if (!userId) return;
    await api.saveSessionDoc(userId, sessionId, doc).catch(() => {});
    tutorRef.current?.stop();
    const res = await run((u) => api.endSession(u, sessionId));
    if (res) {
      transport?.publish({ type: "session_event", actor: myActor, kind: "completed", payload: {} });
      router.push(`/resumen/${sessionId}`);
    } else setConfirmEnd(false);
  };

  if (error)
    return (
      <div className="room-floor grid min-h-dvh place-items-center p-6 text-center text-white">
        <div>
          <p className="font-bold">{error}</p>
          <Link href="/campus" className={cn(btn.mint, btn.md, "mt-4")}>
            Volver al campus
          </Link>
        </div>
      </div>
    );

  if (!data)
    return (
      <div className="room-floor grid min-h-dvh place-items-center text-white">
        <p className="animate-pulse font-heading text-xl">Entrando al aula…</p>
      </div>
    );

  const { session, aiTutor, tutor, students, topic } = data;
  const iAmTutor = session.tutor_id === userId;
  const myShare = session.tutor_kind === "ai" ? session.price_quipus : Math.floor(session.price_quipus / Math.max(1, students.length));
  // §11.1: el tutor recibe la suma de las cuotas (floor(P/N) × N)
  const tutorEarns = myShare * students.length;

  // Presencia: en vivo la da la sala LiveKit; en modo local solo estás tú (y el tutor simulado)
  const presence = (key: string, isMe: boolean) => {
    if (realtime) return live.media(key);
    return { connected: isMe, micOn: isMe && micOn, video: null };
  };
  const agentMedia = realtime ? live.agent() : { connected: live.mode === "local", micOn: true, video: null };
  const myMicOn = realtime ? live.media(myActor).micOn : micOn;
  const myCamOn = realtime ? !!live.media(myActor).video : !!stream;

  const tutorKey = aiTutor ? `ai:${aiTutor.id}` : `profile:${tutor?.id}`;
  const tutorMedia = aiTutor ? agentMedia : presence(tutorKey, iAmTutor);
  const tutorP: Participant = aiTutor
    ? { key: tutorKey, name: aiTutor.name, role: "tutor", isMe: false, ai: aiTutor.persona, micOn: tutorMedia.micOn, connected: tutorMedia.connected }
    : {
        key: tutorKey,
        name: tutor?.display_name.split(" ")[0] ?? "Tutor",
        role: "tutor",
        isMe: iAmTutor,
        avatar: tutor?.avatar_config,
        equipped: data.tutorEquipped,
        micOn: tutorMedia.micOn,
        connected: tutorMedia.connected,
      };
  const studentPs: (Participant & { video: ReturnType<typeof presence>["video"] })[] = students.map((s) => {
    const key = `profile:${s.id}`;
    const m = presence(key, s.id === userId);
    return {
      key,
      name: s.display_name.split(" ")[0],
      role: "student",
      isMe: s.id === userId,
      avatar: s.avatar_config,
      equipped: s.equipped,
      micOn: m.micOn,
      connected: m.connected,
      video: m.video,
    };
  });
  const cardProps = (p: Participant & { video?: ReturnType<typeof presence>["video"] }) => ({
    p,
    speaking: !!speaking[p.key],
    stream: p.isMe && !realtime ? stream : null,
    videoTrack: p.video ?? null,
  });

  const captionName = caption ? names[caption.actor] ?? "" : "";

  return (
    <div className="room-floor flex h-dvh flex-col overflow-hidden text-white">
      {/* Barra superior */}
      <header className="flex items-center gap-3 px-3 py-2.5 md:px-5">
        <Link href="/campus" className="rounded-xl p-2 hover:bg-navy-2" aria-label="Volver al campus sin terminar la clase">
          <ArrowLeft className="size-5" />
        </Link>
        <Logo light className="hidden text-lg md:inline-flex" />
        <div className="min-w-0 flex-1 md:ml-4">
          <p className="truncate font-heading text-lg font-semibold">{topic.name}</p>
          <p className="flex items-center gap-2 text-xs font-bold text-white/60">
            <span className="flex items-center gap-1 text-coral">
              <span className="size-2 animate-pulse rounded-full bg-coral" /> EN VIVO
            </span>
            {elapsed}
            <span className="hidden text-white/40 sm:inline">
              · {live.mode === "connecting" ? "conectando…" : realtime ? "audio y video en vivo" : "modo local"}
            </span>
          </p>
        </div>
        <span className="hidden items-center gap-1.5 rounded-full bg-navy-2 px-3 py-1.5 text-xs font-bold sm:flex">
          {iAmTutor ? "Ganas" : "Pagas"} <Quipus amount={iAmTutor ? tutorEarns : myShare} className="text-gold" />
          al terminar
        </span>
        <button onClick={() => setConfirmEnd(true)} className={cn(btn.danger, btn.sm)}>
          <PhoneOff className="size-4" /> <span className="hidden sm:inline">Terminar</span>
        </button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-3 px-3 pb-3 md:flex-row md:px-5">
        {/* Tarjetas fijas alrededor del área didáctica: tutor a la izquierda */}
        <aside className="flex gap-2 overflow-x-auto md:w-52 md:shrink-0 md:flex-col md:overflow-visible">
          <div className="w-44 shrink-0 md:w-full">
            <ParticipantCard
              {...cardProps({ ...tutorP, video: tutorMedia.video })}
              large
              aiState={aiState}
              aiLevel={aiLevel}
              aiGaze={tutorGaze}
            />
          </div>
          {studentPs.slice(0, 2).map((p) => (
            <ParticipantCard key={p.key} {...cardProps(p)} />
          ))}
          {studentPs.slice(2).map((p) => (
            <div key={p.key} className="md:hidden">
              <ParticipantCard {...cardProps(p)} />
            </div>
          ))}
        </aside>

        {/* Área didáctica */}
        <section className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-[1.75rem] bg-card text-foreground shadow-2xl">
          <div className="flex gap-1 overflow-x-auto border-b border-border p-2" role="tablist">
            {TOOLS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                role="tab"
                aria-selected={tool === id}
                onClick={() => setTool(id)}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-extrabold transition-colors",
                  tool === id ? "bg-primary text-white" : "text-muted-foreground hover:bg-muted",
                )}
              >
                <Icon className="size-4" /> {label}
              </button>
            ))}
          </div>

          <div className="relative min-h-0 flex-1">
            <div className={cn("absolute inset-0", tool !== "doc" && "invisible")}>
              <LiveDoc
                markdown={doc}
                writer={writer}
                onChange={editDoc}
              />
            </div>
            <div className={cn("absolute inset-0", tool !== "graph" && "invisible")}>
              <DesmosGraph ref={desmos} visible={tool === "graph"} />
            </div>
            <div className={cn("absolute inset-0", tool !== "board" && "invisible")}>
              <Whiteboard
                target="board"
                visible={tool === "board"}
                strokes={strokes.filter((s) => s.target === "board")}
                onStroke={(stroke) => transport?.send({ type: "board_draw", actor: myActor, stroke })}
                onClear={() => transport?.send({ type: "board_clear", actor: myActor, target: "board" })}
              />
            </div>
            <div className={cn("absolute inset-0", tool !== "notebook" && "invisible")}>
              <Whiteboard
                target="notebook"
                visible={tool === "notebook"}
                background={notebookImg}
                onBackground={(url) => transport?.send({ type: "notebook_image", actor: myActor, url })}
                strokes={strokes.filter((s) => s.target === "notebook")}
                onStroke={(stroke) => transport?.send({ type: "board_draw", actor: myActor, stroke })}
                onClear={() => transport?.send({ type: "board_clear", actor: myActor, target: "notebook" })}
              />
            </div>

            {/* Subtítulos de lo que dice el tutor */}
            {caption && speaking[caption.actor] && !question && (
              <div className="pointer-events-none absolute inset-x-3 bottom-3 flex justify-center">
                <p className="max-w-2xl rounded-2xl bg-navy/90 px-4 py-2.5 text-sm font-semibold text-white shadow-xl backdrop-blur animate-in fade-in">
                  <b className="text-mint">{captionName}:</b> {caption.text}
                </p>
              </div>
            )}

            {/* Pregunta del tutor: respuesta rápida */}
            {question && (
              <form
                onSubmit={submitAnswer}
                className="absolute inset-x-3 bottom-3 mx-auto max-w-xl rounded-3xl bg-navy p-4 text-white shadow-2xl ring-4 ring-mint/50 animate-in slide-in-from-bottom-3"
              >
                <p className="text-xs font-bold text-mint">{aiTutor?.name ?? "Tu tutor"} te pregunta</p>
                <p className="mt-1 font-heading text-lg font-semibold">{question}</p>
                <div className="mt-3 flex gap-2">
                  <input
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    autoFocus
                    placeholder="Escribe tu respuesta…"
                    className="min-w-0 flex-1 rounded-2xl bg-white px-4 py-2.5 text-sm font-semibold text-foreground outline-none"
                    aria-label="Tu respuesta"
                  />
                  <button type="submit" className={cn(btn.mint, btn.md)}>
                    <Send className="size-4" />
                  </button>
                </div>
              </form>
            )}
          </div>
        </section>

        {/* Más alumnos a la derecha (escritorio) */}
        {studentPs.length > 2 && (
          <aside className="hidden w-44 shrink-0 flex-col gap-2 md:flex">
            {studentPs.slice(2).map((p) => (
              <ParticipantCard key={p.key} {...cardProps(p)} />
            ))}
          </aside>
        )}

        {/* Chat / transcripción */}
        {chatOpen && (
          <aside className="fixed inset-x-0 bottom-0 z-40 flex h-[60dvh] flex-col rounded-t-3xl bg-card text-foreground shadow-2xl md:static md:z-auto md:h-auto md:w-80 md:shrink-0 md:rounded-[1.75rem]">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <p className="font-extrabold">Chat y transcripción</p>
              <button onClick={() => setChatOpen(false)} className="rounded-xl p-1.5 hover:bg-muted" aria-label="Cerrar chat">
                <X className="size-4" />
              </button>
            </div>
            <div className="flex flex-1 flex-col-reverse gap-2 overflow-y-auto p-3">
              {[...chat].reverse().map((l) =>
                l.kind === "system" ? (
                  <p key={l.id} className="text-center text-xs font-semibold text-muted-foreground">
                    {l.text}
                  </p>
                ) : (
                  <div
                    key={l.id}
                    className={cn(
                      "max-w-[85%] rounded-2xl px-3 py-2 text-sm",
                      l.actor === myActor ? "self-end bg-primary text-white" : l.kind === "speech" ? "bg-secondary" : "bg-muted",
                    )}
                  >
                    {l.actor !== myActor && <p className="text-[11px] font-extrabold opacity-70">{l.name}</p>}
                    {l.text}
                  </div>
                ),
              )}
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                sendChat(chatInput);
                setChatInput("");
                setQuestion(null);
              }}
              className="flex gap-2 border-t border-border p-3"
            >
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder={aiTutor ? `Pregúntale a ${aiTutor.name}…` : "Escribe un mensaje…"}
                className="min-w-0 flex-1 rounded-2xl bg-muted px-3 py-2 text-sm font-semibold outline-none focus:ring-2 focus:ring-ring/30"
                aria-label="Mensaje"
              />
              <button type="submit" className={cn(btn.primary, "size-10")} aria-label="Enviar">
                <Send className="size-4" />
              </button>
            </form>
          </aside>
        )}
      </div>

      {/* Controles */}
      <footer className="flex items-center justify-center gap-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {[
          { on: myMicOn, onClick: toggleMic, icons: [Mic, MicOff], label: myMicOn ? "Silenciar micrófono" : "Activar micrófono" },
          { on: myCamOn, onClick: toggleCam, icons: [Camera, CameraOff], label: myCamOn ? "Apagar cámara" : "Encender cámara" },
          ...(aiTutor
            ? [{ on: voice, onClick: () => setVoice((v) => !v), icons: [Volume2, VolumeX], label: voice ? "Silenciar voz del tutor" : "Activar voz del tutor" }]
            : []),
        ].map(({ on, onClick, icons: [On, Off], label }) => (
          <button
            key={label}
            onClick={onClick}
            aria-label={label}
            title={label}
            className={cn("grid size-12 place-items-center rounded-2xl transition-colors", on ? "bg-navy-3 text-white" : "bg-coral/90 text-white")}
          >
            {on ? <On className="size-5" /> : <Off className="size-5" />}
          </button>
        ))}
        {live.audioBlocked && (
          <button onClick={() => live.startAudio()} className={cn(btn.gold, btn.md)}>
            <Volume2 className="size-4" /> Activar audio
          </button>
        )}
        <button
          onClick={() => setChatOpen((c) => !c)}
          aria-label="Chat"
          title="Chat"
          className={cn("relative grid size-12 place-items-center rounded-2xl", chatOpen ? "bg-mint text-navy" : "bg-navy-3 text-white")}
        >
          <MessageCircle className="size-5" />
        </button>
      </footer>

      {/* Confirmación de cierre: aquí se liquidan los quipus */}
      {confirmEnd && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4 backdrop-blur-sm" role="dialog" aria-modal>
          <div className="w-full max-w-sm rounded-[2rem] bg-card p-6 text-center text-foreground shadow-2xl animate-in zoom-in-95">
            <p className="font-heading text-2xl font-semibold">¿Terminar la clase?</p>
            <p className="mt-2 text-muted-foreground">
              {iAmTutor ? "Al terminar recibirás tu pago:" : "Al terminar se descuentan tus quipus:"}
            </p>
            <Quipus amount={iAmTutor ? tutorEarns : myShare} className="mt-3 text-4xl" iconClassName="size-8" sign={iAmTutor ? "+" : "−"} />
            <div className="mt-6 flex flex-col gap-2">
              <button onClick={endClass} disabled={pending} className={cn(btn.danger, btn.md)}>
                {pending ? "Cerrando…" : "Sí, terminar"}
              </button>
              <button onClick={() => setConfirmEnd(false)} className={cn(btn.soft, btn.md)}>
                Seguir en clase
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
