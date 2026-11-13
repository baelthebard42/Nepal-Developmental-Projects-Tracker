import { describe, expect, it } from "vitest";
import { aggregate, EMPTY_FILTERS, filterProjects } from "@/lib/analytics/aggregate";
import { AreaIndex } from "@/lib/geo/area-index";
import { formatNPR, formatUSD } from "@/lib/format/money";
import type { Area, Dataset, Project } from "@/lib/data/types";

const A = (code: string, level: Area["level"], parent: string | null): Area => ({
  code, level, parent, name_en: code, name_ne: code, short: code, kind: level, bbox: [0, 0, 1, 1], label: [0, 0],
});
const idx = new AreaIndex([
  A("P3", "province", null), A("kathmandu", "district", "P3"), A("lalitpur", "district", "P3"),
  A("kathmandu~kmc", "palika", "kathmandu"), A("P4", "province", null), A("kaski", "district", "P4"),
]);

const proj = (id: string, locs: string[], funding: [string, number, number][], extra: Partial<Project> = {}): Project => ({
  id, mofa_ref: id, title_en: id, title_ne: id, description_en: "", sector_code: "transport", flow_type: "grant",
  status: "ongoing", progress_pct: 50, implementing_partner: "", start_date: "2020-01-01", end_date: "2025-12-31",
  agreement_date: "2019-06-01", source: "", links: [], is_sample: true,
  funding: funding.map(([p, c, d]) => ({ partner_id: p, committed_usd: c, disbursed_usd: d })),
  locations: locs.map((c) => ({ area_code: c, share_pct: null })),
  transactions: funding.flatMap(([p, c, d]) => [
    { date: "2019-06-01", type: "commitment" as const, partner_id: p, amount_usd: c },
    { date: "2021-03-01", type: "disbursement" as const, partner_id: p, amount_usd: d },
  ]),
  updates: [], ...extra,
});

const ds: Dataset = {
  source: "seed", generated_at: "", partners: [], sectors: [], fx: { 2025: 140 },
  projects: [
    proj("a", ["kathmandu~kmc"], [["japan", 100, 40]]),
    proj("b", ["kathmandu", "kaski"], [["india", 200, 100], ["adb", 50, 0]]), // co-financed, 2 provinces
    proj("c", [], [["japan", 30, 30]]), // nationwide
  ],
};

const run = (scope: string | null, f = EMPTY_FILTERS) => {
  const v = filterProjects(ds, f, idx);
  return aggregate(v, filterProjects(ds, f, idx, { ignoreYear: true }), scope, idx, { compareYear: 2021 });
};

describe("aggregate", () => {
  it("national totals count each project once", () => {
    const r = run(null);
    expect(r.totals).toEqual({ committed: 380, disbursed: 170, count: 3 });
    expect(r.unallocated.committed).toBe(30);
  });
  it("splits multi-location projects across areas without double counting", () => {
    const r = run(null);
    expect(r.byArea.get("P3")!.committed).toBe(100 + 125);
    expect(r.byArea.get("P4")!.committed).toBe(125);
    const sumProvinces = r.locations.reduce((a, x) => a + x.committed, 0);
    expect(sumProvinces + r.unallocated.committed).toBe(r.totals.committed);
  });
  it("scopes totals to a province", () => {
    const r = run("P3");
    expect(r.totals.committed).toBe(225);
    expect(r.totals.count).toBe(2);
    expect(r.locations.find((x) => x.key === "kathmandu")!.committed).toBe(225);
  });
  it("splits co-financing by partner", () => {
    const r = run(null);
    expect(r.partners.find((p) => p.key === "india")!.committed).toBe(200);
    expect(r.partners.find((p) => p.key === "adb")!.committed).toBe(50);
  });
  it("partner filter restricts funding to that partner", () => {
    const r = run(null, { ...EMPTY_FILTERS, partners: ["adb"] });
    expect(r.totals).toEqual({ committed: 50, disbursed: 0, count: 1 });
  });
  it("year filter uses that year's transactions", () => {
    const r = run(null, { ...EMPTY_FILTERS, year: 2021 });
    expect(r.totals.disbursed).toBe(170);
    expect(r.totals.committed).toBe(0);
    expect(r.byYear.find((y) => y.year === 2019)!.committed).toBe(380);
  });
});

describe("money", () => {
  it("formats USD and NPR (lakh/crore/arba)", () => {
    expect(formatUSD(1_234_000_000)).toBe("USD 1.2B");
    expect(formatUSD(450_000_000)).toBe("USD 450M");
    expect(formatNPR(156_000_000)).toBe("Rs 15.6 crore");
    expect(formatNPR(8_400_000_000)).toBe("Rs 8.4 arba");
    expect(formatNPR(250_000)).toBe("Rs 2.5 lakh");
  });
});
