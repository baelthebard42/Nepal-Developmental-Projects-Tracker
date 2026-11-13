// Regression: generated boundary files stay consistent with the area index and within size budgets.
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { describe, expect, it } from "vitest";
import { feature } from "topojson-client";
import type { Topology } from "topojson-specification";
import type { Area } from "@/lib/data/types";

const GEO = path.resolve(import.meta.dirname, "../../public/geo");
const areas: Area[] = JSON.parse(fs.readFileSync(path.join(GEO, "areas.json"), "utf8"));
const topo = (f: string) => JSON.parse(fs.readFileSync(path.join(GEO, f), "utf8")) as Topology;
const codesIn = (t: Topology, layer: string) =>
  (feature(t, t.objects[layer]) as unknown as { features: { properties: { code: string } }[] }).features.map((f) => f.properties.code);
const gz = (f: string) => zlib.gzipSync(fs.readFileSync(path.join(GEO, f))).length;

describe("area index", () => {
  it("has unique codes and every parent exists at the level above", () => {
    const byCode = new Map(areas.map((a) => [a.code, a]));
    expect(byCode.size).toBe(areas.length);
    const above = { province: null, district: "province", palika: "district" } as const;
    for (const a of areas) {
      if (a.level === "province") expect(a.parent).toBeNull();
      else expect(byCode.get(a.parent!)?.level, a.code).toBe(above[a.level]);
    }
  });

  it("every area has a sane bbox and a label point inside Nepal's extent", () => {
    for (const a of areas) {
      const [x0, y0, x1, y1] = a.bbox;
      expect(x0 <= x1 && y0 <= y1, a.code).toBe(true);
      expect(a.label[0] > 80 && a.label[0] < 88.3 && a.label[1] > 26.3 && a.label[1] < 30.5, a.code).toBe(true);
    }
  });
});

describe("TopoJSON files match the index", () => {
  it("provinces and districts", () => {
    const t = topo("nepal.topo.json");
    expect(new Set(codesIn(t, "provinces"))).toEqual(new Set(areas.filter((a) => a.level === "province").map((a) => a.code)));
    expect(new Set(codesIn(t, "districts"))).toEqual(new Set(areas.filter((a) => a.level === "district").map((a) => a.code)));
  });

  it("palika files (one per province) contain exactly the palika-level areas", () => {
    const fromFiles = ["P1", "P2", "P3", "P4", "P5", "P6", "P7"].flatMap((p) => codesIn(topo(`palikas/${p}.topo.json`), "palikas"));
    expect(new Set(fromFiles).size).toBe(fromFiles.length);
    expect(new Set(fromFiles)).toEqual(new Set(areas.filter((a) => a.level === "palika").map((a) => a.code)));
  });

  it("stays within the performance budget (plan §12)", () => {
    expect(gz("nepal.topo.json") + gz("neighbours.topo.json")).toBeLessThan(400 * 1024);
    for (const p of ["P1", "P2", "P3", "P4", "P5", "P6", "P7"]) expect(gz(`palikas/${p}.topo.json`)).toBeLessThan(150 * 1024);
  });
});

describe("label glyphs", () => {
  it("fonts referenced by the map style are present", () => {
    for (const font of ["Noto Sans Medium", "Noto Sans Regular"]) {
      expect(fs.existsSync(path.resolve(GEO, `../glyphs/${font}/0-255.pbf`)), font).toBe(true);
    }
  });
});
