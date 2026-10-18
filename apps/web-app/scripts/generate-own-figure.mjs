#!/usr/bin/env node
// Genera el set base ORIGINAL (arte propio) con la estructura de capas estilo
// Habbo: hh (cuerpo), hd (cabeza), hr (pelo), ch (camiseta), lg (piernas),
// sh (zapatos), ha (gorro), fa (lentes). 8 direcciones, acciones std/mv.
// Sale a .figure-src/ para pasarlo por normalize-figure-assets.mjs.

import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const OUT = resolve(process.argv[2] ?? ".figure-src");
const W = 32;
const H = 48;
const DIRS = 8;
const ACTIONS = { std: 1, mv: 2 };

// ---- encoder PNG mínimo (RGBA, sin dependencias) ----
const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
};
function encodePNG(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0;
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

// ---- primitivas de dibujo ----
function canvas() {
  return Buffer.alloc(W * H * 4);
}
function px(img, x, y, [r, g, b, a = 255]) {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 4;
  img[i] = r;
  img[i + 1] = g;
  img[i + 2] = b;
  img[i + 3] = a;
}
function ellipse(img, cx, cy, rx, ry, color) {
  for (let y = Math.floor(cy - ry); y <= cy + ry; y++) {
    for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
      if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1) px(img, x, y, color);
    }
  }
}
function rect(img, x0, y0, w, h, color) {
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) px(img, x, y, color);
}

// ---- paleta y arte por capa (cada capa = un tipo de figura) ----
const PURPLE = [124, 107, 242];
const SKIN = [255, 203, 152];
const DARK = [30, 27, 58];
const RED = [229, 72, 77];
const GOLD = [255, 201, 77];
const TEAL = [47, 211, 163];
const NAVY = [64, 82, 122];
const BROWN = [122, 74, 42];

const look = (dir) => dir - 3.5;

function drawBody(img, dir, bob) {
  ellipse(img, 16, 30 + bob, 6, 7, PURPLE);
  rect(img, 12, 36 + bob, 3, 8, PURPLE);
  rect(img, 17, 36 + bob, 3, 8, PURPLE);
  ellipse(img, 9, 30 + bob, 2, 4, PURPLE);
  ellipse(img, 23, 30 + bob, 2, 4, PURPLE);
}
function drawHead(img, dir, bob) {
  ellipse(img, 16, 17 + bob, 6, 6, SKIN);
  const dx = look(dir) * 0.7;
  ellipse(img, 13.5 + dx, 16 + bob, 1.2, 1.6, DARK);
  ellipse(img, 18.5 + dx, 16 + bob, 1.2, 1.6, DARK);
  rect(img, 15 + dx, 20 + bob, 2, 1, RED);
}
function drawHair(img, dir, bob) {
  ellipse(img, 16, 12.5 + bob, 6.2, 3, BROWN);
  rect(img, 10, 13 + bob, 12, 2, BROWN);
}
function drawShirt(img, dir, bob) {
  ellipse(img, 16, 30 + bob, 6, 4.5, TEAL);
  ellipse(img, 9.5, 29 + bob, 2, 3, TEAL);
  ellipse(img, 22.5, 29 + bob, 2, 3, TEAL);
}
function drawLegs(img, dir, bob) {
  rect(img, 12, 36 + bob, 3, 6, NAVY);
  rect(img, 17, 36 + bob, 3, 6, NAVY);
}
function drawShoes(img, dir, bob) {
  rect(img, 11, 42 + bob, 5, 3, RED);
  rect(img, 17, 42 + bob, 5, 3, RED);
}
function drawHat(img, dir, bob) {
  rect(img, 10, 10 + bob, 12, 3, RED);
  ellipse(img, 16, 10 + bob, 6, 2, RED);
  px(img, 16, 7 + bob, GOLD);
}
function drawGlasses(img, dir, bob) {
  const dx = look(dir) * 0.7;
  rect(img, 11 + Math.round(dx), 15 + bob, 5, 3, DARK);
  rect(img, 16 + Math.round(dx), 15 + bob, 5, 3, DARK);
  rect(img, 15 + Math.round(dx), 16 + bob, 1, 1, DARK);
}

const ITEMS = {
  "hh_human_body": { slot: "hh", draw: drawBody },
  "hh_human_face": { slot: "hd", draw: drawHead },
  "hh_human_hair": { slot: "hr", draw: drawHair },
  "hh_human_shirt": { slot: "ch", draw: drawShirt },
  "hh_human_leg": { slot: "lg", draw: drawLegs },
  "hh_human_shoe": { slot: "sh", draw: drawShoes },
  "hh_human_hats": { slot: "ha", draw: drawHat },
  "hh_human_acc_eye": { slot: "fa", draw: drawGlasses },
};

// ---- render de atlas + manifest ----
for (const [name, item] of Object.entries(ITEMS)) {
  const frameNames = [];
  for (const [action, frames] of Object.entries(ACTIONS)) {
    for (let dir = 0; dir < DIRS; dir++) {
      for (let f = 0; f < frames; f++) {
        frameNames.push({ name: `h_${action}_fig${Object.keys(ITEMS).indexOf(name)}_1_1_${dir}_${f}`, action, dir, f });
      }
    }
  }
  const cols = frameNames.length;
  const atlas = Buffer.alloc(W * cols * H * 4);
  const framesJson = {};
  const assets = {};
  frameNames.forEach((fr, i) => {
    const img = canvas();
    item.draw(img, fr.dir, fr.action === "mv" && fr.f === 1 ? -1 : 0);
    for (let y = 0; y < H; y++) img.copy(atlas, (i * W + y * W * cols) * 4, y * W * 4, (y + 1) * W * 4);
    framesJson[`${fr.name}.png`] = {
      frame: { x: i * W, y: 0, w: W, h: H },
      rotated: false,
      trimmed: false,
      spriteSourceSize: { x: 0, y: 0, w: W, h: H },
      sourceSize: { w: W, h: H },
    };
    assets[fr.name] = { offset: `0,${H}` };
  });
  const dir = join(OUT, name);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${name}.png`), encodePNG(W * cols, H, atlas));
  writeFileSync(
    join(dir, `${name}.json`),
    JSON.stringify(
      { manifest: { version: "0.1", assets, aliases: {} }, spritesheet: { frames: framesJson, meta: { size: { w: W * cols, h: H } } } },
      null,
      2,
    ),
  );
  console.log(`${name} [${item.slot}]: ${frameNames.length} frames (${W * cols}x${H})`);
}
console.log(`Listo. Pásalo por: node scripts/normalize-figure-assets.mjs --from ${OUT}`);
