// Boundary pipeline (plan §7): raw Survey Department GeoJSON -> normalised,
// simplified TopoJSON in public/geo + an area index used by the app and the DB.
//
//   node scripts/geo/fetch.mjs   (downloads data/raw/*.geojson)
//   node scripts/geo/build.mjs
//
// Codes:  province  P1..P7
//         district  <slug>                      e.g. kathmandu
//         palika    <district>~<slug>[~<kind>]  e.g. kathmandu~kathmandu, darchula~kalapani-region~sr
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import polylabel from "polylabel";

const ROOT = path.resolve(import.meta.dirname, "../..");
const RAW = path.join(ROOT, "data/raw");
const TMP = path.join(ROOT, "data/build");
const OUT = path.join(ROOT, "public/geo");
const MAPSHAPER = path.join(ROOT, "node_modules/.bin/mapshaper");

fs.mkdirSync(TMP, { recursive: true });
fs.mkdirSync(path.join(OUT, "palikas"), { recursive: true });

export const PROVINCES = {
  1: { code: "P1", name: "Koshi" },
  2: { code: "P2", name: "Madhesh" },
  3: { code: "P3", name: "Bagmati" },
  4: { code: "P4", name: "Gandaki" },
  5: { code: "P5", name: "Lumbini" },
  6: { code: "P6", name: "Karnali" },
  7: { code: "P7", name: "Sudurpashchim" },
};

// Common alternative spellings, used only for search.
const ALIASES = {
  chitawan: ["Chitwan"],
  kabhrepalanchok: ["Kavre", "Kavrepalanchok", "Kabhre"],
  makawanpur: ["Makwanpur"],
  tanahu: ["Tanahun"],
  sindhupalchok: ["Sindhupalchowk"],
  nawalpur: ["Nawalparasi East", "Nawalparasi (Bardaghat Susta East)"],
  parasi: ["Nawalparasi West", "Nawalparasi (Bardaghat Susta West)"],
  dhanusha: ["Dhanusa"],
  terhathum: ["Tehrathum"],
};

const KIND = {
  Gaunpalika: ["palika", "Gaunpalika", "Rural Municipality"],
  Nagarpalika: ["palika", "Nagarpalika", "Municipality"],
  Upamahanagarpalika: ["palika", "Upamahanagarpalika", "Sub-Metropolitan City"],
  Mahanagarpalika: ["palika", "Mahanagarpalika", "Metropolitan City"],
  "National Park": ["protected_area", "Rashtriya Nikunja", "National Park"],
  "Wildlife Reserve": ["protected_area", "Banyajantu Aarakshya", "Wildlife Reserve"],
  "Hunting Reserve": ["protected_area", "Shikar Aarakshya", "Hunting Reserve"],
  "Watershed and Wildlife Reserve": ["protected_area", "Jalaadhar tatha Banyajantu Aarakshya", "Watershed and Wildlife Reserve"],
  "Development Area": ["protected_area", "Bikas Kshetra", "Development Area"],
  "": ["special_region", "Kshetra", "Region"],
};

const slug = (s) =>
  s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const read = (f) => JSON.parse(fs.readFileSync(path.join(RAW, f), "utf8"));
const write = (f, o) => fs.writeFileSync(f, JSON.stringify(o));

// ---------- 1. normalise ----------
const districtsRaw = read("District.geojson");
const localsRaw = read("Local_Units.geojson");

const districts = districtsRaw.features.map((f) => {
  const p = f.properties;
  const prov = PROVINCES[p.PROVINCE];
  return {
    type: "Feature",
    geometry: f.geometry,
    properties: { code: slug(p.DISTRICT), name: p.DISTRICT, province: prov.code },
  };
});
const districtCodes = new Set(districts.map((d) => d.properties.code));
if (districtCodes.size !== 77) throw new Error(`expected 77 unique districts, got ${districtCodes.size}`);

const kindSuffix = { palika: "", protected_area: "~pa", special_region: "~sr" };
const locals = localsRaw.features.map((f) => {
  const p = f.properties;
  const [kind, typeNe, typeEn] = KIND[p.TYPE] ?? (() => { throw new Error("unknown TYPE " + p.TYPE); })();
  const d = slug(p.DISTRICT);
  if (!districtCodes.has(d)) throw new Error("unknown district " + p.DISTRICT);
  return {
    type: "Feature",
    geometry: f.geometry,
    properties: {
      code: `${d}~${slug(p.LOCAL)}${kindSuffix[kind]}`,
      name: p.LOCAL,
      district: d,
      province: PROVINCES[p.PROVINCE].code,
      kind,
      type_en: typeEn,
      type_ne: typeNe,
    },
  };
});

write(path.join(TMP, "districts.geojson"), { type: "FeatureCollection", features: districts });
write(path.join(TMP, "palikas.geojson"), { type: "FeatureCollection", features: locals });

// ---------- 2-3. simplify with mapshaper ----------
const ms = (...args) => execFileSync(MAPSHAPER, args, { stdio: ["ignore", "inherit", "inherit"] });

