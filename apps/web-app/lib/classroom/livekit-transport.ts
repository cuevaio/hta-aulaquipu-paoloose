// Transporte del aula sobre LiveKit. Traduce lo que llega por la sala al mismo ClassroomEvent
// que consume el aula en modo local:
// - "aulaquipu:class" (text stream): eventos entre personas (documento, pizarra…)
// - "aulaquipu:notebook" (byte stream): foto del cuaderno
// - "aulaquipu:doc" / "aulaquipu:graph" / "aulaquipu:action" / "aulaquipu:emote"
//   "aulaquipu:control": cierre de clase (wrap_up del alumno -> wrap_up_done del agente): herramientas del agente (backend/agents/aulaquipu-tutor)
// - "aulaquipu:quiz" / "aulaquipu:quiz-result": tarjetas de opción múltiple (agente -> aula);
//   "aulaquipu:quiz-answer": la respuesta del alumno (aula -> agente)
// - "lk.chat": chat de texto (el agente lo escucha como entrada)
// - "lk.transcription": subtítulos de lo que dice el agente y de lo que dice el alumno

import {
  ParticipantKind,
  RoomEvent,
  type Participant,
  type RemoteParticipant,
  type Room,
} from "livekit-client";
import { normalizeTool, type ClassroomEvent, type Stroke, type TutorEmote } from "@/lib/classroom/events";
import type { ClassroomTransport } from "@/lib/classroom/transport";

const CLASS_TOPIC = "aulaquipu:class";
const NOTEBOOK_TOPIC = "aulaquipu:notebook";

// Eventos que una persona puede mandar a las demás (lo demás lo genera el agente o la sala)
const PEER_EVENTS = new Set<ClassroomEvent["type"]>([
  "quiz_answered",
  "sync_request",
  "class_snapshot",
  "doc_write",
  "doc_append_table",
  "graph_set",
  "graph_remove",
  "board_draw",
  "board_clear",
  "board_erase",
  "focus_tool",
  "notebook_clear",
  "quiz_ask",
  "session_event",
]);

export class LiveKitTransport implements ClassroomTransport {
  readonly kind = "livekit" as const;
  private listeners = new Set<(event: ClassroomEvent) => void>();
  private decoder = new TextDecoder();
  private speaking = new Set<string>();

