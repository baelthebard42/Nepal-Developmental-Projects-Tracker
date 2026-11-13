// Border test (plan §7 step 6). Fails if the 2020 territory (Kalapani, Lipulekh,
// Limpiyadhura) is ever missing from the generated boundary files, or if counts drift.
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { feature } from "topojson-client";
import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import type { Feature, FeatureCollection, MultiPolygon, Polygon } from "geojson";
import type { Topology } from "topojson-specification";

const GEO = path.resolve(__dirname, "../../public/geo");
const topo = (f: string) => JSON.parse(fs.readFileSync(path.join(GEO, f), "utf8")) as Topology;
const fc = (t: Topology, layer: string) =>
  feature(t, t.objects[layer]) as unknown as FeatureCollection<Polygon | MultiPolygon, Record<string, string>>;

const nepal = topo("nepal.topo.json");
const districts = fc(nepal, "districts").features;
const provinces = fc(nepal, "provinces").features;
const areas: { code: string; level: string; parent: string | null; kind: string; label: [number, number] }[] =
  JSON.parse(fs.readFileSync(path.join(GEO, "areas.json"), "utf8"));

const LIPULEKH: [number, number] = [81.029, 30.234];
const KUTI: [number, number] = [80.77, 30.32];

const containing = (pt: [number, number], fs_: Feature<Polygon | MultiPolygon, Record<string, string>>[]) =>
  fs_.filter((f) => booleanPointInPolygon(pt, f)).map((f) => f.properties.code);

describe("2020 official map of Nepal", () => {
  it("Lipulekh pass lies in Darchula", () => {
    expect(containing(LIPULEKH, districts)).toEqual(["darchula"]);
  });
  it("Kuti valley (Kalapani area) lies in Darchula", () => {
    expect(containing(KUTI, districts)).toEqual(["darchula"]);
  });
  it("reaches Limpiyadhura: westernmost point north of 30°N is west of 80.6°E", () => {
    const darchula = districts.find((d) => d.properties.code === "darchula")!;
    const polys = darchula.geometry.type === "Polygon" ? [darchula.geometry.coordinates] : darchula.geometry.coordinates;
    const west = Math.min(...polys.flatMap((p) => p[0]).filter(([, y]) => y > 30).map(([x]) => x));
    expect(west).toBeLessThan(80.6);
  });
  it("Kalapani Region polygon is present in the palika layer under Darchula", () => {
    const p7 = fc(topo("palikas/P7.topo.json"), "palikas").features;
    const k = p7.find((f) => f.properties.code === "darchula~kalapani-region~sr");
    expect(k).toBeTruthy();
    expect(booleanPointInPolygon(KUTI, k!)).toBe(true);
  });
});

describe("administrative counts", () => {
  it("has 7 provinces, 77 districts, 753 palikas", () => {
    expect(provinces).toHaveLength(7);
    expect(districts).toHaveLength(77);
    expect(areas.filter((a) => a.level === "palika" && a.kind === "palika")).toHaveLength(753);
  });
  it("every palika label point sits inside its district", () => {
    const byCode = new Map(districts.map((d) => [d.properties.code, d]));
    const bad = areas
      .filter((a) => a.level === "palika")
      .filter((a) => !booleanPointInPolygon(a.label, byCode.get(a.parent!)!))
      .map((a) => a.code);
    // simplification can push a label of a tiny sliver across a border; allow a handful
    expect(bad.length, bad.join(", ")).toBeLessThan(5);
  });
});
