// Mapa del campus 2D (estilo gather), armado como un colegio. Todo en unidades de baldosa; la posición de una
// persona es el centro de su cuerpo (p. ej. 20.5, 14.5 = centro de la baldosa 20,14).

export const COLS = 40;
export const ROWS = 30;

export type Floor = "#" | "g" | "p" | "b" | "i" | "t" | "a" | "s" | "q" | "w" | "e" | "c";

export interface Room {
  id: string;
  name: string;
  subtitle?: string;
  emoji: string;
  x: number;
  y: number;
  w: number;
  h: number;
  floor: Floor;
}

// Un colegio: entras por la portería, el pasillo tiene una puerta por cada clase tuya,
// y cada sala sirve para una sola cosa.
export const ROOMS: Room[] = [
  { id: "biblioteca", name: "Biblioteca", subtitle: "Aquí pides ayuda", emoji: "📚", x: 1, y: 1, w: 12, h: 8, floor: "b" },
  { id: "laboratorio", name: "Laboratorio IA", subtitle: "Clases con tutores IA, al toque", emoji: "✨", x: 14, y: 1, w: 12, h: 8, floor: "i" },
  { id: "profesores", name: "Sala de profesores", subtitle: "Aquí enseñas y ganas quipus", emoji: "🎓", x: 27, y: 1, w: 12, h: 8, floor: "t" },
  { id: "patio", name: "Patio", subtitle: "Encuentra a tus compañeros", emoji: "⛲", x: 1, y: 10, w: 38, h: 6, floor: "p" },
  { id: "pasillo", name: "Pasillo de aulas", subtitle: "Cada puerta es una de tus clases", emoji: "🚪", x: 1, y: 17, w: 25, h: 6, floor: "a" },
  { id: "tesoreria", name: "Tesorería", subtitle: "Tu tarjeta y tus ahorros", emoji: "🏦", x: 27, y: 17, w: 12, h: 6, floor: "q" },
  { id: "kiosko", name: "Kiosko", subtitle: "Skins y accesorios", emoji: "🛍️", x: 1, y: 24, w: 12, h: 5, floor: "s" },
  { id: "porteria", name: "Portería", subtitle: "Bienvenido al colegio", emoji: "🏫", x: 14, y: 24, w: 12, h: 5, floor: "e" },
  { id: "casilleros", name: "Casilleros", subtitle: "Tu perfil e insignias", emoji: "🗄️", x: 27, y: 24, w: 12, h: 5, floor: "c" },
];

/** Baldosas de pared que se abren como puerta, con el piso que llevan. */
const DOOR_TILES: { x: number; y: number; floor: Floor }[] = [
  // Salas de arriba → patio
  ...[6, 7, 19, 20, 32, 33].map((x) => ({ x, y: 9, floor: "p" as Floor })),
  // Pasillo y tesorería → patio
  ...[19, 20].map((x) => ({ x, y: 16, floor: "a" as Floor })),
  ...[32, 33].map((x) => ({ x, y: 16, floor: "q" as Floor })),
  // Kiosko y portería → pasillo
  ...[6, 7].map((x) => ({ x, y: 23, floor: "s" as Floor })),
  ...[19, 20].map((x) => ({ x, y: 23, floor: "e" as Floor })),
  // Portería → casilleros (puerta lateral)
  ...[26, 27].map((y) => ({ x: 26, y, floor: "c" as Floor })),
];

/**
 * Puertas de aula en el pasillo: se llenan con las clases del alumno (ver CampusShell),
 * empezando por las más cercanas a donde se entra al pasillo (x 19–20).
 */
export const CLASS_DOORS = [14, 22, 10, 6, 2].map((x, i) => ({ id: `door-${i}`, x, y: 17, w: 2, h: 1 }));

export type ObjectKind =
  | "shelf"
  | "kiosk"
  | "table"
  | "plant"
  | "board"
  | "rug"
  | "sofa"
  | "tree"
  | "bench"
  | "mirror"
  | "fountain"
  | "desk"
  | "counter"
  | "display"
  | "vault"
  | "locker"
  | "gate";

