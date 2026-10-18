// Búsqueda segura de imágenes educativas en Wikimedia Commons (solo servidor).
// Solo se aceptan URLs de upload.wikimedia.org en png/jpeg/svg y se descartan títulos inadecuados.

const COMMONS_API = "https://commons.wikimedia.org/w/api.php";
const USER_AGENT = "AulaQuipu/1.0 (educational tutoring app; https://aulaquipu.pe)";
const TIMEOUT_MS = 6000;
const ALLOWED_MIME = new Set(["image/png", "image/jpeg", "image/svg+xml"]);
const IMAGE_HOST = "upload.wikimedia.org";
const UNSAFE_TITLE =
  /\b(nud[eo]s?|naked|sex\w*|porn\w*|erotic\w*|nsfw|genital\w*|penis|vagina\w*|breasts?|gore|corpses?|cadaver\w*|dead body|suicide|nazi\w*|swastika|hitler|bondage|fetish\w*|lingerie|bikini)\b/i;

export interface FoundImage {
  url: string;
  caption: string;
  credit: string;
}

interface CommonsPage {
  title?: string;
  index?: number;
  imageinfo?: { url?: string; thumburl?: string; mime?: string; extmetadata?: Record<string, { value?: string } | undefined> }[];
}

const stripHtml = (html: string) =>
  html
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

function onWikimedia(u: string | undefined): u is string {
  if (!u) return false;
  try {
    const url = new URL(u);
    return url.protocol === "https:" && url.hostname === IMAGE_HOST;
  } catch {
    return false;
  }
}

export async function searchCommons(query: string): Promise<FoundImage | null> {
  if (UNSAFE_TITLE.test(query)) return null;
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    generator: "search",
    gsrnamespace: "6",
    gsrlimit: "8",
    gsrsearch: query,
    prop: "imageinfo",
    iiprop: "url|extmetadata|mime",
    iiurlwidth: "800",
    origin: "*",
  });
  const res = await fetch(`${COMMONS_API}?${params}`, {
    headers: { "User-Agent": USER_AGENT, "Api-User-Agent": USER_AGENT, Accept: "application/json" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { query?: { pages?: Record<string, CommonsPage> } };
  const pages = Object.values(data.query?.pages ?? {}).sort((a, b) => (a.index ?? 99) - (b.index ?? 99));
  for (const page of pages) {
    const info = page.imageinfo?.[0];
    const title = page.title ?? "";
    if (!info?.mime || !ALLOWED_MIME.has(info.mime) || UNSAFE_TITLE.test(title)) continue;
    const url = onWikimedia(info.thumburl) ? info.thumburl : onWikimedia(info.url) ? info.url : null;
    if (!url) continue;
    const artist = stripHtml(info.extmetadata?.Artist?.value ?? "").slice(0, 100);
    const license = stripHtml(info.extmetadata?.LicenseShortName?.value ?? "").slice(0, 40);
    const caption = title.replace(/^File:/i, "").replace(/\.[a-z0-9]+$/i, "").replace(/_/g, " ").slice(0, 140);
    return { url, caption, credit: [artist, license].filter(Boolean).join(", ") };
  }
  return null;
}