  constructor(
    private room: Room,
    /** Actor con el que se identifica al agente (p. ej. "ai:<id del tutor IA>"). */
    private aiActor: string | null,
    private myName: string,
  ) {
    room.on(RoomEvent.DataReceived, this.onData);
    room.on(RoomEvent.ActiveSpeakersChanged, this.onSpeakers);
    room.registerTextStreamHandler("lk.chat", (reader, info) => {
      void reader.readAll().then((text) => {
        if (!text.trim()) return;
        const p = this.participant(info.identity);
        this.emit({ type: "chat", actor: this.actorOf(p, info.identity), name: p?.name || "Alguien", text });
      });
    });
    room.registerTextStreamHandler(CLASS_TOPIC, (reader, info) => {
      void reader.readAll().then((text) => {
        let msg: unknown;
        try {
          msg = JSON.parse(text);
        } catch {
          return;
        }
        if (!msg || typeof msg !== "object") return;
        const type = (msg as { type?: unknown }).type;
        if (typeof type !== "string" || !PEER_EVENTS.has(type as ClassroomEvent["type"])) return;
        if (type === "class_snapshot") {
          // Estado que manda un compañero a quien entró tarde: se reconstruye con forma y topes seguros
          const m = msg as { to?: unknown; graph?: unknown; strokes?: unknown; doc?: unknown };
          if (typeof m.to !== "string") return;
          const graph = (Array.isArray(m.graph) ? m.graph : [])
            .filter((g): g is { id: string; latex: string; color?: unknown } => !!g && typeof g.id === "string" && typeof g.latex === "string")
            .slice(0, 40)
            .map((g) => ({ id: g.id.slice(0, 40), latex: g.latex.slice(0, 200), ...(typeof g.color === "string" && /^#[0-9a-fA-F]{6}$/.test(g.color) ? { color: g.color } : {}) }));
          const strokes = (Array.isArray(m.strokes) ? m.strokes : []).filter((s): s is Stroke => !!s && typeof (s as Stroke).id === "string").slice(-600);
          this.emit({
            type: "class_snapshot",
            actor: this.actorOf(this.participant(info.identity), info.identity),
            to: m.to,
            graph,
            strokes,
            doc: typeof m.doc === "string" ? m.doc.slice(0, 200_000) : "",
          });
          return;
        }
        if (type === "quiz_ask") {
          // Tarjeta del director compartida por un compañero: se reconstruye con forma segura
          const q = msg as { id?: unknown; question?: unknown; options?: unknown };
          const options = Array.isArray(q.options) ? q.options.filter((o): o is string => typeof o === "string").map((o) => o.slice(0, 120)).slice(0, 4) : [];
          if (typeof q.id !== "string" || typeof q.question !== "string" || options.length < 2) return;
          this.emit({ type: "quiz_ask", actor: this.actorOf(this.participant(info.identity), info.identity), id: q.id.slice(0, 40), question: q.question.slice(0, 240), options });
          return;
        }
        // El actor lo pone la sala, no el mensaje: nadie puede hacerse pasar por otro
        this.emit({ ...(msg as ClassroomEvent), actor: this.actorOf(this.participant(info.identity), info.identity) });
      });
    });
    room.registerTextStreamHandler("lk.transcription", (reader, info) => {
      void this.onTranscription(reader, info.identity);
    });
    room.registerByteStreamHandler(NOTEBOOK_TOPIC, (reader, info) => {
      void reader.readAll().then((chunks) => {
        const blob = new Blob(chunks as BlobPart[], { type: reader.info.mimeType || "image/jpeg" });
        this.emit({ type: "notebook_image", actor: this.actorOf(this.participant(info.identity), info.identity), url: URL.createObjectURL(blob) });
      });
    });
  }

  get myActor() {
    return this.room.localParticipant.identity;
  }

  private participant(identity: string): Participant | undefined {
    if (identity === this.room.localParticipant.identity) return this.room.localParticipant;
    return this.room.remoteParticipants.get(identity);
  }

  private actorOf(p: Participant | undefined, identity?: string): string {
    if (p?.kind === ParticipantKind.AGENT) return this.aiActor ?? "ai";
    return p?.identity ?? identity ?? "desconocido";
  }

  private emit(e: ClassroomEvent) {
    this.listeners.forEach((fn) => fn(e));
  }

  send(event: ClassroomEvent) {
    // Siempre se aplica localmente, igual que en LocalTransport
    queueMicrotask(() => this.emit(event));
    this.publish(event);
  }

  publish(event: ClassroomEvent) {
    if (event.type === "chat") {
      void this.room.localParticipant.sendText(event.text, { topic: "lk.chat" }).catch(() => {});
      return;
    }
    if (event.type === "notebook_image") {
      void this.sendImage(event.url);
      return;
    }
    if (event.type === "wrap_up") {
      const body = JSON.stringify({ type: "wrap_up", doc: event.doc.slice(0, 12000) });
      void this.room.localParticipant
        .publishData(new TextEncoder().encode(body), { reliable: true, topic: "aulaquipu:control" })
        .catch(() => {});
      return;
    }
    if (event.type === "director_done") {
      const body = JSON.stringify({ type: "director_done", summary: event.summary.slice(0, 200) });
      void this.room.localParticipant
        .publishData(new TextEncoder().encode(body), { reliable: true, topic: "aulaquipu:control" })
        .catch(() => {});
      return;
    }
    if (event.type === "cursor") {
      // Muchos por segundo: canal sin garantía (si se pierde uno, el siguiente lo corrige)
      const body = JSON.stringify({ x: Math.round(event.x * 1000) / 1000, y: Math.round(event.y * 1000) / 1000, tool: event.tool });
      void this.room.localParticipant
        .publishData(new TextEncoder().encode(body), { reliable: false, topic: "aulaquipu:cursor" })
        .catch(() => {});
      return;
    }
    if (event.type === "quiz_answer") {
      const body = JSON.stringify({ type: "quiz_answer", id: event.id, index: event.index });
      void this.room.localParticipant
        .publishData(new TextEncoder().encode(body), { reliable: true, topic: "aulaquipu:quiz-answer" })
        .catch(() => {});
      return;
    }
    if (!PEER_EVENTS.has(event.type)) return;
    // Text streams: fiables y sin el límite de ~15 KB de los paquetes de datos (documentos largos, trazos)
    void this.room.localParticipant.sendText(JSON.stringify(event), { topic: CLASS_TOPIC }).catch(() => {});
  }

  private async sendImage(dataUrl: string) {
    try {
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], "cuaderno.jpg", { type: blob.type || "image/jpeg" });
      await this.room.localParticipant.sendFile(file, { topic: NOTEBOOK_TOPIC });
    } catch {
      // la foto queda solo local si no se pudo enviar
    }
  }

  subscribe(fn: (event: ClassroomEvent) => void) {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  close() {
    this.room.off(RoomEvent.DataReceived, this.onData);
    this.room.off(RoomEvent.ActiveSpeakersChanged, this.onSpeakers);
    for (const topic of [CLASS_TOPIC, "lk.chat", "lk.transcription"]) this.room.unregisterTextStreamHandler(topic);
    this.room.unregisterByteStreamHandler(NOTEBOOK_TOPIC);
    this.listeners.clear();
  }

  private onData = (payload: Uint8Array, participant?: RemoteParticipant, _kind?: unknown, topic?: string) => {
    let msg: Record<string, unknown>;
    try {
      msg = JSON.parse(this.decoder.decode(payload));
    } catch {
      return;
    }
    if (!msg || typeof msg !== "object") return;
    const actor = this.actorOf(participant);

    if (topic === "aulaquipu:doc" && msg.type === "doc_op") {
      if (msg.op === "write" && typeof msg.section === "string" && typeof msg.markdown === "string") {
        this.emit({ type: "focus_tool", actor, tool: "doc" });
        this.emit({ type: "doc_section", actor, section: msg.section, markdown: msg.markdown });
      } else if (msg.op === "append_table" && Array.isArray(msg.columns) && Array.isArray(msg.rows)) {
        const rows = [msg.columns as unknown[], ...(msg.rows as unknown[][])].map((r) => (Array.isArray(r) ? r.map(String) : []));
        this.emit({ type: "focus_tool", actor, tool: "doc" });
        this.emit({ type: "doc_append_table", actor, rows, title: typeof msg.title === "string" ? msg.title : undefined });
      }
      return;
    }
    if (topic === "aulaquipu:cursor") {
      const x = Number(msg.x);
      const y = Number(msg.y);
      const tool = normalizeTool(String(msg.tool ?? ""));
      if (!Number.isFinite(x) || !Number.isFinite(y) || x > 1.05 || y > 1.05) return;
      this.emit({ type: "cursor", actor, x, y, tool });
      return;
    }
    if (topic === "aulaquipu:action" && msg.type === "action" && typeof msg.label === "string") {
      this.emit({ type: "tool_action", actor, tool: typeof msg.tool === "string" ? msg.tool : "", label: msg.label.slice(0, 120), ok: msg.ok !== false });
      return;
    }
    if (topic === "aulaquipu:quiz" && msg.type === "quiz" && typeof msg.id === "string" && typeof msg.question === "string") {
      const options = Array.isArray(msg.options) ? msg.options.map(String).slice(0, 4) : [];
      if (options.length >= 2) this.emit({ type: "quiz_ask", actor, id: msg.id, question: msg.question, options });
      return;
    }
    if (topic === "aulaquipu:quiz-result" && msg.type === "quiz_result" && typeof msg.id === "string") {
      this.emit({
        type: "quiz_result",
        actor,
        id: msg.id,
        correct: msg.correct === true,
        correctIndex: typeof msg.correctIndex === "number" ? msg.correctIndex : -1,
        explanation: typeof msg.explanation === "string" ? msg.explanation : "",
        ...(typeof msg.for === "string" ? { for: msg.for } : {}),
      });
      return;
    }
    if (topic === "aulaquipu:control" && msg.type === "wrap_up_done") {
      this.emit({ type: "wrap_up_done", actor, ok: msg.ok === true });
      return;
    }
    if (topic === "aulaquipu:emote" && msg.type === "emote") {
      const kind = msg.kind as TutorEmote;
      if (kind === "celebrate" || kind === "think" || kind === "surprised" || kind === "encourage") this.emit({ type: "emote", actor, kind });
      return;
    }
    if (topic === "aulaquipu:graph" && msg.type === "graph_op" && typeof msg.id === "string") {
      if (msg.op === "set" && typeof msg.latex === "string") {
        this.emit({ type: "focus_tool", actor, tool: "graph" });
        this.emit({ type: "graph_set", actor, id: msg.id, latex: msg.latex, color: typeof msg.color === "string" ? msg.color : undefined });
      } else if (msg.op === "remove") {
        this.emit({ type: "graph_remove", actor, id: msg.id });
      }
      return;
    }
  };

  private onSpeakers = (speakers: Participant[]) => {
    const now = new Set(speakers.map((p) => this.actorOf(p)));
    for (const actor of now) if (!this.speaking.has(actor)) this.emit({ type: "speaking", actor, on: true });
    for (const actor of this.speaking) if (!now.has(actor)) this.emit({ type: "speaking", actor, on: false });
    this.speaking = now;
  };

  // Texto acumulado por segmento: LiveKit manda un segmento en varios streams (palabra a palabra)
  private segments = new Map<string, string>();

  private async onTranscription(
    reader: Parameters<Parameters<Room["registerTextStreamHandler"]>[1]>[0],
    identity: string,
  ) {
    const attrs = reader.info.attributes ?? {};
    const trackId = attrs["lk.transcribed_track_id"];
    const segment = attrs["lk.segment_id"] || reader.info.id;
    const local = this.room.localParticipant;
    // El agente transcribe al alumno publicando en nombre de su pista de micrófono
    const isMine =
      identity === local.identity || (!!trackId && [...local.trackPublications.values()].some((t) => t.trackSid === trackId));
    const speaker = this.participant(identity);
    const actor = isMine ? local.identity : this.actorOf(speaker, identity);
    let text = this.segments.get(segment) ?? "";
    try {
      for await (const chunk of reader) {
        text += chunk;
        this.segments.set(segment, text);
        if (!isMine) this.emit({ type: "speech", actor, text, partial: true, segment });
      }
    } catch {
      // stream cortado: se usa lo recibido
    }
    const final = attrs["lk.transcription_final"] === "true";
    if (final) this.segments.delete(segment);
    if (this.segments.size > 200) this.segments.clear();
    if (!text.trim()) return;
    if (isMine) {
      if (final) this.emit({ type: "chat", actor, name: `${this.myName} (voz)`, text });
    } else this.emit({ type: "speech", actor, text, segment });
  }
}
