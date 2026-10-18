#!/usr/bin/env node
// Normalizador genérico de assets paperdoll a formato AulaQuipu.
// Recorre una carpeta local de items (<Item>/<Item>.json + <Item>.png, formato
// spritesheet manifest), copia los seleccionados a public/figure/ y genera el
// SQL del catálogo (skins) + un índice catalog.json para el render.
// Agnóstico al arte: funciona con cualquier carpeta que siga ese formato.

import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";

const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : fallback;
};

const FROM = resolve(arg("from", "../open-hotel-resources/dist"));
const OUT = resolve(arg("out", "public/figure"));
const SQL_OUT = resolve(arg("sql", "scripts/figure-seed.sql"));
const BASE_N = Number(arg("base", "5"));
const ACC_N = Number(arg("acc", "3"));
const PICK = new Set((arg("pick", "")).split(",").map((s) => s.trim()).filter(Boolean));

const BASE_TYPES = new Set(["hh", "hd", "bd", "hr", "hrb", "ch", "ls", "rs", "lg", "sh"]);
const TYPE_RULES = [
  ["acc_hair", { type: "hr", slot: "hr" }],
  ["acc_face", { type: "fa", slot: "fa" }],
  ["acc_head", { type: "ha", slot: "ha" }],
  ["acc_hat", { type: "ha", slot: "ha" }],
  ["acc_chest", { type: "cc", slot: "cc" }],
  ["acc_waist", { type: "wa", slot: "wa" }],
  ["acc_legs", { type: "lg", slot: "lg" }],
  ["acc_foot", { type: "sh", slot: "sh" }],
  ["acc_back", { type: "cp", slot: "cp" }],
  ["acc_hand", { type: "ca", slot: "ca" }],
  ["shirt", { type: "ch", slot: "ch" }],
  ["jacket", { type: "cc", slot: "cc" }],
  ["trousers", { type: "lg", slot: "lg" }],
  ["shoes", { type: "sh", slot: "sh" }],
  ["hair", { type: "hr", slot: "hr" }],
  ["hat", { type: "ha", slot: "ha" }],
  ["face", { type: "fa", slot: "fa" }],
  ["head", { type: "hd", slot: "hd" }],
  ["body", { type: "hh", slot: "hh" }],
];
const KEYWORD_RULES = [
  [/hair|pelo|beard/i, { type: "hr", slot: "hr" }],
  [/hat|cap|helmet|crown|mask|visor|headband/i, { type: "ha", slot: "ha" }],
  [/shirt|jacket|dress|torso|coat|top|tshirt/i, { type: "ch", slot: "ch" }],
  [/shoe|boot/i, { type: "sh", slot: "sh" }],
  [/leg|trouser|pants|skirt/i, { type: "lg", slot: "lg" }],
  [/glasses|eyes|face|mouth|blush/i, { type: "fa", slot: "fa" }],
  [/head/i, { type: "hd", slot: "hd" }],
  [/body|skin/i, { type: "hh", slot: "hh" }],
];

function classify(name, libIds) {
  const lower = name.toLowerCase();
  for (const libId of libIds) {
    if (libId.toLowerCase().includes(lower)) {
      const rule = TYPE_RULES.find(([p]) => libId.startsWith(p));
      if (rule) return rule[1];
    }
  }
  for (const [re, rule] of KEYWORD_RULES) if (re.test(name)) return rule;
  return { type: "acc_other", slot: "acc" };
}

function discoverItems(dir) {
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && e.name !== "hof_furni" && e.name !== "node_modules")
    .map((e) => e.name)
    .filter((name) => existsSync(join(dir, name, `${name}.json`)) && existsSync(join(dir, name, `${name}.png`)))
    .sort();
}

if (!existsSync(FROM) || !statSync(FROM).isDirectory()) {
  console.error(`No existe la carpeta de origen: ${FROM}`);
  process.exit(1);
}

const libIds = [];
const figuremapPath = join(FROM, "figuremap.json");
if (existsSync(figuremapPath)) {
  try {
    const map = JSON.parse(readFileSync(figuremapPath, "utf8"));
    for (const lib of map.libs ?? []) if (lib?.id) libIds.push(lib.id);
  } catch {
    console.warn("figuremap.json ilegible; se usa clasificación por palabras clave.");
  }
}

const items = discoverItems(FROM).map((name) => ({ name, ...classify(name, libIds) }));

// Selección: --pick manda; si no, presupuesto POR TIPO (base garantizada por
// separado: head, body, hair, shirt, legs, shoes no compiten entre sí).
const selected = [];
const counts = new Map();
for (const item of items) {
  const limit = BASE_TYPES.has(item.type) ? BASE_N : ACC_N;
  const forced = PICK.has(item.name);
  const n = counts.get(item.type) ?? 0;
  if (forced || n < limit) {
    counts.set(item.type, forced ? n : n + 1);
    selected.push({ ...item, kind: BASE_TYPES.has(item.type) ? "base" : "accessory" });
  }
}

const missingBase = [...new Set(items.filter((i) => BASE_TYPES.has(i.type)).map((i) => i.type))].filter(
  (t) => !selected.some((s) => s.type === t),
);
if (missingBase.length > 0) {
  console.warn(`ALERTA: tipos base sin cobertura: ${missingBase.join(", ")}`);
}

mkdirSync(OUT, { recursive: true });
mkdirSync(resolve(SQL_OUT, ".."), { recursive: true });

const PRICE = { base: 15, accessory: 25 };
const catalog = selected.map((item) => {
  cpSync(join(FROM, item.name), join(OUT, item.name), { recursive: true });
  return {
    name: item.name,
    slot: item.slot,
    type: item.type,
    kind: item.kind,
    price_quipus: PRICE[item.kind],
    manifest: `/figure/${item.name}/${item.name}.json`,
    image: `/figure/${item.name}/${item.name}.png`,
  };
});

writeFileSync(join(OUT, "catalog.json"), JSON.stringify({ items: catalog }, null, 2));

const pretty = (name) => name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
const sqlValues = catalog
  .map(
    (c) =>
      `  ('${pretty(c.name).replace(/'/g, "''")}', 'avatar', ${c.price_quipus}, ` +
      `'{"slot":"${c.slot}","item":"${c.name}","sprite":true}')`,
  )
  .join(",\n");
const sql = `-- Generado por scripts/normalize-figure-assets.mjs — re-ejecutable.
insert into skins (name, kind, price_quipus, meta)
select v.name, v.kind, v.price_quipus, v.meta::jsonb
from (values
${sqlValues}
) as v(name, kind, price_quipus, meta)
where not exists (select 1 from skins s where s.name = v.name);
`;
writeFileSync(SQL_OUT, sql);

const byType = catalog.reduce((acc, c) => ({ ...acc, [c.type]: (acc[c.type] ?? 0) + 1 }), {});
console.log(`Items encontrados: ${items.length} · seleccionados: ${catalog.length}`);
console.log("Por tipo:", byType);
console.log(`Assets copiados a: ${OUT}`);
console.log(`Índice: ${join(OUT, "catalog.json")}`);
console.log(`SQL del catálogo: ${SQL_OUT}`);
