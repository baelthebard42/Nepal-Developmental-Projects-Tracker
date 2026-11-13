import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { bearing, ringLayout } from "@/lib/geo/ring";
import type { Dataset } from "@/lib/data/types";

const seed: Dataset = JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, "../../supabase/seed/sample_projects.json"), "utf8"));

describe("partner ring", () => {
  it("places every partner, with no two flags on top of each other", () => {
    const pos = ringLayout(seed.partners);
    expect(pos.size).toBe(seed.partners.length);
    const pts = [...pos.values()];
    for (let i = 0; i < pts.length; i++)
      for (let j = i + 1; j < pts.length; j++) expect(Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1])).toBeGreaterThan(0.6);
  });

  it("puts partners in their compass direction from Kathmandu", () => {
    const pos = ringLayout(seed.partners);
    const ktm: [number, number] = [85.32, 27.7];
    expect(pos.get("japan")![0]).toBeGreaterThan(ktm[0]); // east
    expect(pos.get("uk")![0]).toBeLessThan(ktm[0]); // west
    expect(Math.round(bearing(ktm, [139.69, 35.69]))).toBeGreaterThan(45);
  });
});