// Districts are the master layer; provinces and the national outline are dissolved from the
// *simplified* districts so all three share identical edges.
ms(
  "-i", path.join(TMP, "districts.geojson"),
  "-rename-layers", "districts",
  "-clean",
  "-simplify", "8%", "keep-shapes",
  "-o", path.join(TMP, "districts.simp.geojson"), "precision=0.0001",
  "-dissolve", "province", "copy-fields=province", "+", "name=provinces",
  "-each", "code=province", "target=provinces",
  "-dissolve", "target=provinces", "+", "name=nepal",
  "-o", path.join(OUT, "nepal.topo.json"), "format=topojson", "target=districts,provinces,nepal", "quantization=1e5",
);

// Palikas: dissolve duplicate parts (same code) then one file per province.
ms(
  "-i", path.join(TMP, "palikas.geojson"),
  "-dissolve", "code", "copy-fields=name,district,province,kind,type_en,type_ne",
  "-clean",
  "-simplify", "10%", "keep-shapes",
  "-split", "province",
  "-o", path.join(TMP) + "/", "format=geojson", "precision=0.0001",
);
for (const { code } of Object.values(PROVINCES)) {
  ms(
    "-i", path.join(TMP, `${code}.json`),
    "-rename-layers", "palikas",
    "-o", path.join(OUT, "palikas", `${code}.topo.json`), "format=topojson", "quantization=1e5",
  );
}

// ---------- 4. area index + label points ----------
const ringsOf = (g) => (g.type === "Polygon" ? [g.coordinates] : g.coordinates);
function bboxOf(g) {
  let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const poly of ringsOf(g)) for (const [x, y] of poly[0]) {
    x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
  }
  return [x0, y0, x1, y1].map((v) => +v.toFixed(3));
}
function ringArea(r) {
  let a = 0;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += (r[j][0] + r[i][0]) * (r[j][1] - r[i][1]);
  return Math.abs(a / 2);
}
function labelOf(g) {
  const biggest = ringsOf(g).sort((a, b) => ringArea(b[0]) - ringArea(a[0]))[0];
  return polylabel(biggest, 0.001).slice(0, 2).map((v) => +v.toFixed(3));
}

const areas = [];
const simpDistricts = JSON.parse(fs.readFileSync(path.join(TMP, "districts.simp.geojson"), "utf8")).features;
const byProvince = {};
for (const f of simpDistricts) (byProvince[f.properties.province] ??= []).push(f.geometry);
for (const { code, name } of Object.values(PROVINCES)) {
  const geoms = byProvince[code];
  const merged = { type: "MultiPolygon", coordinates: geoms.flatMap(ringsOf) };
  areas.push({ code, level: "province", parent: null, name_en: `${name} Province`, name_ne: `${name} Pradesh`, short: name, kind: "province", bbox: bboxOf(merged), label: labelOf(merged) });
}
for (const f of simpDistricts.sort((a, b) => a.properties.name.localeCompare(b.properties.name))) {
  const p = f.properties;
  areas.push({ code: p.code, level: "district", parent: p.province, name_en: p.name, name_ne: p.name, short: p.name, kind: "district", aliases: ALIASES[p.code], bbox: bboxOf(f.geometry), label: labelOf(f.geometry) });
}
for (const { code } of Object.values(PROVINCES)) {
  const fc = JSON.parse(fs.readFileSync(path.join(TMP, `${code}.json`), "utf8"));
  for (const f of fc.features.sort((a, b) => a.properties.name.localeCompare(b.properties.name))) {
    const p = f.properties;
    areas.push({
      code: p.code, level: "palika", parent: p.district, name_en: `${p.name} ${p.type_en}`, name_ne: `${p.name} ${p.type_ne}`,
      short: p.name, kind: p.kind, bbox: bboxOf(f.geometry), label: labelOf(f.geometry),
    });
  }
}
write(path.join(OUT, "areas.json"), areas);
const csv = ["code,level,parent_code,name_en,name_ne,kind"]
  .concat(areas.map((a) => [a.code, a.level, a.parent ?? "", a.name_en, a.name_ne, a.kind].map((v) => `"${v}"`).join(",")))
  .join("\n");
fs.writeFileSync(path.join(ROOT, "data/admin_areas.csv"), csv + "\n");

// ---------- 5. neighbours (Natural Earth via world-atlas, drawn under Nepal, no borders) ----------
const world = JSON.parse(fs.readFileSync(path.join(ROOT, "node_modules/world-atlas/countries-50m.json"), "utf8"));
const { feature } = await import("topojson-client");
const countries = feature(world, world.objects.countries).features.filter((f) =>
  ["China", "India", "Bhutan", "Bangladesh", "Myanmar", "Pakistan"].includes(f.properties.name),
);
write(path.join(TMP, "neighbours.geojson"), { type: "FeatureCollection", features: countries });
ms(
  "-i", path.join(TMP, "neighbours.geojson"),
  "-clip", "bbox=72,20,98,37",
  "-simplify", "interval=1500",
  "-each", "code=name",
  "-rename-layers", "neighbours",
  "-o", path.join(OUT, "neighbours.topo.json"), "format=topojson", "quantization=1e5",
);

const counts = areas.reduce((a, x) => ((a[x.level + ":" + x.kind] = (a[x.level + ":" + x.kind] ?? 0) + 1), a), {});
console.log("areas", counts);
for (const f of fs.readdirSync(OUT, { recursive: true })) {
  const p = path.join(OUT, f);
  if (fs.statSync(p).isFile()) console.log(String(f).padEnd(28), (fs.statSync(p).size / 1024).toFixed(0) + " KB");
}
