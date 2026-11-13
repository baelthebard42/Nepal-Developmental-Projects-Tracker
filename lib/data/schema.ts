// Runtime schema for `Dataset` (lib/data/types.ts). Used by tests to check the seed file and the
// Supabase view, and later by the Phase 2 importer to validate real data before it is loaded.
import { z } from "zod";
import { FLOW_TYPES, STATUSES, type Area, type Dataset } from "./types";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD");
const money = z.number().finite().nonnegative();

export const PartnerSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  name_en: z.string().min(1),
  name_ne: z.string().min(1),
  type: z.enum(["bilateral", "multilateral", "ingo", "other"]),
  iso2: z.string().length(2).nullable(),
  short: z.string().min(1).max(8),
  hq: z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]),
});

export const SectorSchema = z.object({
  code: z.string().min(1),
  name_en: z.string().min(1),
  name_ne: z.string().min(1),
  dac_codes: z.array(z.string()),
});

export const ProjectSchema = z.object({
  id: z.string().min(1),
  mofa_ref: z.string(),
  title_en: z.string().min(1),
  title_ne: z.string().min(1),
  description_en: z.string(),
  sector_code: z.string().min(1),
  flow_type: z.enum(FLOW_TYPES as [string, ...string[]]),
  status: z.enum(STATUSES as [string, ...string[]]),
  progress_pct: z.number().min(0).max(100),
  implementing_partner: z.string(),
  start_date: isoDate,
  end_date: isoDate,
  agreement_date: isoDate,
  source: z.string(),
  links: z.array(z.object({ label: z.string(), url: z.string() })),
  is_sample: z.boolean(),
  funding: z.array(z.object({ partner_id: z.string(), committed_usd: money, disbursed_usd: money })).min(1),
  locations: z.array(z.object({ area_code: z.string(), share_pct: z.number().min(0).max(100).nullable() })),
  transactions: z.array(
    z.object({ date: isoDate, type: z.enum(["commitment", "disbursement"]), partner_id: z.string(), amount_usd: money, note: z.string().nullish() }),
  ),
  updates: z.array(z.object({ date: isoDate, body_en: z.string(), progress_pct: z.number().min(0).max(100).nullable() })),
});

export const DatasetSchema = z.object({
  source: z.enum(["seed", "supabase"]),
  generated_at: z.string(),
  partners: z.array(PartnerSchema).min(1),
  sectors: z.array(SectorSchema).min(1),
  projects: z.array(ProjectSchema),
  fx: z.record(z.string().regex(/^\d{4}$/), z.number().positive()),
});

/**
 * Cross-reference checks the schema can't express. Returns human-readable problems (empty = OK).
 * These are the rules every data load (sample or real) must satisfy for the map to add up.
 */
export function integrityProblems(ds: Dataset, areas: Area[]): string[] {
  const out: string[] = [];
  const areaCodes = new Set(areas.map((a) => a.code));
  const partnerIds = new Set(ds.partners.map((p) => p.id));
  const sectorCodes = new Set(ds.sectors.map((s) => s.code));
  const ids = new Set<string>();
  const near = (a: number, b: number) => Math.abs(a - b) <= Math.max(1, Math.abs(b) * 1e-9);

  for (const p of ds.projects) {
    const at = `project ${p.id}`;
    if (ids.has(p.id)) out.push(`${at}: duplicate id`);
    ids.add(p.id);
    if (!sectorCodes.has(p.sector_code)) out.push(`${at}: unknown sector ${p.sector_code}`);
    if (p.start_date > p.end_date) out.push(`${at}: start_date after end_date`);
    const seenPartners = new Set<string>();
    for (const f of p.funding) {
      if (!partnerIds.has(f.partner_id)) out.push(`${at}: unknown partner ${f.partner_id}`);
      if (seenPartners.has(f.partner_id)) out.push(`${at}: partner ${f.partner_id} listed twice in funding`);
      seenPartners.add(f.partner_id);
      if (f.disbursed_usd > f.committed_usd * 1.0001) out.push(`${at}: ${f.partner_id} disbursed more than committed`);
      // when transactions exist they must add up to the funding totals (trend chart == headline totals)
      const tx = p.transactions.filter((t) => t.partner_id === f.partner_id);
      if (tx.length) {
        const c = tx.filter((t) => t.type === "commitment").reduce((s, t) => s + t.amount_usd, 0);
        const d = tx.filter((t) => t.type === "disbursement").reduce((s, t) => s + t.amount_usd, 0);
        if (!near(c, f.committed_usd)) out.push(`${at}: ${f.partner_id} commitment transactions ${c} ≠ committed ${f.committed_usd}`);
        if (!near(d, f.disbursed_usd)) out.push(`${at}: ${f.partner_id} disbursement transactions ${d} ≠ disbursed ${f.disbursed_usd}`);
      }
    }
    for (const t of p.transactions) if (!seenPartners.has(t.partner_id)) out.push(`${at}: transaction for non-funding partner ${t.partner_id}`);
    const codes = p.locations.map((l) => l.area_code);
    for (const c of codes) if (!areaCodes.has(c)) out.push(`${at}: unknown area ${c}`);
    if (new Set(codes).size !== codes.length) out.push(`${at}: duplicate location`);
    const shares = p.locations.map((l) => l.share_pct);
    if (shares.some((s) => s != null)) {
      if (shares.some((s) => s == null)) out.push(`${at}: share_pct must be set for all locations or none`);
      else if (Math.abs(shares.reduce((a, b) => a! + b!, 0)! - 100) > 0.5) out.push(`${at}: location shares don't add up to 100`);
    }
  }
  return out;
}
