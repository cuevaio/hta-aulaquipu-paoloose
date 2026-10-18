import { ServerOptions, cli, defineAgent, inference, llm, voice } from '@livekit/agents';
import { ParticipantKind, RoomEvent } from '@livekit/rtc-node';
import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import {
  type ClassContext,
  createAgent,
  createQuizBook,
  handleQuizAnswer,
  wrapUpClass,
  watchDelegations,
} from './agent.ts';
import { fetchTopicImages } from './images.ts';
import { memoryScope, recallBrief, remember } from './memory.ts';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '../../.env' });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function sessionIdFromRoom(roomName: string | undefined): string | null {
  const match = /^session-([0-9a-fA-F-]{36})$/.exec(roomName ?? '');
  return match?.[1] ?? null;
}

// La web app despacha al agente con metadata JSON: tutor elegido, tema y alumno.
function classContextFrom(metadata: string | undefined): ClassContext {
  try {
    const raw = JSON.parse(metadata || '{}') as Partial<ClassContext>;
    return {
      tutorName: typeof raw.tutorName === 'string' && raw.tutorName ? raw.tutorName : 'Quipu',
      style: typeof raw.style === 'string' ? raw.style : '',
      focus: typeof raw.focus === 'string' ? raw.focus : '',
      topic: typeof raw.topic === 'string' ? raw.topic : '',
      studentName: typeof raw.studentName === 'string' ? raw.studentName : '',
      // Tope defensivo: la web ya la recorta, pero el metadata viene de fuera del proceso
      guide: typeof raw.guide === 'string' ? raw.guide.trim().slice(0, 4500) : '',
      studentId: typeof raw.studentId === 'string' ? raw.studentId : '',
      topicId: typeof raw.topicId === 'string' ? raw.topicId : '',
    };
  } catch {
    return { tutorName: 'Quipu', style: '', focus: '', topic: '', studentName: '', guide: '', studentId: '', topicId: '' };
  }
}

