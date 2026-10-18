import type { ClassroomEvent } from "@/lib/classroom/events";

export interface ClassroomTransport {
  readonly kind: "local" | "livekit";
  /** Aplica el evento localmente y lo envía a los demás. */
  send(event: ClassroomEvent): void;
  /** Solo lo envía a los demás (el llamador ya actualizó su estado). */
  publish(event: ClassroomEvent): void;
  subscribe(fn: (event: ClassroomEvent) => void): () => void;
  close(): void;
}

/**
 * Bus en memoria: todos los participantes viven en esta pestaña (tú + tutor IA simulado).
 * Se usa cuando el servidor no tiene LiveKit configurado; la versión en vivo está en
 * livekit-transport.ts y entrega el mismo ClassroomEvent.
 */
export class LocalTransport implements ClassroomTransport {
  readonly kind = "local" as const;
  private listeners = new Set<(event: ClassroomEvent) => void>();

  send(event: ClassroomEvent) {
    // Asíncrono, igual que una red real: evita reentradas durante el render
    queueMicrotask(() => this.listeners.forEach((fn) => fn(event)));
  }

  publish() {
    // En modo local no hay nadie más en la sala
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
