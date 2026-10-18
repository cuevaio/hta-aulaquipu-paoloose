import { ServerOptions, cli, defineAgent, voice } from '@livekit/agents';
import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { type ClassContext, createAgent } from './agent.ts';
import { memoryScope, recallBrief, remember } from './memory.ts';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '../../.env' });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;

const encoder = new TextEncoder();

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
    };
  } catch {
    return { tutorName: 'Quipu', style: '', focus: '', topic: '', studentName: '', guide: '', studentId: '' };
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
      if (!local) return;
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
    };
    const memoryBrief = await hooks.recall(
      klass.topic
        ? `progreso del alumno en ${klass.topic}`
        : 'progreso del alumno y temas vistos en clases anteriores',
    );

    await session.start({
      agent: createAgent(hooks, klass, memoryBrief),
      room: ctx.room,
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
