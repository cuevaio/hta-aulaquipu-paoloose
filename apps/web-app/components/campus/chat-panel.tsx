"use client";

import { useEffect, useRef, useState } from "react";
import { Ban, MessageCircle, Send, X } from "lucide-react";
import { CHAT_MAX_LENGTH } from "@/lib/campus/chat-rules";
import type { useCampusChat } from "@/lib/campus/use-campus-chat";
import { cn } from "@/lib/utils";

type Chat = ReturnType<typeof useCampusChat>;

/** Chat de proximidad: apagado por defecto, con registro reciente, bloqueo por persona y aviso de quién te escucha. */
export function ChatPanel({ chat }: { chat: Chat }) {
  const { enabled, setEnabled, online, log, hearers, blocked, block, unblock, send } = chat;
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const logEnd = useRef<HTMLDivElement>(null);
  const blockedList = Object.entries(blocked);

  useEffect(() => {
    logEnd.current?.scrollIntoView({ block: "end" });
  }, [log, open]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const err = send(text);
    setError(err);
    if (!err) setText("");
  };

  if (!open)
    return (
      <button
        onClick={() => setOpen(true)}
        aria-label="Abrir el chat del campus"
        className="absolute right-3 bottom-24 z-[56] flex items-center gap-2 rounded-2xl bg-navy/90 px-4 py-3 text-sm font-bold text-white shadow-xl backdrop-blur hover:bg-navy"
      >
        <MessageCircle className="size-5" /> Chat
        {enabled && online && <span className="size-2 rounded-full bg-mint" aria-label="activado" />}
      </button>
    );

  return (
    <section
      aria-label="Chat del campus"
      className="absolute right-3 bottom-24 z-[56] flex w-[min(20rem,calc(100vw-1.5rem))] flex-col gap-2 rounded-2xl bg-navy/95 p-3 text-white shadow-2xl backdrop-blur animate-in fade-in slide-in-from-bottom-2"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-sm font-extrabold">
          <MessageCircle className="size-4" /> Chat cercano
        </h2>
        <div className="flex items-center gap-1">
          <button
            role="switch"
            aria-checked={enabled}
            disabled={!online}
            onClick={() => setEnabled(!enabled)}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-extrabold transition-colors disabled:opacity-50",
              enabled ? "bg-mint text-navy" : "bg-white/15 text-white hover:bg-white/25",
            )}
          >
            {enabled ? "Activado" : "Desactivado"}
          </button>
          <button onClick={() => setOpen(false)} aria-label="Cerrar el chat" className="grid size-8 place-items-center rounded-full hover:bg-white/15">
            <X className="size-4" />
          </button>
        </div>
      </div>

      {!online ? (
        <p className="rounded-xl bg-white/10 px-3 py-2 text-xs font-semibold">Chat disponible solo en línea</p>
      ) : !enabled ? (
        <div className="space-y-1.5 rounded-xl bg-white/10 px-3 py-2 text-xs font-semibold">
          <p>Activa el chat para hablar con quien esté cerca.</p>
          <p className="text-white/70">
            Solo te lee quien esté en tu misma sala, a pocos pasos y con el chat activado. Sin enlaces ni datos personales.
          </p>
        </div>
      ) : (
        <>
          <p className="text-xs font-bold text-white/80" aria-live="polite">
            {hearers.length ? `Te escuchan: ${hearers.join(", ")}` : "Nadie cerca"}
          </p>
          <ul className="max-h-40 min-h-12 space-y-1 overflow-y-auto rounded-xl bg-white/10 p-2 text-sm">
            {log.length === 0 && <li className="text-xs text-white/60">Aún no hay mensajes.</li>}
            {log.map((l) => (
              <li key={l.id} className="flex items-start gap-1.5 leading-snug">
                <span className="min-w-0 flex-1 break-words">
                  <b className={l.from === "me" ? "text-mint" : "text-gold"}>{l.name}:</b> {l.text}
                </span>
                {l.from !== "me" && (
                  <button
                    onClick={() => block(l.from, l.name)}
                    aria-label={`Bloquear a ${l.name}`}
                    title={`Bloquear a ${l.name}`}
                    className="grid size-7 shrink-0 place-items-center rounded-full text-white/60 hover:bg-white/15 hover:text-white"
                  >
                    <Ban className="size-3.5" />
                  </button>
                )}
              </li>
            ))}
            <div ref={logEnd} />
          </ul>

          <form onSubmit={submit} className="flex gap-2">
            <input
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                setError(null);
              }}
              onKeyDown={(e) => {
                // Escape solo suelta el campo; el campus ignora las teclas mientras se escribe
                if (e.key === "Escape") e.currentTarget.blur();
              }}
              maxLength={CHAT_MAX_LENGTH}
              placeholder="Escribe aquí…"
              aria-label="Mensaje para quien esté cerca"
              autoComplete="off"
              className="min-w-0 flex-1 rounded-xl bg-white px-3 py-2 text-base text-navy placeholder:text-navy/50"
            />
            <button type="submit" aria-label="Enviar mensaje" disabled={!text.trim()} className="grid size-10 shrink-0 place-items-center rounded-xl bg-mint text-navy disabled:opacity-50">
              <Send className="size-4" />
            </button>
          </form>
          {error && (
            <p role="alert" className="text-xs font-bold text-coral">
              {error}
            </p>
          )}
          {blockedList.length > 0 && (
            <p className="text-xs text-white/70">
              Bloqueados:{" "}
              {blockedList.map(([id, name]) => (
                <button key={id} onClick={() => unblock(id)} className="mr-1.5 underline" title="Desbloquear">
                  {name}
                </button>
              ))}
            </p>
          )}
        </>
      )}
    </section>
  );
}
