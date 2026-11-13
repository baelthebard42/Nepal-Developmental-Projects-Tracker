// Regression: the bundled dataset (the app's fallback when Supabase is unavailable) must match the
// shape the UI expects and add up. The same checks guard real data imports in Phase 2.
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { DatasetSchema, integrityProblems } from "@/lib/data/schema";
import type { Area, Dataset } from "@/lib/data/types";

const ROOT = path.resolve(import.meta.dirname, "../..");
const seed: Dataset = JSON.parse(fs.readFileSync(path.join(ROOT, "supabase/seed/sample_projects.json"), "utf8"));
const areas: Area[] = JSON.parse(fs.readFileSync(path.join(ROOT, "public/geo/areas.json"), "utf8"));

describe("sample dataset contract", () => {
  it("matches the Dataset schema", () => {
    const r = DatasetSchema.safeParse(seed);
    expect(r.success, r.success ? "" : JSON.stringify(r.error.issues.slice(0, 5), null, 1)).toBe(true);
  });

  it("passes integrity checks (ids, partners, sectors, areas, money adds up)", () => {
    expect(integrityProblems(seed, areas)).toEqual([]);
  });

  it("is clearly marked as sample data", () => {
    expect(seed.projects.length).toBeGreaterThan(0);
    expect(seed.projects.every((p) => p.is_sample)).toBe(true);
  });

  it("covers all 7 provinces and every status (so every UI state is exercised)", () => {
    const byCode = new Map(areas.map((a) => [a.code, a]));
    const provinceOf = (c: string): string => (byCode.get(c)?.parent ? provinceOf(byCode.get(c)!.parent!) : c);
    const provs = new Set(seed.projects.flatMap((p) => p.locations.map((l) => provinceOf(l.area_code))));
    expect(provs.size).toBe(7);
    expect(new Set(seed.projects.map((p) => p.status)).size).toBe(4);
  });
});

describe("integrityProblems catches bad data", () => {
  const base = structuredClone(seed);
  it("flags unknown areas, partners and mismatched totals", () => {
    const bad = structuredClone(base);
    bad.projects[0].locations.push({ area_code: "atlantis", share_pct: null });
    bad.projects[1].funding[0].partner_id = "nobody";
    bad.projects[2].funding[0].disbursed_usd += 5_000_000;
    const problems = integrityProblems(bad, areas).join("\n");
    expect(problems).toMatch(/unknown area atlantis/);
    expect(problems).toMatch(/unknown partner nobody/);
    expect(problems).toMatch(/disbursement transactions/);
  });
});