export default defineAgent({
  entry: async (ctx) => {
    // El nombre de la sala viene en el job: ctx.room.name sigue vacío hasta ctx.connect()
    const sessionId = sessionIdFromRoom(ctx.job.room?.name ?? ctx.room.name);
    const klass = classContextFrom(ctx.job.metadata);
    // Una línea por sesión, sin volcar el contenido de la guía
    console.log(
      `[tutor] sesión ${sessionId ?? '?'}: guía del tema ${klass.guide ? `aplicada (${klass.guide.length} caracteres)` : 'no definida'}`,
    );

    const publish = async (msg: Record<string, unknown>, topic: string) => {
      const local = ctx.room.localParticipant;
      // Falla en voz alta: si no sale, la herramienta debe devolver ERROR y no un falso "OK"
      if (!local) throw new Error('la sala no está disponible');
      await local.publishData(encoder.encode(JSON.stringify(msg)), {
        reliable: true,
        topic,
      });
    };

    const logEvent = async (kind: string, payload: Record<string, unknown>) => {
      if (!SUPABASE_URL || !SUPABASE_SECRET_KEY || !sessionId) return;
      try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/session_events`, {
          method: 'POST',
          headers: {
            apikey: SUPABASE_SECRET_KEY,
            Authorization: `Bearer ${SUPABASE_SECRET_KEY}`,
            'Content-Type': 'application/json',
            Prefer: 'return=minimal',
          },
          body: JSON.stringify({
            session_id: sessionId,
            actor: 'ai:aulaquipu-tutor',
            kind,
            payload,
          }),
        });
        if (!res.ok) {
          console.warn(
            'no se pudo registrar session_event',
            res.status,
            (await res.text()).slice(0, 300),
          );
        }
      } catch (err) {
        console.warn('no se pudo registrar session_event', err);
      }
    };

    const session = new voice.AgentSession({});

    const scope = memoryScope(klass.studentId, sessionId ?? '');
    const hooks = {
      publish,
      logEvent,
      remember: (content: string) => remember(scope, content),
      recall: (query: string) => recallBrief(scope, query),
      topicImages: () => fetchTopicImages({ url: SUPABASE_URL, key: SUPABASE_SECRET_KEY }, klass.topicId),
    };
    const memoryBrief = await hooks.recall(
      klass.topic
        ? `progreso del alumno en ${klass.topic}`
        : 'progreso del alumno y temas vistos en clases anteriores',
    );

    const quizzes = createQuizBook();
    const agent = createAgent(hooks, klass, memoryBrief, quizzes);
    await session.start({ agent, room: ctx.room });

    // Si el modelo de respaldo termina sin llamar herramientas, se registra y el tutor lo dice
    try {
      watchDelegations(agent.duplexSession as unknown as Parameters<typeof watchDelegations>[0], hooks);
    } catch (err) {
      console.warn('no se pudo vigilar la delegación', err);
    }

    // Transcripción corrida de la clase, para el resumen de cierre
    const transcript: string[] = [];
    session.on(voice.AgentSessionEventTypes.ConversationItemAdded, (ev) => {
      const item = ev.item;
      if (item.type !== 'message' || !item.textContent) return;
      transcript.push(`${item.role === 'user' ? 'Alumno' : klass.tutorName}: ${item.textContent.slice(0, 400)}`);
      if (transcript.length > 80) transcript.shift();
    });
    const generateSummary = async (prompt: string) => {
      const model = new inference.LLM({ model: 'openai/gpt-4.1-mini' });
      try {
        const chatCtx = llm.ChatContext.empty();
        chatCtx.addMessage({ role: 'user', content: prompt });
        return (await model.chat({ chatCtx }).collect()).text;
      } finally {
        await model.aclose();
      }
    };
    let wrappingUp = false;

    // Mensajes del alumno al agente: respuestas a las tarjetas de quiz y cierre de clase
    ctx.room.on(RoomEvent.DataReceived, (payload, participant, _kind, topic) => {
      if (!participant || participant.kind === ParticipantKind.AGENT) return;
      let msg: { type?: unknown; id?: unknown; index?: unknown; doc?: unknown };
      try {
        msg = JSON.parse(decoder.decode(payload));
      } catch {
        return;
      }
      if (topic === 'aulaquipu:quiz-answer' && msg.type === 'quiz_answer') {
        if (typeof msg.id !== 'string' || typeof msg.index !== 'number') return;
        void handleQuizAnswer(hooks, quizzes, { id: msg.id, index: msg.index }).then((prompt) => {
          // El tutor de voz reacciona: felicita o anima y explica
          if (prompt) session.generateReply({ instructions: prompt });
        });
      } else if (topic === 'aulaquipu:control' && msg.type === 'wrap_up' && !wrappingUp) {
        wrappingUp = true;
        void wrapUpClass(hooks, generateSummary, {
          transcript: transcript.join('\n'),
          doc: typeof msg.doc === 'string' ? msg.doc.slice(0, 12000) : '',
          topic: klass.topic,
          studentName: klass.studentName,
        }).finally(() => {
          wrappingUp = false;
        });
      }
    });

    await ctx.connect();
    await logEvent('join', { name: klass.tutorName, guide: !!klass.guide });

    const who = klass.studentName ? ` a ${klass.studentName}` : ' al alumno';
    session.generateReply({
      instructions: klass.topic
        ? `Saluda como ${klass.tutorName}${who}, di que hoy trabajarán ${klass.topic} y haz tu primera pregunta de diagnóstico. Sé breve y cercano.`
        : `Saluda como ${klass.tutorName}${who} y pregunta qué tema quiere trabajar hoy. Sé breve y cercano.`,
    });
  },
});

cli.runApp(
  new ServerOptions({
    agent: fileURLToPath(import.meta.url),
    agentName: 'aulaquipu-tutor',
  }),
);
