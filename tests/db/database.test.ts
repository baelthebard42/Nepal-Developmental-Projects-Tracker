// Database tests: run the real migrations and seed against a throwaway Postgres, then check the
// view the app reads, row-level security and constraints.
//
//   TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/postgres npm run test:db
//
// Never point this at Supabase: the seed step TRUNCATES every table.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "pg";
import { ProjectSchema } from "@/lib/data/schema";
import type { Dataset, Project } from "@/lib/data/types";

const ROOT = path.resolve(import.meta.dirname, "../..");
const URL_ = process.env.TEST_DATABASE_URL;
if (!URL_) throw new Error("TEST_DATABASE_URL is not set (see the header of this file)");
if (/supabase\.(co|com)|pooler\.supabase/.test(URL_)) throw new Error("Refusing to run DB tests against Supabase: they truncate every table.");

const seed: Dataset = JSON.parse(fs.readFileSync(path.join(ROOT, "supabase/seed/sample_projects.json"), "utf8"));
const areaCount = fs.readFileSync(path.join(ROOT, "data/admin_areas.csv"), "utf8").trim().split("\n").length - 1;
const TABLES = ["admin_areas", "partners", "sectors", "projects", "project_funding", "project_locations", "transactions", "project_updates", "fx_rates"];

// the db scripts read SUPABASE_DB_CONNECTION_STR; process env overrides .env, so they hit the test DB
const run = (script: string) =>
  execFileSync(process.execPath, [path.join(ROOT, "node_modules/tsx/dist/cli.mjs"), path.join(ROOT, `scripts/db/${script}.ts`)], {
    env: { ...process.env, SUPABASE_DB_CONNECTION_STR: URL_, DATABASE_URL: URL_ },
    stdio: "pipe",
  }).toString();

const db = new Client({ connectionString: URL_ });
const q = async <T = Record<string, unknown>>(sql: string, params: unknown[] = []) => (await db.query(sql, params)).rows as T[];

beforeAll(async () => {
  await db.connect();
  await db.query(fs.readFileSync(path.join(import.meta.dirname, "bootstrap.sql"), "utf8"));
  run("migrate");
  run("migrate"); // migrations must be re-runnable
  run("seed");
}, 120_000);

afterAll(() => db.end());

describe("migrations + seed", () => {
  it("load every row from the seed files", async () => {
    const [c] = await q<Record<string, string>>(`select
      (select count(*) from admin_areas) areas, (select count(*) from partners) partners,
      (select count(*) from sectors) sectors, (select count(*) from projects) projects,
      (select count(*) from transactions) tx, (select count(*) from fx_rates) fx`);
    expect(Number(c.areas)).toBe(areaCount);
    expect(Number(c.partners)).toBe(seed.partners.length);
    expect(Number(c.sectors)).toBe(seed.sectors.length);
    expect(Number(c.projects)).toBe(seed.projects.length);
    expect(Number(c.tx)).toBe(seed.projects.reduce((s, p) => s + p.transactions.length, 0));
    expect(Number(c.fx)).toBe(Object.keys(seed.fx).length);
  });

  it("seeding twice gives the same result (no duplicates)", async () => {
    run("seed");
    const [c] = await q<{ n: string }>("select count(*) n from projects");
    expect(Number(c.n)).toBe(seed.projects.length);
  });
});

describe("project_dataset view (what the app reads)", () => {
  const norm = (p: Project) => ({
    ...p,
    funding: [...p.funding].sort((a, b) => a.partner_id.localeCompare(b.partner_id)),
    locations: [...p.locations].sort((a, b) => a.area_code.localeCompare(b.area_code)),
    transactions: [...p.transactions]
      .map((t) => ({ ...t, note: t.note ?? null }))
      .sort((a, b) => a.date.localeCompare(b.date) || a.type.localeCompare(b.type) || a.partner_id.localeCompare(b.partner_id) || a.amount_usd - b.amount_usd),
    updates: [...p.updates].sort((a, b) => a.date.localeCompare(b.date) || a.body_en.localeCompare(b.body_en)),
  });

  it("every row matches the Project schema", async () => {
    const rows = await q("select * from project_dataset");
    for (const r of rows) {
      const res = ProjectSchema.safeParse(r);
      expect(res.success, res.success ? "" : `${r.id}: ${JSON.stringify(res.error.issues.slice(0, 3))}`).toBe(true);
    }
  });

  it("round-trips the seed exactly (no data lost or changed on the way through the DB)", async () => {
    const rows = (await q<Project>("select * from project_dataset order by id")).map(norm);
    const expected = [...seed.projects].sort((a, b) => a.id.localeCompare(b.id)).map(norm);
    expect(rows).toEqual(expected);
  });
});

describe("security (Phase 1: public read-only)", () => {
  it("row-level security is enabled on every table", async () => {
    const rows = await q<{ relname: string; relrowsecurity: boolean }>(
      "select relname, relrowsecurity from pg_class where relnamespace = 'public'::regnamespace and relname = any($1)",
      [TABLES],
    );
    expect(rows).toHaveLength(TABLES.length);
    expect(rows.filter((r) => !r.relrowsecurity).map((r) => r.relname)).toEqual([]);
  });

  it("the anonymous API role can read the view", async () => {
    await db.query("begin; set local role anon");
    try {
      const [c] = await q<{ n: string }>("select count(*) n from project_dataset");
      expect(Number(c.n)).toBe(seed.projects.length);
    } finally {
      await db.query("rollback");
    }
  });

  for (const [what, sql] of [
    ["insert", "insert into sectors (code, name_en, name_ne, dac_codes) values ('x', 'x', 'x', '{}')"],
    ["update", "update projects set title_en = 'hacked'"],
    ["delete", "delete from transactions"],
  ] as const) {
    it(`the anonymous API role cannot ${what}`, async () => {
      await db.query("begin; set local role anon");
      try {
        let changed = 0;
        try {
          changed = (await db.query(sql)).rowCount ?? 0;
        } catch (e) {
          expect(String((e as Error).message)).toMatch(/permission denied|row-level security/);
        }
        expect(changed).toBe(0);
      } finally {
        await db.query("rollback");
      }
    });
  }
});

describe("constraints keep the map consistent", () => {
  const rejects = async (sql: string) => {
    await db.query("begin");
    try {
      await expect(db.query(sql)).rejects.toThrow();
    } finally {
      await db.query("rollback");
    }
  };
  it("a location must be a known area", () => rejects(`insert into project_locations (project_id, area_code) values ('${seed.projects[0].id}', 'atlantis')`));
  it("funding must reference a known partner", () =>
    rejects(`insert into project_funding (project_id, partner_id, committed_usd, disbursed_usd) values ('${seed.projects[0].id}', 'nobody', 1, 0)`));
  it("status must be one of the four statuses", () => rejects(`update projects set status = 'abandoned' where id = '${seed.projects[0].id}'`));
});