export interface WorldObject {
  id: string;
  kind: ObjectKind;
  x: number;
  y: number;
  w: number;
  h: number;
  emoji?: string;
  blocks: boolean;
  label?: string;
  /** Si existe, el objeto es interactivo y abre este panel. */
  href?: string;
  prompt?: string;
}

const o = (
  id: string,
  kind: ObjectKind,
  x: number,
  y: number,
  w = 1,
  h = 1,
  extra: Partial<WorldObject> = {},
): WorldObject => ({ id, kind, x, y, w, h, blocks: kind !== "rug", ...extra });

export const OBJECTS: WorldObject[] = [
  // Biblioteca: el mostrador es el único lugar para pedir ayuda
  o("lib-shelf-1", "shelf", 1, 1, 4, 1, { emoji: "📚" }),
  o("lib-shelf-2", "shelf", 9, 1, 4, 1, { emoji: "📚" }),
  o("lib-shelf-3", "shelf", 5, 1, 4, 1, { emoji: "📖" }),
  o("lib-kiosk", "kiosk", 6, 4, 2, 1, { emoji: "🙋", label: "Mostrador de ayuda", href: "/aprender", prompt: "Pedir ayuda con un tema" }),
  o("lib-table-1", "table", 2, 6, 2, 1, { emoji: "📖" }),
  o("lib-table-2", "table", 10, 6, 2, 1, { emoji: "✏️" }),
  o("lib-plant-1", "plant", 1, 8, 1, 1, { emoji: "🪴" }),
  o("lib-plant-2", "plant", 12, 8, 1, 1, { emoji: "🪴" }),

  // Laboratorio IA
  o("ia-board-1", "board", 15, 1, 3, 1, { emoji: "🧮", label: "Tutores IA", href: "/tutores-ia", prompt: "Ver los tutores IA" }),
  o("ia-board-2", "board", 22, 1, 3, 1, { emoji: "📈" }),
  o("ia-rug-1", "rug", 15, 3, 3, 3),
  o("ia-rug-2", "rug", 18, 3, 3, 3),
  o("ia-rug-3", "rug", 21, 3, 3, 3),
  o("ia-plant", "plant", 25, 8, 1, 1, { emoji: "🪴" }),

  // Sala de profesores
  o("tut-board", "board", 31, 1, 4, 1, { emoji: "📋", label: "Tablón de pedidos", href: "/ensenar", prompt: "Ver pedidos y enseñar" }),
  o("tut-sofa-1", "sofa", 28, 6, 3, 1, { emoji: "🛋️" }),
  o("tut-sofa-2", "sofa", 35, 6, 3, 1, { emoji: "🛋️" }),
  o("tut-plant-1", "plant", 27, 1, 1, 1, { emoji: "🪴" }),
  o("tut-plant-2", "plant", 38, 1, 1, 1, { emoji: "🪴" }),
  o("tut-table", "table", 32, 5, 2, 1, { emoji: "☕" }),

  // Patio: para encontrarse (sin paneles)
  o("plaza-fountain", "fountain", 18, 12, 4, 2, { emoji: "⛲" }),
  o("plaza-tree-1", "tree", 1, 10, 1, 1, { emoji: "🌳" }),
  o("plaza-tree-2", "tree", 1, 15, 1, 1, { emoji: "🌳" }),
  o("plaza-tree-3", "tree", 38, 10, 1, 1, { emoji: "🌳" }),
  o("plaza-tree-4", "tree", 38, 15, 1, 1, { emoji: "🌳" }),
  o("plaza-tree-5", "tree", 12, 12, 1, 1, { emoji: "🌲" }),
  o("plaza-tree-6", "tree", 27, 12, 1, 1, { emoji: "🌲" }),
  o("plaza-bench-1", "bench", 14, 14, 2, 1, { emoji: "🪑" }),
  o("plaza-bench-2", "bench", 24, 14, 2, 1, { emoji: "🪑" }),
  o("plaza-bench-3", "bench", 5, 12, 2, 1, { emoji: "🪑" }),
  o("plaza-bench-4", "bench", 33, 12, 2, 1, { emoji: "🪑" }),

  // Pasillo de aulas (las puertas van en CLASS_DOORS)
  o("hall-plant-1", "plant", 1, 22, 1, 1, { emoji: "🪴" }),
  o("hall-plant-2", "plant", 25, 22, 1, 1, { emoji: "🪴" }),
  o("hall-water", "display", 25, 17, 1, 1, { emoji: "🚰" }),

  // Tesorería
  o("bank-atm", "counter", 28, 17, 2, 1, { emoji: "🏧", label: "Cajero", href: "/quipus", prompt: "Ver tu tarjeta y tus ahorros" }),
  o("bank-counter", "counter", 31, 19, 4, 1, { emoji: "🏦", label: "Ventanilla", href: "/quipus", prompt: "Ver tus movimientos" }),
  o("bank-vault", "vault", 36, 17, 2, 2, { emoji: "🔐" }),
  o("bank-plant", "plant", 38, 22, 1, 1, { emoji: "🪴" }),

  // Kiosko
  o("shop-counter", "counter", 4, 26, 4, 1, { emoji: "🛒", label: "Kiosko", href: "/tienda", prompt: "Ver skins y accesorios" }),
  o("shop-d1", "display", 2, 28, 1, 1, { emoji: "👑" }),
  o("shop-d2", "display", 4, 28, 1, 1, { emoji: "🕶️" }),
  o("shop-d3", "display", 9, 28, 1, 1, { emoji: "🎧" }),
  o("shop-d4", "display", 11, 28, 1, 1, { emoji: "🎓" }),

  // Portería: la entrada al colegio
  o("gate", "gate", 19, 28, 2, 1, { emoji: "🚪" }),
  o("mural", "board", 15, 24, 3, 1, { emoji: "📣", label: "Mural de anuncios", href: "/home", prompt: "Ver tu tablero del día" }),
  o("gate-plant-1", "plant", 14, 28, 1, 1, { emoji: "🪴" }),
  o("gate-plant-2", "plant", 25, 28, 1, 1, { emoji: "🪴" }),

  // Casilleros
  o("lockers-1", "locker", 27, 24, 5, 1, { emoji: "🗄️" }),
  o("my-locker", "locker", 32, 24, 2, 1, { emoji: "🎒", label: "Tu casillero", href: "/perfil", prompt: "Ver tu perfil e insignias" }),
  o("lockers-2", "locker", 34, 24, 5, 1, { emoji: "🗄️" }),
  o("lockers-bench", "bench", 31, 27, 4, 1, { emoji: "🪑" }),
];

