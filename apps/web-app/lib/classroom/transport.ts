import type { ClassroomEvent } from "@/lib/classroom/events";

export interface ClassroomTransport {
  readonly kind: "local" | "livekit";
  send(event: ClassroomEvent): void;
  subscribe(fn: (event: ClassroomEvent) => void): () => void;
  close(): void;
}

/**
 * Bus en memoria: todos los participantes viven en esta pestaña (tú + tutor IA simulado).
 * La versión LiveKit hará `room.localParticipant.publishData(JSON)` en send() y
 * escuchará `RoomEvent.DataReceived` en subscribe(), con el mismo ClassroomEvent.
 */
export class LocalTransport implements ClassroomTransport {
  readonly kind = "local" as const;
  private listeners = new Set<(event: ClassroomEvent) => void>();

  send(event: ClassroomEvent) {
    // Asíncrono, igual que una red real: evita reentradas durante el render
    queueMicrotask(() => this.listeners.forEach((fn) => fn(event)));
  }

  subscribe(fn: (event: ClassroomEvent) => void) {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  close() {
    this.listeners.clear();
  }
}
