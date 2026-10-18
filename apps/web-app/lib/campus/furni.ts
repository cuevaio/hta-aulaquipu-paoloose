// Muebles pixel art del campus (public/campus/furni, vistas previas de habboassets.com).
// Se guarda el tamaño en px de cada PNG para dibujarlos a escala sin saltos al cargar.

export const FURNI_SIZE = {
  autumn_c20_bench: [97, 101],
  br_c25_parrot4: [53, 38],
  classic9_bookshelf: [98, 215],
  ducket_c25_plantpot: [58, 95],
  ducket_c26_appletree: [217, 252],
  fest_ltd19_alpaca: [76, 105],
  hygge_c25_sofa: [109, 94],
  lt_c26_banyantree: [340, 611],
  mafia_c26_wallsafe: [99, 112],
  mexico_c24_pricklyplant: [55, 135],
  nft_h26_jungleplant1: [100, 108],
  nft_plant_cruddy: [45, 56],
  nft_rare_fountain: [42, 58],
  nft_sc24_goldfishfountain: [87, 122],
  nft_sc25_sunflowers: [51, 99],
  nft_school_gate: [104, 225],
  nft_uni_libraryshelf: [73, 210],
  recycler_basketplant: [52, 82],
  school_c22_bench: [112, 79],
  school_c22_cafe: [98, 104],
  school_c22_chalkboard: [128, 182],
  school_c22_locker_notele: [58, 138],
  school_c22_table: [144, 103],
  school_c22_teachertable: [99, 84],
  school_chalkboard: [128, 146],
  school_chalkboard2: [128, 146],
  school_charts: [79, 111],
  school_locker_b_notele: [58, 138],
  school_locker_g_notele: [58, 138],
  school_locker_r_notele: [58, 138],
  uni_bookshelf: [86, 132],
  uni_c23_locker2: [59, 138],
  uni_c23_locker4: [58, 138],
  xmas_c15_alpinetree: [119, 229],
  xmas_c17_bench: [114, 101],
  xmas_c23_counter: [100, 81],
  xmas_c24_doublesofa: [98, 94],
  xmas_c25_tree1a: [41, 43],
} as const satisfies Record<string, readonly [number, number]>;

export type FurniId = keyof typeof FURNI_SIZE;

export const furniSrc = (id: FurniId) => `/campus/furni/${id}.png`;

/** Píxeles del sprite por píxel en pantalla: una casilla de 64 px de Habbo ocupa una casilla del mapa. */
export const furniScale = (tile: number, scale = 1) => (tile / 64) * scale;
