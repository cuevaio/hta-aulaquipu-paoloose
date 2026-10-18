// Mapa del campus 2D (estilo gather). Todo en unidades de baldosa; la posición de una
// persona es el centro de su cuerpo (p. ej. 20.5, 14.5 = centro de la baldosa 20,14).

export const COLS = 40;
export const ROWS = 26;

export type Floor = "#" | "g" | "p" | "b" | "i" | "t" | "a" | "s" | "q" | "w";

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

export const ROOMS: Room[] = [
  { id: "biblioteca", name: "Biblioteca", subtitle: "Quiero aprender", emoji: "📚", x: 1, y: 1, w: 12, h: 8, floor: "b" },
  { id: "aulas-ia", name: "Aulas IA", subtitle: "Tutores disponibles ya", emoji: "✨", x: 14, y: 1, w: 12, h: 8, floor: "i" },
  { id: "tutores", name: "Sala de tutores", subtitle: "Quiero enseñar", emoji: "🎓", x: 27, y: 1, w: 12, h: 8, floor: "t" },
  { id: "plaza", name: "Plaza central", emoji: "⛲", x: 1, y: 10, w: 38, h: 6, floor: "p" },
  { id: "aulas", name: "Aulas", subtitle: "Tus clases en vivo", emoji: "🏫", x: 1, y: 17, w: 12, h: 8, floor: "a" },
  { id: "tienda", name: "Tienda", subtitle: "Skins y prestigio", emoji: "🛍️", x: 14, y: 17, w: 12, h: 8, floor: "s" },
  { id: "banco", name: "Banco de quipus", subtitle: "Tu historial", emoji: "🪢", x: 27, y: 17, w: 12, h: 8, floor: "q" },
];

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
  | "vault";

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
  // Biblioteca
  o("lib-shelf-1", "shelf", 1, 1, 4, 1, { emoji: "📚" }),
  o("lib-shelf-2", "shelf", 9, 1, 4, 1, { emoji: "📚" }),
  o("lib-board", "board", 5, 1, 4, 1, { emoji: "📌", label: "Mis pedidos", href: "/home", prompt: "Ver mi tablero" }),
  o("lib-kiosk", "kiosk", 6, 4, 2, 1, { emoji: "📝", label: "Publicar pedido", href: "/aprender", prompt: "Pedir una tutoría" }),
  o("lib-table-1", "table", 2, 6, 2, 1, { emoji: "📖" }),
  o("lib-table-2", "table", 10, 6, 2, 1, { emoji: "✏️" }),
  o("lib-plant-1", "plant", 1, 8, 1, 1, { emoji: "🪴" }),
  o("lib-plant-2", "plant", 12, 8, 1, 1, { emoji: "🪴" }),

  // Aulas IA
  o("ia-board-1", "board", 15, 1, 3, 1, { emoji: "🧮" }),
  o("ia-board-2", "board", 22, 1, 3, 1, { emoji: "📈" }),
  o("ia-rug-1", "rug", 15, 3, 3, 3),
  o("ia-rug-2", "rug", 18, 3, 3, 3),
  o("ia-rug-3", "rug", 21, 3, 3, 3),
  o("ia-plant", "plant", 25, 8, 1, 1, { emoji: "🪴" }),

  // Sala de tutores
  o("tut-board", "board", 31, 1, 4, 1, { emoji: "📋", label: "Tablón de pedidos", href: "/ensenar", prompt: "Ver pedidos y enseñar" }),
  o("tut-sofa-1", "sofa", 28, 6, 3, 1, { emoji: "🛋️" }),
  o("tut-sofa-2", "sofa", 35, 6, 3, 1, { emoji: "🛋️" }),
  o("tut-plant-1", "plant", 27, 1, 1, 1, { emoji: "🪴" }),
  o("tut-plant-2", "plant", 38, 1, 1, 1, { emoji: "🪴" }),
  o("tut-table", "table", 32, 5, 2, 1, { emoji: "☕" }),

  // Plaza
  o("plaza-fountain", "fountain", 18, 12, 4, 2, { emoji: "⛲" }),
  o("plaza-tree-1", "tree", 1, 10, 1, 1, { emoji: "🌳" }),
  o("plaza-tree-2", "tree", 1, 15, 1, 1, { emoji: "🌳" }),
  o("plaza-tree-3", "tree", 38, 10, 1, 1, { emoji: "🌳" }),
  o("plaza-tree-4", "tree", 38, 15, 1, 1, { emoji: "🌳" }),
  o("plaza-tree-5", "tree", 12, 12, 1, 1, { emoji: "🌲" }),
  o("plaza-tree-6", "tree", 27, 12, 1, 1, { emoji: "🌲" }),
  o("plaza-bench-1", "bench", 14, 14, 2, 1, { emoji: "🪑" }),
  o("plaza-bench-2", "bench", 24, 14, 2, 1, { emoji: "🪑" }),
  o("plaza-mirror", "mirror", 4, 12, 1, 2, { emoji: "🪞", label: "Espejo", href: "/perfil", prompt: "Ver mi perfil" }),
  o("plaza-board", "board", 34, 12, 2, 1, { emoji: "🗒️", label: "Mi tablero", href: "/home", prompt: "Ver mi resumen" }),

  // Aulas
  o("aula-board", "board", 8, 17, 4, 1, { emoji: "🏫", label: "Mis clases", href: "/clases", prompt: "Ver mis clases y entrar al aula" }),
  ...[2, 5, 8].flatMap((x) => [
    o(`aula-desk-${x}-a`, "desk", x, 20, 2, 1, { emoji: "📓" }),
    o(`aula-desk-${x}-b`, "desk", x, 22, 2, 1, { emoji: "📐" }),
  ]),

  // Tienda
  o("shop-rack", "display", 14, 17, 3, 1, { emoji: "👕" }),
  o("shop-counter", "counter", 18, 19, 4, 1, { emoji: "🛒", label: "Tienda", href: "/tienda", prompt: "Comprar skins" }),
  o("shop-d1", "display", 15, 22, 1, 1, { emoji: "👑" }),
  o("shop-d2", "display", 17, 22, 1, 1, { emoji: "🕶️" }),
  o("shop-d3", "display", 22, 22, 1, 1, { emoji: "🎧" }),
  o("shop-d4", "display", 24, 22, 1, 1, { emoji: "🎓" }),

  // Banco
  o("bank-art", "board", 28, 17, 3, 1, { emoji: "🪢" }),
  o("bank-counter", "counter", 31, 19, 4, 1, { emoji: "🏦", label: "Ventanilla", href: "/quipus", prompt: "Ver mis quipus" }),
  o("bank-vault", "vault", 36, 17, 2, 2, { emoji: "🔐" }),
  o("bank-plant", "plant", 27, 24, 1, 1, { emoji: "🪴" }),
];

