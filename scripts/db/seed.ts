// Replaces all data with data/admin_areas.csv + supabase/seed/sample_projects.json.  npm run db:seed
import fs from "node:fs";
import path from "node:path";
import { Client } from "pg";
import type { Dataset } from "../../lib/data/types";
import { pgConfig } from "./env";

const ROOT = path.resolve(__dirname, "../..");

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const cells: string[] = [];
    let cur = "";
    let q = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (q) {
        if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
        else if (ch === '"') q = false;
        else cur += ch;
      } else if (ch === '"') q = true;
      else if (ch === ",") { cells.push(cur); cur = ""; }
      else cur += ch;
    }
    cells.push(cur);
    rows.push(cells);
  }
  return rows;
}

/** multi-row insert in chunks; values are passed as parameters */
async function insert(c: Client, table: string, cols: string[], rows: unknown[][], chunk = 500) {
  for (let i = 0; i < rows.length; i += chunk) {
    const params: unknown[] = [];
    const tuples = rows.slice(i, i + chunk).map((r) => `(${r.map((v) => { params.push(v); return `$${params.length}`; }).join(",")})`);
    await c.query(`insert into public.${table} (${cols.join(",")}) values ${tuples.join(",")}`, params);
  }
}

async function main() {
  const [, ...areaRows] = parseCsv(fs.readFileSync(path.join(ROOT, "data/admin_areas.csv"), "utf8"));
  const ds: Dataset = JSON.parse(fs.readFileSync(path.join(ROOT, "supabase/seed/sample_projects.json"), "utf8"));
  const rank: Record<string, number> = { province: 0, district: 1, palika: 2 };
  areaRows.sort((a, b) => rank[a[1]] - rank[b[1]]); // parents before children

  const c = new Client(pgConfig());
  await c.connect();
  try {
    await c.query("begin");
    await c.query(`truncate public.project_updates, public.transactions, public.project_locations, public.project_funding,
      public.projects, public.partners, public.sectors, public.fx_rates, public.admin_areas restart identity cascade`);

    await insert(c, "admin_areas", ["code", "level", "parent_code", "name_en", "name_ne", "kind"],
      areaRows.map(([code, level, parent, en, ne, kind]) => [code, level, parent || null, en, ne, kind]));
    await insert(c, "partners", ["id", "name_en", "name_ne", "type", "iso2", "short", "hq_lng", "hq_lat"],
      ds.partners.map((p) => [p.id, p.name_en, p.name_ne, p.type, p.iso2, p.short, p.hq[0], p.hq[1]]));
    await insert(c, "sectors", ["code", "name_en", "name_ne", "dac_codes"],
      ds.sectors.map((s) => [s.code, s.name_en, s.name_ne, s.dac_codes]));
    await insert(c, "fx_rates", ["year", "usd_npr"], Object.entries(ds.fx).map(([y, r]) => [Number(y), r]));
    await insert(c, "projects",
      ["id", "mofa_ref", "title_en", "title_ne", "description_en", "sector_code", "flow_type", "status", "progress_pct",
        "implementing_partner", "start_date", "end_date", "agreement_date", "source", "links", "is_sample"],
      ds.projects.map((p) => [p.id, p.mofa_ref, p.title_en, p.title_ne, p.description_en, p.sector_code, p.flow_type, p.status,
        p.progress_pct, p.implementing_partner, p.start_date, p.end_date, p.agreement_date, p.source, JSON.stringify(p.links), p.is_sample]));
    await insert(c, "project_funding", ["project_id", "partner_id", "committed_usd", "disbursed_usd"],
      ds.projects.flatMap((p) => p.funding.map((f) => [p.id, f.partner_id, f.committed_usd, f.disbursed_usd])));
    await insert(c, "project_locations", ["project_id", "area_code", "share_pct"],
      ds.projects.flatMap((p) => p.locations.map((l) => [p.id, l.area_code, l.share_pct])));
    await insert(c, "transactions", ["project_id", "partner_id", "date", "type", "amount_usd", "note"],
      ds.projects.flatMap((p) => p.transactions.map((t) => [p.id, t.partner_id, t.date, t.type, t.amount_usd, t.note ?? null])));
    await insert(c, "project_updates", ["project_id", "date", "body_en", "progress_pct"],
      ds.projects.flatMap((p) => p.updates.map((u) => [p.id, u.date, u.body_en, u.progress_pct])));
    await c.query("commit");

    const { rows } = await c.query(`select
      (select count(*) from public.admin_areas)::int as admin_areas, (select count(*) from public.partners)::int as partners,
      (select count(*) from public.sectors)::int as sectors, (select count(*) from public.projects)::int as projects,
      (select count(*) from public.project_funding)::int as funding, (select count(*) from public.project_locations)::int as locations,
      (select count(*) from public.transactions)::int as transactions, (select count(*) from public.project_updates)::int as updates,
      (select count(*) from public.fx_rates)::int as fx_rates`);
    console.log("seeded", rows[0]);
  } catch (e) {
    await c.query("rollback").catch(() => {});
    throw e;
  } finally {
    await c.end();
  }
}
main().catch((e) => {
  console.error("seed failed:", e.message);
  process.exit(1);
});
