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
  Sparkles,
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
import { ActivityPanel, type QuizCard } from "@/components/classroom/activity-panel";
import { Whiteboard } from "@/components/classroom/whiteboard";
import { ParticipantCard, type Participant } from "@/components/classroom/participant-card";
import { applyBoardEvent, normalizeTool, tableToMarkdown, upsertSection, type ClassroomEvent, type ClassroomTool, type Stroke } from "@/lib/classroom/events";
import { useClassroomRoom } from "@/lib/classroom/use-classroom-room";
import { SimulatedAiTutor } from "@/lib/classroom/ai-engine";
import { scriptFor } from "@/lib/classroom/ai-scripts";
import { useSyntheticLevel } from "@/lib/classroom/use-audio-level";
import type { TutorAvatarState, TutorGaze } from "@/components/classroom/ai-tutor-avatar";
import { cn } from "@/lib/utils";

const TOOLS: { id: ClassroomTool; label: string; icon: typeof FileText }[] = [
  { id: "doc", label: "Documento", icon: FileText },
  { id: "graph", label: "Graficador", icon: LineChart },
  { id: "notebook", label: "Cuaderno", icon: NotebookPen },
  { id: "activity", label: "Actividad", icon: Sparkles },
];

interface ChatLine {
  id: number;
  /** Segmento de transcripción: las actualizaciones del mismo segmento reemplazan la línea. */
  segment?: string;
  actor: string;
  name: string;
  text: string;
  kind: "chat" | "speech" | "ask" | "system" | "action";
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
  const [quiz, setQuiz] = useState<QuizCard | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [micOn, setMicOn] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [voice, setVoice] = useState(true);
  const [confirmEnd, setConfirmEnd] = useState(false);
  // Esperando el resumen del tutor antes de cerrar (wrapping = lectura sin render para el handler de eventos)
  const [wrappingUp, setWrappingUp] = useState(false);
  const wrapping = useRef(false);
  const wrapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finishing = useRef(false);
  const finishRef = useRef<() => Promise<void>>(async () => {});
  const docRef = useRef("");
  const tutorRef = useRef<SimulatedAiTutor | null>(null);
  const docSync = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Actividad breve del tutor IA (escribiendo / graficando) y hacia dónde mira
  const [tutorBusy, setTutorBusy] = useState<"writing" | "graphing" | null>(null);
  const [tutorGaze, setTutorGaze] = useState<TutorGaze>("center");
  const busyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Última confirmación de una herramienta del tutor: aparece unos segundos aunque el chat esté cerrado
  const [actionChip, setActionChip] = useState<string | null>(null);
  const chipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Reacción puntual del avatar (emote del agente o acierto en un quiz): dura unos segundos
  const [emote, setEmote] = useState<TutorAvatarState | null>(null);
  const emoteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
  useEffect(() => {
    docRef.current = doc;
  }, [doc]);
  const docLoaded = !!data;

  const names = useMemo(() => {
    const m: Record<string, string> = {};
    if (!data) return m;
    if (data.aiTutor) m[`ai:${data.aiTutor.id}`] = data.aiTutor.name;
    if (data.tutor) m[`profile:${data.tutor.id}`] = data.tutor.display_name.split(" ")[0];
    data.students.forEach((s) => (m[`profile:${s.id}`] = s.display_name.split(" ")[0]));
    return m;
  }, [data]);