export const AI_SPOTS = [
  { x: 16, y: 4 },
  { x: 19, y: 4 },
  { x: 22, y: 4 },
];

/** Solo dos guías (no son alumnos): al hablarles dan un consejo, uno distinto cada vez. */
export const GUIDES = [
  {
    id: "guia-portero",
    x: 17,
    y: 26,
    name: "Don Lucho",
    role: "Portero",
    emoji: "🧓",
    color: "#FFB547",
    tips: [
      "¡Bienvenido al cole! 👋 Camina con las flechas o tocando el piso.",
      "¿Te cuesta un tema? Ve a la 📚 Biblioteca, arriba a la izquierda, y pide ayuda.",
      "Tus clases aparecen como puertas en el 🚪 Pasillo, aquí al norte.",
      "Acércate a lo que brilla y presiona X (o el botón) para usarlo.",
    ],
  },
  {
    id: "guia-patio",
    x: 9,
    y: 13,
    name: "Profe Rosa",
    role: "Coordinadora",
    emoji: "👩‍🏫",
    color: "#2FD3A3",
    tips: [
      "¿Algo se te da bien? En la 🎓 Sala de profesores enseñas y ganas quipus.",
      "Los ✨ tutores IA del Laboratorio te atienden al toque, a cualquier hora.",
      "Mira tus quipus en la 🏦 Tesorería y gástalos en el 🛍️ Kiosko.",
      "Toca a un compañero conectado para ver su perfil.",
    ],
  },
];

