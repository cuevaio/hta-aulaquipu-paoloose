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
