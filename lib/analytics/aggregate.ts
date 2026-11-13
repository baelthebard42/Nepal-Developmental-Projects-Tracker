// Filtering and aggregation (plan §6.4). Pure functions, unit tested in tests/unit/aggregate.test.ts.
//
// Double-counting rules:
//  - A project with several locations is split across them (share_pct, else equally) for AREA totals.
//  - National totals count each project once.
//  - Co-financed projects are split by funding row, so partner totals add up to the project total.
import type { Area, Dataset, FlowType, Project, Status } from "@/lib/data/types";
import type { AreaIndex } from "@/lib/geo/area-index";

export interface Filters {
  year: number | null;
  partners: string[];
  sectors: string[];
  status: Status[];
  flow: FlowType[];
  /** restrict to projects located in any of these areas */
  areas: string[];
}

export const EMPTY_FILTERS: Filters = { year: null, partners: [], sectors: [], status: [], flow: [], areas: [] };

export interface ProjectView {
  project: Project;
  /** funding after partner + year filters */
  funding: { partner_id: string; committed: number; disbursed: number }[];
  committed: number;
  disbursed: number;
}

export interface Totals {
  committed: number;
  disbursed: number;
  count: number;
}

export interface Row extends Totals {
  key: string;
  /** disbursed in the comparison year vs. the year before: +1 up, -1 down, 0 flat/none */
  trend: number;
}

export interface Aggregate {
  totals: Totals;
  partners: Row[];
  sectors: Row[];
  /** children of the scope (provinces at national level, districts in a province, palikas in a district) */
  locations: Row[];
  /** Nationwide / province-wide / district-wide projects not attributable to a child area */
  unallocated: Totals;
  /** every area code -> totals (each location contributes to itself and its ancestors) */
  byArea: Map<string, Totals & { partners: Map<string, number>; status: Record<Status, number> }>;
  /** per-year commitments and disbursements (ignores the year filter) */
  byYear: { year: number; committed: number; disbursed: number }[];
}

const yearOf = (d: string) => Number(d.slice(0, 4));

export function locationShares(p: Project): { code: string; share: number }[] {
  const n = p.locations.length;
  if (!n) return [];
  const explicit = p.locations.every((l) => l.share_pct != null);
  return p.locations.map((l) => ({ code: l.area_code, share: explicit ? l.share_pct! / 100 : 1 / n }));
}

export function filterProjects(ds: Dataset, f: Filters, idx: AreaIndex | null, opts: { ignoreYear?: boolean } = {}): ProjectView[] {
  const year = opts.ignoreYear ? null : f.year;
  const partnerSet = f.partners.length ? new Set(f.partners) : null;
  const out: ProjectView[] = [];
  for (const p of ds.projects) {
    if (f.sectors.length && !f.sectors.includes(p.sector_code)) continue;
    if (f.status.length && !f.status.includes(p.status)) continue;
    if (f.flow.length && !f.flow.includes(p.flow_type)) continue;
    if (partnerSet && !p.funding.some((x) => partnerSet.has(x.partner_id))) continue;
    if (f.areas.length && idx && !p.locations.some((l) => f.areas.some((a) => idx.within(l.area_code, a)))) continue;

    let funding = p.funding.filter((x) => !partnerSet || partnerSet.has(x.partner_id))
      .map((x) => ({ partner_id: x.partner_id, committed: x.committed_usd, disbursed: x.disbursed_usd }));
    if (year !== null) {
      const active = yearOf(p.start_date) <= year && yearOf(p.end_date) >= year;
      const tx = p.transactions.filter((t) => yearOf(t.date) === year && (!partnerSet || partnerSet.has(t.partner_id)));
      if (!active && !tx.length) continue;
      funding = funding.map((x) => ({
        partner_id: x.partner_id,
        committed: tx.filter((t) => t.type === "commitment" && t.partner_id === x.partner_id).reduce((a, t) => a + t.amount_usd, 0),
        disbursed: tx.filter((t) => t.type === "disbursement" && t.partner_id === x.partner_id).reduce((a, t) => a + t.amount_usd, 0),
      }));
    }
    out.push({
      project: p,
      funding,
      committed: funding.reduce((a, x) => a + x.committed, 0),
      disbursed: funding.reduce((a, x) => a + x.disbursed, 0),
    });
  }
  return out;
}

/** fraction of a project attributable to `scope` (null = Nepal = 1) */
export function scopeShare(p: Project, scope: string | null, idx: AreaIndex): number {
  if (scope === null) return 1;
  return locationShares(p).reduce((a, l) => a + (idx.within(l.code, scope) ? l.share : 0), 0);
}

const emptyStatus = (): Record<Status, number> => ({ pipeline: 0, ongoing: 0, completed: 0, suspended: 0 });

