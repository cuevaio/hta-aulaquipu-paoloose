// El documento de clase es editable por el alumno: solo se muestran imágenes de orígenes de confianza.

const WIKIMEDIA = "upload.wikimedia.org";

function supabaseHost(): string | null {
  try {
    return process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname : null;
  } catch {
    return null;
  }
}

/** true si la imagen puede mostrarse: https en un host permitido, o ruta del mismo origen. */
export function isAllowedImageSrc(src: string | undefined | null): boolean {
  if (!src) return false;
  // Ruta del mismo origen ("/x.png"); "//host" y "/\\host" son rutas con esquema implícito
  if (src.startsWith("/")) return !/^\/[/\\]/.test(src);
  let url: URL;
  try {
    url = new URL(src);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" || url.username || url.password) return false;
  const host = url.hostname.toLowerCase();
  return host === WIKIMEDIA || host === supabaseHost();
}