/** Se entra al colegio por la portería, frente a la puerta principal. */
export const SPAWN = { x: 20.5, y: 26.5 };

// ---------- grilla de colisiones ----------

function buildFloor(): Floor[][] {
  const g: Floor[][] = Array.from({ length: ROWS }, () => Array<Floor>(COLS).fill("#"));
  for (const r of ROOMS) for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) g[y][x] = r.floor;
  for (const d of DOOR_TILES) g[d.y][d.x] = d.floor;
  // Pasto en las esquinas del patio
  for (const [x, y] of [
    [1, 10], [2, 10], [1, 11], [37, 10], [38, 10], [38, 11], [1, 14], [1, 15], [2, 15], [38, 14], [37, 15], [38, 15],
  ])
    g[y][x] = "g";
  for (let y = 12; y < 14; y++) for (let x = 18; x < 22; x++) g[y][x] = "w";
  return g;
}

export const FLOOR = buildFloor();


const staticBlocked: boolean[][] = (() => {
  const b = FLOOR.map((row) => row.map((f) => f === "#" || f === "w"));
  for (const ob of OBJECTS.filter((x) => x.blocks))
    for (let y = ob.y; y < ob.y + ob.h; y++) for (let x = ob.x; x < ob.x + ob.w; x++) b[y][x] = true;
  return b;
})();

/** Baldosas que ocupan las puertas de clase en uso (las que no tienen clase no existen). */
export function doorTiles(count: number): { x: number; y: number }[] {
  return CLASS_DOORS.slice(0, count).flatMap((d) => Array.from({ length: d.w }, (_, i) => ({ x: d.x + i, y: d.y })));
}

export function makeBlocked(extra: { x: number; y: number }[]) {
  const b = staticBlocked.map((row) => [...row]);
  for (const p of extra) if (b[p.y]?.[p.x] !== undefined) b[p.y][p.x] = true;
  return b;
}

export function roomAt(x: number, y: number): Room | null {
  return ROOMS.find((r) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) ?? null;
}

/** Distancia del punto (px, py) al rectángulo en baldosas (0 si está dentro). */
export function distToRect(px: number, py: number, r: { x: number; y: number; w: number; h: number }) {
  const dx = Math.max(r.x - px, 0, px - (r.x + r.w));
  const dy = Math.max(r.y - py, 0, py - (r.y + r.h));
  return Math.hypot(dx, dy);
}

/** BFS sobre la grilla hasta la primera baldosa que cumpla `goal`. Devuelve centros de baldosa. */
export function findPath(
  blocked: boolean[][],
  from: { x: number; y: number },
  goal: (x: number, y: number) => boolean,
): { x: number; y: number }[] | null {
  const sx = Math.floor(from.x);
  const sy = Math.floor(from.y);
  const prev = new Map<number, number>();
  const key = (x: number, y: number) => y * COLS + x;
  const queue: [number, number][] = [[sx, sy]];
  prev.set(key(sx, sy), -1);
  while (queue.length) {
    const [x, y] = queue.shift()!;
    if (goal(x, y)) {
      const path: { x: number; y: number }[] = [];
      let k = key(x, y);
      while (k !== -1) {
        path.unshift({ x: (k % COLS) + 0.5, y: Math.floor(k / COLS) + 0.5 });
        k = prev.get(k)!;
      }
      return path.slice(1);
    }
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) continue;
      if (blocked[ny][nx] || prev.has(key(nx, ny))) continue;
      prev.set(key(nx, ny), key(x, y));
      queue.push([nx, ny]);
    }
  }
  return null;
}
