// Nombre corto de un tema nuevo a partir de lo que escribió el alumno ("se me dificultan las
// multiplicaciones de fracciones" → "multiplicaciones de fracciones"). Lo usan el servidor y el modo demo.

const MAX_LENGTH = 40;

const OPENINGS =
  /^(hola[,!]?\s+)?(no entiendo|no comprendo|no puedo con|no s[eé]|necesito ayuda con|necesito|quiero aprender|quiero entender|ayuda con|ay[uú]dame con|me cuesta|me traba|me trabo con|se me dificulta(n)?|se me complica(n)?|tengo problemas con|tengo dificultad(es)? con|tengo dudas (de|sobre|con))\s+/i;
const ARTICLES = /^(lo de |lo que es |las |los |el |la |sobre |de |del )+/i;
// Palabras que no pueden cerrar un nombre: si el corte las deja al final, se quitan
const DANGLING = /\s+(de|del|la|las|el|los|un|una|con|y|e|o|en|a|al|para|por|que|lo|sobre)$/i;

export function cleanTopicName(text: string): string {
  let name = text
    .replace(/[.?!¿¡,;:]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .replace(OPENINGS, "")
    .replace(ARTICLES, "")
    .trim();

  if (name.length > MAX_LENGTH) {
    // Corta en el último espacio que quepa, para no dejar palabras a medias
    const cut = name.slice(0, MAX_LENGTH + 1);
    const space = cut.lastIndexOf(" ");
    name = (space > 12 ? cut.slice(0, space) : name.slice(0, MAX_LENGTH)).trim();
  }
  while (DANGLING.test(name)) name = name.replace(DANGLING, "");
  return name || "tema nuevo";
}
