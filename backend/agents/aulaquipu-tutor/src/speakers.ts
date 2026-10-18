// Clase compartida: varios alumnos hablan con el mismo tutor de voz. El agente escucha a una
// persona a la vez (RoomIO), así que se cambia a quien está hablando y se le dice al modelo
// quién es, para que responda a cada uno por su nombre.

export interface Speaker {
  identity: string;
  name: string;
  isAgent: boolean;
}

/**
 * A quién pasar a escuchar, o null para seguir igual. Se cambia solo si la persona que se escucha
 * ya no está hablando y otra sí (así no se le corta la frase a nadie). `speakers` viene ordenado
 * de más a menos fuerte, como lo entrega LiveKit.
 */
export function nextSpeaker(speakers: Speaker[], linked: string | null): Speaker | null {
  const humans = speakers.filter((s) => !s.isAgent && s.identity.startsWith('profile:'));
  const top = humans[0];
  if (!top) return null;
  if (linked && humans.some((h) => h.identity === linked)) return null;
  return top;
}

/** Nota para el modelo cuando cambia quien habla (no le pide responder, solo le informa). */
export function speakerNote(name: string): string {
  return `Ahora te habla ${name}. Cuando respondas, dirígete a ${name} por su nombre.`;
}

interface SwitcherOptions {
  /** A quién se escucha ahora (identidad), o null. */
  linked: () => string | null;
  /** El tutor está hablando: no se cambia (se le cortaría a otro alumno o se interrumpiría). */
  agentSpeaking: () => boolean;
  onSwitch: (s: Speaker) => void;
  /** Cuánto debe seguir hablando el nuevo antes de pasar a escucharlo (evita ruidos y toses). */
  settleMs?: number;
  /** Mínimo entre dos cambios: cambiar seguido hace perder el inicio de cada frase. */
  minGapMs?: number;
  now?: () => number;
  schedule?: (fn: () => void, ms: number) => unknown;
  cancel?: (handle: unknown) => void;
}

/**
 * Decide con calma a quién escuchar en una clase compartida: recibe cada cambio de quién habla
 * (ActiveSpeakersChanged) y solo cambia cuando la persona nueva sigue hablando un momento, quien se
 * escuchaba calló, el tutor no está hablando y pasó un rato desde el último cambio.
 */
export class SpeakerSwitcher {
  private latest: Speaker[] = [];
  private lastSwitch = Number.NEGATIVE_INFINITY;
  private timer: unknown = null;
  private readonly o: Required<SwitcherOptions>;

  constructor(opts: SwitcherOptions) {
    this.o = {
      settleMs: 600,
      minGapMs: 2500,
      now: () => Date.now(),
      schedule: (fn, ms) => setTimeout(fn, ms),
      cancel: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
      ...opts,
    };
  }

  update(speakers: Speaker[]) {
    this.latest = speakers;
    const pick = nextSpeaker(speakers, this.o.linked());
    this.clear();
    if (pick) this.timer = this.o.schedule(() => this.check(pick.identity), this.o.settleMs);
  }

  private check(identity: string) {
    this.timer = null;
    const pick = nextSpeaker(this.latest, this.o.linked());
    if (!pick || pick.identity !== identity) return;
    const wait = this.lastSwitch + this.o.minGapMs - this.o.now();
    if (wait > 0 || this.o.agentSpeaking()) {
      // Se vuelve a mirar en un rato: si para entonces sigue hablando, se le escucha
      this.timer = this.o.schedule(() => this.check(identity), Math.max(wait, 400));
      return;
    }
    this.lastSwitch = this.o.now();
    this.o.onSwitch(pick);
  }

  private clear() {
    if (this.timer !== null) this.o.cancel(this.timer);
    this.timer = null;
  }

  dispose() {
    this.clear();
  }
}
