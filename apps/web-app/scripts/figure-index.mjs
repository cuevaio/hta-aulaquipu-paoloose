#!/usr/bin/env node
// Genera public/figure/figure-index.json desde figuredata.json + figuremap.json (open-skin-resources):
// qué capas oculta cada carpeta de item (hiddenLayers de Habbo: p. ej. un gorro oculta el pelo "hrb").
// Uso: node scripts/figure-index.mjs [--from ../open-skin-resources/dist] [--out public/figure]

import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const FROM = resolve(arg("from", "../open-skin-resources/dist"));
const OUT = resolve(arg("out", "public/figure"));

const figuredata = JSON.parse(readFileSync(join(FROM, "figuredata.json"), "utf8"));
const figuremap = JSON.parse(readFileSync(join(FROM, "figuremap.json"), "utf8"));

const libOf = (type, id) => {
  const idx = figuremap.parts[type]?.[String(id)];
  return idx === undefined ? null : figuremap.libs[idx]?.id ?? null;
};

const hidden = {};
for (const settype of Object.values(figuredata.settype)) {
  for (const set of Object.values(settype.set)) {
    if (!set.hiddenLayers?.length) continue;
    const libs = new Set(set.parts.map((p) => libOf(p.type, p.id)).filter(Boolean));
    for (const lib of libs) {
      // Las librerías base mezclan cientos de sets: no se les asigna un ocultamiento global
      if (lib.startsWith("hh_human")) continue;
      hidden[lib] = [...new Set([...(hidden[lib] ?? []), ...set.hiddenLayers])].sort();
    }
  }
}

writeFileSync(join(OUT, "figure-index.json"), JSON.stringify({ hidden }));
console.log(`figure-index.json: ${Object.keys(hidden).length} items con capas ocultas`);
