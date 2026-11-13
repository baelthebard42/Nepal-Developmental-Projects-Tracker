// Step 1 of the boundary pipeline (plan §7).
// Tries the live National Geoportal (Survey Department) first. When it is unavailable
// (it returned "database system is in recovery mode" on 2026-10-18 and was still down on
// 2026-11-13) it falls back to a GeoJSON mirror of the Geoportal shapefiles, which was verified
// to include the 2020 map (Kalapani, Lipulekh, Limpiyadhura). The border test re-checks this.
import fs from "node:fs";
import path from "node:path";

const RAW = path.resolve(import.meta.dirname, "../../data/raw");
fs.mkdirSync(RAW, { recursive: true });

const GEOPORTAL = "https://admin.nationalgeoportal.gov.np/geoserver/ows";
const MIRROR = "https://raw.githubusercontent.com/manishacharya60/nepal-geojson/HEAD/Nepal_Administrative_Boundary_";
const LAYERS = ["National", "Province", "District", "Local_Units"];

async function geoportalUp() {
  try {
    const r = await fetch(`${GEOPORTAL}?service=WFS&version=1.0.0&request=GetCapabilities`, { signal: AbortSignal.timeout(20000) });
    const t = await r.text();
    return r.ok && t.includes("WFS_Capabilities");
  } catch {
    return false;
  }
}

if (await geoportalUp()) {
  console.log("National Geoportal is reachable. Download the layers from it and place them in data/raw/ as",
    LAYERS.map((l) => `${l}.geojson`).join(", "), "(layer names on the live server need confirming).");
}
console.log("Using the Geoportal mirror…");
for (const l of LAYERS) {
  const r = await fetch(`${MIRROR}${l}.geojson`);
  if (!r.ok) throw new Error(`${l}: HTTP ${r.status}`);
  fs.writeFileSync(path.join(RAW, `${l}.geojson`), Buffer.from(await r.arrayBuffer()));
  console.log("  ✓", l);
}
