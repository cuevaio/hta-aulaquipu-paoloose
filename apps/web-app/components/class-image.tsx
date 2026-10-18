"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { isAllowedImageSrc } from "@/lib/image-hosts";

/**
 * Imagen del documento de clase: nunca más ancha que la columna ni más alta que ~280 px, centrada, y
 * se agranda al tocarla. Solo hosts permitidos; el resto (el alumno edita el documento) queda bloqueado.
 * Usa solo <span> porque react-markdown la deja dentro de un <p>.
 */
export function ClassImage({ src, alt }: { src?: string | Blob; alt?: string }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (typeof src !== "string" || !isAllowedImageSrc(src)) {
    return <span className="inline-block rounded-md bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">[imagen bloqueada]</span>;
  }
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="my-2 flex w-full cursor-zoom-in justify-center"
        aria-label={alt ? `Ampliar imagen: ${alt}` : "Ampliar imagen"}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- imagen externa de un host permitido */}
        <img src={src} alt={alt ?? ""} loading="lazy" referrerPolicy="no-referrer" className="h-auto max-h-[280px] w-auto max-w-full rounded-xl object-contain" />
      </button>
      {open &&
        createPortal(
          <span
            role="dialog"
            aria-modal
            aria-label={alt || "Imagen ampliada"}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          >
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="absolute right-4 top-4 grid size-10 place-items-center rounded-full bg-white/15 text-white hover:bg-white/25"
              aria-label="Cerrar imagen"
            >
              <X className="size-5" />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element -- imagen externa de un host permitido */}
            <img src={src} alt={alt ?? ""} referrerPolicy="no-referrer" className="max-h-full max-w-full rounded-xl bg-white object-contain" onClick={(e) => e.stopPropagation()} />
          </span>,
          document.body,
        )}
    </>
  );
}
