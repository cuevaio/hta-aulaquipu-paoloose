import { ServerOptions, cli, defineAgent, voice } from '@livekit/agents';
import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { createAgent } from './agent.ts';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '../.env' });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;

const encoder = new TextEncoder();

function sessionIdFromRoom(roomName: string | undefined): string | null {
  const match = /^session-([0-9a-fA-F-]{36})$/.exec(roomName ?? '');
  return match ? match[1] : null;
}

export default defineAgent({
  entry: async (ctx) => {
    const sessionId = sessionIdFromRoom(ctx.room.name);

    const publish = async (msg: Record<string, unknown>, topic: string) => {
      await ctx.room.localParticipant.publishData(encoder.encode(JSON.stringify(msg)), {
        reliable: true,
        topic,
      });
    };

    const logEvent = async (kind: string, payload: Record<string, unknown>) => {
      if (!SUPABASE_URL || !SUPABASE_SECRET_KEY || !sessionId) return;
      try {
        await fetch(`${SUPABASE_URL}/rest/v1/session_events`, {
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
      } catch (err) {
        console.warn('no se pudo registrar session_event', err);
      }
    };

    const session = new voice.AgentSession({});

    await session.start({
      agent: createAgent({ publish, logEvent }),
      room: ctx.room,
    });

    await ctx.connect();
    await logEvent('join', { name: 'Quipu' });

    session.generateReply({
      instructions:
        'Saluda como Quipu al alumno y pregunta qué tema quiere trabajar hoy. Sé breve y cercano.',
    });
  },
});

cli.runApp(
  new ServerOptions({
    agent: fileURLToPath(import.meta.url),
    agentName: 'aulaquipu-tutor',
  }),
);
