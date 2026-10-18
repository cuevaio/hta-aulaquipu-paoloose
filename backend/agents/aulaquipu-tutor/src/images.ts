// Imágenes educativas para el documento de la clase: primero el banco del tema (admin) y,
// si no hay, Wikimedia Commons. Todo corre en el proceso del agente, nunca en el navegador.

export type ClassImage = {
  url: string;
  caption: string;
  /** Crédito y licencia para mostrar bajo la imagen (vacío si no hay) */
  credit: string;
  source: 'bank' | 'wikimedia';
};

type FetchLike = typeof fetch;

export const COMMONS_API = 'https://commons.wikimedia.org/w/api.php';
export const COMMONS_USER_AGENT = 'AulaQuipuTutor/1.0 (educational tutoring app; https://aulaquipu.pe)';
const COMMONS_TIMEOUT_MS = 6_000;
const ALLOWED_MIME = new Set(['image/png', 'image/jpeg', 'image/svg+xml']);
const IMAGE_HOST = 'upload.wikimedia.org';

// Palabras que descartan un resultado por el título (público: secundaria)
const UNSAFE_TITLE = /\b(nud[eo]s?|naked|sex\w*|porn\w*|erotic\w*|nsfw|genital\w*|penis|vagina\w*|breasts?|gore|corpses?|cadaver\w*|dead body|suicide|nazi\w*|swastika|hitler|bondage|fetish\w*|lingerie|bikini)\b/i;

function words(text: string): string[] {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 3);
}

/** Mejor imagen del banco por coincidencia simple de palabras; la primera si ninguna coincide. */
export function pickBankImage(
  bank: Array<{ url: string; caption: string; credit: string }>,
  query: string,
  caption: string | undefined,
  exclude: ReadonlySet<string> = new Set(),
): ClassImage | null {
  const wanted = new Set(words(`${query} ${caption ?? ''}`));
  let best: { img: (typeof bank)[number]; score: number } | null = null;
  for (const img of bank) {
    if (!/^https:\/\//.test(img.url) || exclude.has(img.url)) continue;
    const score = words(img.caption).filter((w) => wanted.has(w)).length;
    if (!best || score > best.score) best = { img, score };
  }
  return best ? { url: best.img.url, caption: best.img.caption, credit: best.img.credit, source: 'bank' } : null;
}

/** Imágenes del banco del tema vía REST de Supabase; cualquier fallo (p. ej. sin migración 004) = vacío. */
export async function fetchTopicImages(
  cfg: { url?: string | undefined; key?: string | undefined },
  topicId: string,
  fetchImpl: FetchLike = fetch,
): Promise<Array<{ url: string; caption: string; credit: string }>> {
  if (!cfg.url || !cfg.key || !/^[0-9a-fA-F-]{36}$/.test(topicId)) return [];
  try {
    const res = await fetchImpl(
      `${cfg.url}/rest/v1/topic_images?topic_id=eq.${topicId}&select=url,caption,credit&order=created_at&limit=50`,
      { headers: { apikey: cfg.key, Authorization: `Bearer ${cfg.key}` }, signal: AbortSignal.timeout(4_000) },
    );
    if (!res.ok) return [];
    const rows = (await res.json()) as unknown;
    if (!Array.isArray(rows)) return [];
    return rows.flatMap((r) =>
      r && typeof r.url === 'string' && typeof r.caption === 'string'
        ? [{ url: r.url, caption: r.caption, credit: typeof r.credit === 'string' ? r.credit : '' }]
        : [],
    );
  } catch {
    return [];
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

type CommonsPage = {
  title?: string;
  index?: number;
  imageinfo?: Array<{
    url?: string;
    thumburl?: string;
    mime?: string;
    extmetadata?: Record<string, { value?: string } | undefined>;
  }>;
};

function onWikimedia(u: string | undefined): u is string {
  if (!u) return false;
  try {
    const url = new URL(u);
    return url.protocol === 'https:' && url.hostname === IMAGE_HOST;
  } catch {
    return false;
  }
}

/** Busca en Wikimedia Commons y devuelve el primer resultado seguro, o null. */
export async function searchCommons(
  query: string,
  caption: string | undefined,
  fetchImpl: FetchLike = fetch,
  exclude: ReadonlySet<string> = new Set(),
): Promise<ClassImage | null> {
  if (UNSAFE_TITLE.test(query)) return null;
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    generator: 'search',
    gsrnamespace: '6',
    gsrlimit: '8',
    gsrsearch: query,
    prop: 'imageinfo',
    iiprop: 'url|extmetadata|mime',
    iiurlwidth: '800',
    origin: '*',
  });
  const res = await fetchImpl(`${COMMONS_API}?${params}`, {
    headers: { 'User-Agent': COMMONS_USER_AGENT, 'Api-User-Agent': COMMONS_USER_AGENT, Accept: 'application/json' },
    signal: AbortSignal.timeout(COMMONS_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Wikimedia respondió ${res.status}`);
  const data = (await res.json()) as { query?: { pages?: Record<string, CommonsPage> } };
  const pages = Object.values(data.query?.pages ?? {}).sort((a, b) => (a.index ?? 99) - (b.index ?? 99));
  for (const page of pages) {
    const info = page.imageinfo?.[0];
    const title = page.title ?? '';
    if (!info || !info.mime || !ALLOWED_MIME.has(info.mime) || UNSAFE_TITLE.test(title)) continue;
    const url = onWikimedia(info.thumburl) ? info.thumburl : onWikimedia(info.url) ? info.url : null;
    if (!url || exclude.has(url)) continue;
    const artist = stripHtml(info.extmetadata?.Artist?.value ?? '').slice(0, 100);
    const license = stripHtml(info.extmetadata?.LicenseShortName?.value ?? '').slice(0, 40);
    const credit = [artist, license].filter(Boolean).join(', ');
    const fallbackCaption = title.replace(/^File:/i, '').replace(/\.[a-z0-9]+$/i, '').replace(/_/g, ' ');
    return { url, caption: (caption?.trim() || fallbackCaption).slice(0, 140), credit, source: 'wikimedia' };
  }
  return null;
}

/** Markdown seguro para el documento: sin corchetes ni paréntesis que rompan la sintaxis. */
export function imageMarkdown(img: ClassImage): string {
  const clean = (t: string) => t.replace(/[[\]()<>*_`\n\r]/g, ' ').replace(/\s+/g, ' ').trim();
  const url = img.url.replace(/\(/g, '%28').replace(/\)/g, '%29').replace(/\s/g, '%20');
  const lines = [`![${clean(img.caption)}](${url})`];
  const credit = clean(img.credit);
  const from = img.source === 'wikimedia' ? 'Wikimedia Commons' : '';
  const line = [credit, from].filter(Boolean).join(' · ');
  if (line) lines.push(`*Imagen: ${line}*`);
  return lines.join('\n\n');
}