  // Los trazos propios se aplican siempre; si hay transporte además viajan a los demás
  const sendBoard = useCallback(
    (e: ClassroomEvent) => {
      if (transport) transport.send(e);
      else setStrokes((s) => applyBoardEvent(s, e));
    },
    [transport],
  );

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
      const showEmote = (state: TutorAvatarState) => {
        setEmote(state);
        if (emoteTimer.current) clearTimeout(emoteTimer.current);
        emoteTimer.current = setTimeout(() => setEmote(null), 2500);
      };
      switch (e.type) {
        case "emote":
          if (fromAi) showEmote(e.kind === "think" ? "thinking" : e.kind === "surprised" ? "surprised" : "celebrating");
          break;
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
          desmos.current?.setExpression(e.id, e.latex, e.color, fromAi);
          markBusy("graphing");
          break;
        case "graph_remove":
          desmos.current?.removeExpression(e.id);
          markBusy("graphing");
          break;
        case "board_draw":
        case "board_clear":
        case "board_erase":
          setStrokes((s) => applyBoardEvent(s, e));
          break;
        case "focus_tool": {
          const next = normalizeTool(e.tool);
          if (!next) break;
          setTool(next);
          if (fromAi) setTutorGaze(next === "doc" ? "left" : next === "graph" ? "right" : "down");
          break;
        }
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
        case "quiz_ask":
          setQuiz({ id: e.id, question: e.question, options: e.options, picked: null, result: null });
          // La actividad se abre sola para que el alumno la vea
          setTool("activity");
          break;
        case "quiz_result":
          if (e.correct) showEmote("celebrating");
          setQuiz((q) =>
            q && q.id === e.id ? { ...q, result: { correct: e.correct, correctIndex: e.correctIndex, explanation: e.explanation } } : q,
          );
          break;
        case "wrap_up_done":
          if (!wrapping.current || !fromAi) break;
          if (!e.ok) toast("Quipu no pudo escribir el resumen; cerramos la clase.", "error");
          // El documento con el resumen ya llegó (mismo canal ordenado); un respiro para que React lo asiente
          if (wrapTimer.current) clearTimeout(wrapTimer.current);
          wrapTimer.current = setTimeout(() => void finishRef.current(), 400);
          break;
        case "tool_action":
          pushChat({ actor: e.actor, name: "", text: `✓ ${e.label}`, kind: "action" });
          setActionChip(`✓ ${e.label}`);
          if (chipTimer.current) clearTimeout(chipTimer.current);
          chipTimer.current = setTimeout(() => setActionChip(null), 3500);
          break;
        case "session_event":
          if (e.kind === "join") pushChat({ actor: e.actor, name: "", text: `${names[e.actor] ?? "Alguien"} entró al aula`, kind: "system" });
          // Otro participante terminó la clase: todos pasan al resumen
          if (e.kind === "completed" && e.actor !== myActor) setTimeout(onRoomClosed, 1200);
          break;
      }
    });
  }, [transport, names, myActor, pushChat, savedDoc, onRoomClosed, aiKey, toast]);

  useEffect(
    () => () => {
      if (busyTimer.current) clearTimeout(busyTimer.current);
      if (chipTimer.current) clearTimeout(chipTimer.current);
      if (emoteTimer.current) clearTimeout(emoteTimer.current);
      if (wrapTimer.current) clearTimeout(wrapTimer.current);
    },
    [],
  );

  // Nivel de voz del tutor IA: sintético en ambos modos (con LiveKit, `speaking` llega de ActiveSpeakersChanged).
  // Siguiente paso: exponer la pista de audio del agente y pasarla como `audioStream` en ParticipantCard.
  const aiSpeaking = !!aiKey && !!speaking[aiKey];
  const aiLevel = useSyntheticLevel(aiSpeaking);
  const quizWaiting = !!quiz && !quiz.result;
  const aiState: TutorAvatarState =
    emote ?? tutorBusy ?? (aiSpeaking ? "speaking" : quiz?.picked != null && quizWaiting ? "thinking" : question || quizWaiting ? "listening" : "idle");

  // Si el veredicto nunca llega (agente caído), la tarjeta no se queda colgada
  useEffect(() => {
    if (!quiz || quiz.picked === null || quiz.result) return;
    const id = quiz.id;
    const t = setTimeout(() => setQuiz((q) => (q && q.id === id && !q.result ? null : q)), 30_000);
    return () => clearTimeout(t);
  }, [quiz]);

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

  const pickOption = (index: number) => {
    if (!quiz || quiz.picked !== null || !transport) return;
    setQuiz({ ...quiz, picked: index });
    transport.send({ type: "quiz_answer", actor: myActor, id: quiz.id, index });
  };

  const submitAnswer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!answer.trim()) return;
    sendChat(answer);
    setAnswer("");
    setQuestion(null);
  };

  // Cierre real: guarda el documento (con el resumen del tutor si llegó) y termina la sesión
  const finishClass = async () => {
    if (!userId || finishing.current) return;
    finishing.current = true;
    if (wrapTimer.current) clearTimeout(wrapTimer.current);
    await api.saveSessionDoc(userId, sessionId, docRef.current).catch(() => {});
    tutorRef.current?.stop();
    const res = await run((u) => api.endSession(u, sessionId));
    if (res) {
      transport?.publish({ type: "session_event", actor: myActor, kind: "completed", payload: {} });
      router.push(`/resumen/${sessionId}`);
    } else {
      finishing.current = false;
      wrapping.current = false;
      setWrappingUp(false);
      setConfirmEnd(false);
    }
  };
  useEffect(() => {
    finishRef.current = finishClass;
  });

  // En una clase con tutor IA se le pide el resumen antes de cerrar la sala
  const endClass = async () => {
    if (!userId) return;
    const aiClass = data?.session.tutor_kind === "ai";
    if (!aiClass || wrapping.current) return finishClass();
    if (realtime && transport) {
      transport.publish({ type: "wrap_up", actor: myActor, doc: docRef.current });
    } else if (tutorRef.current && data) {
      tutorRef.current.writeSummary(docRef.current, data.topic.name);
    } else return finishClass();
    wrapping.current = true;
    setConfirmEnd(false);
    setWrappingUp(true);
    if (realtime) {
      // Sin respuesta del agente en ~25 s se cierra igual, con el documento tal cual
      wrapTimer.current = setTimeout(() => {
        toast("Quipu no alcanzó a escribir el resumen; cerramos la clase.", "error");
        void finishRef.current();
      }, 25_000);
    } else {
      // Local: el resumen ya se escribió; un respiro para que se vea antes de cerrar
      wrapTimer.current = setTimeout(() => void finishRef.current(), 1500);
    }
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
    return { connected: isMe, micOn: isMe && micOn, camOn: isMe && !!stream, video: null };
  };
  const agentMedia = realtime ? live.agent() : { connected: live.mode === "local", micOn: true, camOn: false, video: null };
  const myMicOn = realtime ? live.media(myActor).micOn : micOn;
  const myCamOn = realtime ? live.media(myActor).camOn : !!stream;

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
                {id === "activity" && tool !== "activity" && quiz && quiz.picked === null && (
                  <span className="size-2 animate-pulse rounded-full bg-gold" aria-label="Hay una actividad nueva" />
                )}
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
            <div className={cn("absolute inset-0", tool !== "notebook" && "invisible")}>
              <Whiteboard
                target="notebook"
                visible={tool === "notebook"}
                background={notebookImg}
                onBackground={(url) => transport?.send({ type: "notebook_image", actor: myActor, url })}
                strokes={strokes.filter((s) => s.target === "notebook")}
                onStroke={(stroke) => sendBoard({ type: "board_draw", actor: myActor, stroke })}
                onErase={(ids) => sendBoard({ type: "board_erase", actor: myActor, target: "notebook", ids })}
                onClear={() => sendBoard({ type: "board_clear", actor: myActor, target: "notebook" })}
              />
            </div>

            <div className={cn("absolute inset-0", tool !== "activity" && "invisible")}>
              <ActivityPanel quiz={quiz} tutorName={aiTutor?.name ?? "tu tutor"} onPick={pickOption} onDismiss={() => setQuiz(null)} />
            </div>

            {actionChip && (
              <p
                role="status"
                className="pointer-events-none absolute right-3 top-3 z-10 max-w-[80%] truncate rounded-full bg-navy/90 px-3 py-1.5 text-xs font-extrabold text-mint shadow-lg animate-in fade-in slide-in-from-top-2"
              >
                {actionChip}
              </p>
            )}

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
                ) : l.kind === "action" ? (
                  <p
                    key={l.id}
                    className="self-center rounded-full bg-mint/20 px-3 py-1 text-center text-xs font-extrabold text-foreground"
                  >
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
          { pending: realtime && live.micPending, on: myMicOn, onClick: toggleMic, icons: [Mic, MicOff], label: myMicOn ? "Silenciar micrófono" : "Activar micrófono" },
          { pending: realtime && live.camPending, on: myCamOn, onClick: toggleCam, icons: [Camera, CameraOff], label: myCamOn ? "Apagar cámara" : "Encender cámara" },
          ...(aiTutor
            ? [{ on: voice, onClick: () => setVoice((v) => !v), icons: [Volume2, VolumeX], label: voice ? "Silenciar voz del tutor" : "Activar voz del tutor" }]
            : []),
        ].map(({ pending, on, onClick, icons: [On, Off], label }) => (
          <button
            key={label}
            onClick={onClick}
            disabled={pending}
            aria-label={label}
            title={label}
            className={cn("grid size-12 place-items-center rounded-2xl transition-colors disabled:opacity-60", on ? "bg-navy-3 text-white" : "bg-coral/90 text-white")}
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

      {/* Esperando el resumen del tutor */}
      {wrappingUp && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4 backdrop-blur-sm" role="dialog" aria-modal>
          <div className="w-full max-w-sm rounded-[2rem] bg-card p-6 text-center text-foreground shadow-2xl animate-in zoom-in-95">
            <p className="animate-pulse font-heading text-2xl font-semibold">
              {aiTutor?.name ?? "Quipu"} está escribiendo el resumen…
            </p>
            <p className="mt-2 text-muted-foreground">Lo que vimos, lo que te costó y tres ejercicios para practicar.</p>
            <button onClick={() => void finishClass()} className={cn(btn.soft, btn.md, "mt-6 w-full")}>
              Terminar sin resumen
            </button>
          </div>
        </div>
      )}

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