export function aggregate(
  views: ProjectView[],
  allYears: ProjectView[],
  scope: string | null,
  idx: AreaIndex,
  opts: { compareYear: number; childLevelAreas?: Area[] },
): Aggregate {
  const totals: Totals = { committed: 0, disbursed: 0, count: 0 };
  const partners = new Map<string, Row>();
  const sectors = new Map<string, Row>();
  const unallocated: Totals = { committed: 0, disbursed: 0, count: 0 };
  const byArea: Aggregate["byArea"] = new Map();
  const children = opts.childLevelAreas ?? idx.children(scope);
  const childSet = new Set(children.map((c) => c.code));
  const locations = new Map<string, Row>(children.map((c) => [c.code, { key: c.code, committed: 0, disbursed: 0, count: 0, trend: 0 }]));

  const bump = (m: Map<string, Row>, key: string, c: number, d: number, n: number) => {
    const r = m.get(key) ?? { key, committed: 0, disbursed: 0, count: 0, trend: 0 };
    r.committed += c; r.disbursed += d; r.count += n;
    m.set(key, r);
  };

  for (const v of views) {
    const p = v.project;
    // area totals (scope independent, used for the map)
    const shares = locationShares(p);
    const touched = new Set<string>();
    for (const l of shares) {
      for (const code of idx.lineage(l.code)) {
        const a = byArea.get(code) ?? { committed: 0, disbursed: 0, count: 0, partners: new Map(), status: emptyStatus() };
        a.committed += v.committed * l.share;
        a.disbursed += v.disbursed * l.share;
        for (const f of v.funding) a.partners.set(f.partner_id, (a.partners.get(f.partner_id) ?? 0) + f.committed * l.share);
        if (!touched.has(code)) { a.count++; a.status[p.status]++; touched.add(code); }
        byArea.set(code, a);
      }
    }

    const share = scopeShare(p, scope, idx);
    if (share <= 0) continue;
    totals.committed += v.committed * share;
    totals.disbursed += v.disbursed * share;
    totals.count++;
    for (const f of v.funding) bump(partners, f.partner_id, f.committed * share, f.disbursed * share, 1);
    bump(sectors, p.sector_code, v.committed * share, v.disbursed * share, 1);

    // split among the scope's children
    let allocated = 0;
    const counted = new Set<string>();
    for (const l of shares) {
      const child = idx.lineage(l.code).find((c) => childSet.has(c));
      if (!child) continue;
      allocated += l.share;
      bump(locations, child, v.committed * l.share, v.disbursed * l.share, counted.has(child) ? 0 : 1);
      counted.add(child);
    }
    const rest = share - allocated;
    if (rest > 1e-9) {
      unallocated.committed += v.committed * rest;
      unallocated.disbursed += v.disbursed * rest;
      unallocated.count++;
    }
  }

  // trend chart + trend arrows from transactions (respect partner filter and scope)
  const yearMap = new Map<number, { committed: number; disbursed: number }>();
  const partnerYear = new Map<string, Map<number, number>>();
  const sectorYear = new Map<string, Map<number, number>>();
  const locYear = new Map<string, Map<number, number>>();
  const addPY = (m: Map<string, Map<number, number>>, k: string, y: number, amt: number) => {
    const inner = m.get(k) ?? new Map();
    inner.set(y, (inner.get(y) ?? 0) + amt);
    m.set(k, inner);
  };
  for (const v of allYears) {
    const share = scopeShare(v.project, scope, idx);
    if (share <= 0) continue;
    const allowed = new Set(v.funding.map((f) => f.partner_id));
    const shares = locationShares(v.project);
    for (const t of v.project.transactions) {
      if (!allowed.has(t.partner_id)) continue;
      const y = yearOf(t.date);
      const e = yearMap.get(y) ?? { committed: 0, disbursed: 0 };
      if (t.type === "commitment") e.committed += t.amount_usd * share;
      else {
        e.disbursed += t.amount_usd * share;
        addPY(partnerYear, t.partner_id, y, t.amount_usd * share);
        addPY(sectorYear, v.project.sector_code, y, t.amount_usd * share);
        for (const l of shares) {
          const child = idx.lineage(l.code).find((c) => childSet.has(c));
          if (child) addPY(locYear, child, y, t.amount_usd * l.share);
        }
      }
      yearMap.set(y, e);
    }
  }
  const trendOf = (m: Map<number, number> | undefined) => {
    const a = m?.get(opts.compareYear) ?? 0;
    const b = m?.get(opts.compareYear - 1) ?? 0;
    if (!a && !b) return 0;
    return a > b * 1.05 ? 1 : a < b * 0.95 ? -1 : 0;
  };
  for (const r of partners.values()) r.trend = trendOf(partnerYear.get(r.key));
  for (const r of sectors.values()) r.trend = trendOf(sectorYear.get(r.key));
  for (const r of locations.values()) r.trend = trendOf(locYear.get(r.key));

  const sort = (m: Map<string, Row>) => [...m.values()].sort((a, b) => b.committed - a.committed || b.count - a.count);
  const years = [...yearMap.keys()];
  const byYear: Aggregate["byYear"] = [];
  if (years.length) for (let y = Math.min(...years); y <= Math.max(...years); y++) byYear.push({ year: y, ...(yearMap.get(y) ?? { committed: 0, disbursed: 0 }) });

  return { totals, partners: sort(partners), sectors: sort(sectors), locations: sort(locations), unallocated, byArea, byYear };
}