/** Dónde aparecen los demás alumnos de la demo y los tutores IA. */
export const STUDENT_SPOTS: Record<string, { x: number; y: number }> = {
  "usr-valeria": { x: 29, y: 3 },
  "usr-mateo": { x: 36, y: 3 },
  "usr-camila": { x: 3, y: 3 },
  "usr-lucia": { x: 10, y: 3 },
  "usr-andres": { x: 8, y: 13 },
  "usr-diego": { x: 20, y: 21 },
};
export const AI_SPOTS = [
  { x: 16, y: 4 },
  { x: 19, y: 4 },
  { x: 22, y: 4 },
];

export const SPAWN = { x: 20.5, y: 14.5 };

// ---------- grilla de colisiones ----------

function buildFloor(): Floor[][] {
  const g: Floor[][] = Array.from({ length: ROWS }, () => Array<Floor>(COLS).fill("#"));
  for (const r of ROOMS) for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) g[y][x] = r.floor;
  // Puertas de 2 baldosas entre cada sala y la plaza
  for (const r of ROOMS) {
    if (r.id === "plaza") continue;
    const doorRow = r.y === 1 ? 9 : 16;
    g[doorRow][r.x + 5] = "p";
    g[doorRow][r.x + 6] = "p";
  }
  // Pasto en las esquinas de la plaza
  for (const [x, y] of [
    [1, 10], [2, 10], [1, 11], [37, 10], [38, 10], [38, 11], [1, 14], [1, 15], [2, 15], [38, 14], [37, 15], [38, 15],
  ])
    g[y][x] = "g";
  for (let y = 12; y < 14; y++) for (let x = 18; x < 22; x++) g[y][x] = "w";
  return g;
}

export const FLOOR = buildFloor();

export const DOORS = ROOMS.filter((r) => r.id !== "plaza").map((r) => ({ x: r.x + 5, y: r.y === 1 ? 9 : 16, w: 2 }));

const staticBlocked: boolean[][] = (() => {
  const b = FLOOR.map((row) => row.map((f) => f === "#" || f === "w"));
  for (const ob of OBJECTS)
    if (ob.blocks) for (let y = ob.y; y < ob.y + ob.h; y++) for (let x = ob.x; x < ob.x + ob.w; x++) b[y][x] = true;
  return b;
})();

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
