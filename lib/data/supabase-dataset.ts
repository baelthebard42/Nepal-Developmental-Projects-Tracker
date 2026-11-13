import "server-only";
import type { Dataset, Partner, Project, Sector } from "./types";

// Reads the dataset through Supabase's REST API (PostgREST) with the publishable key.
// Phase 1 RLS allows public SELECT only. Cached by Next's fetch cache for 300 s (plan §8).

interface PartnerRow extends Omit<Partner, "hq"> {
  hq_lng: number;
  hq_lat: number;
}

async function get<T>(path: string): Promise<T> {
  const url = process.env.SUPABASE_URL!.replace(/\/$/, "");
  const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
  const r = await fetch(`${url}/rest/v1/${path}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: "application/json" },
    next: { revalidate: 300 },
    signal: AbortSignal.timeout(10000),
  });
  if (!r.ok) throw new Error(`${path}: HTTP ${r.status} ${(await r.text()).slice(0, 200)}`);
  return r.json() as Promise<T>;
}

const num = (v: unknown) => (v == null ? 0 : Number(v));

export async function loadFromSupabase(): Promise<Dataset> {
  const [projects, partners, sectors, fx] = await Promise.all([
    get<Project[]>("project_dataset?select=*&order=id"),
    get<PartnerRow[]>("partners?select=id,name_en,name_ne,type,iso2,short,hq_lng,hq_lat&order=id"),
    get<Sector[]>("sectors?select=code,name_en,name_ne,dac_codes&order=code"),
    get<{ year: number; usd_npr: number | string }[]>("fx_rates?select=year,usd_npr&order=year"),
  ]);

  return {
    source: "supabase",
    generated_at: new Date().toISOString(),
    partners: partners.map(({ hq_lng, hq_lat, ...p }) => ({ ...p, hq: [num(hq_lng), num(hq_lat)] as [number, number] })),
    sectors: sectors.map((s) => ({ ...s, dac_codes: s.dac_codes ?? [] })),
    projects: projects.map((p) => ({
      ...p,
      progress_pct: num(p.progress_pct),
      links: p.links ?? [],
      funding: (p.funding ?? []).map((f) => ({ ...f, committed_usd: num(f.committed_usd), disbursed_usd: num(f.disbursed_usd) })),
      locations: (p.locations ?? []).map((l) => ({ ...l, share_pct: l.share_pct == null ? null : Number(l.share_pct) })),
      transactions: (p.transactions ?? []).map((t) => ({ ...t, amount_usd: num(t.amount_usd) })),
      updates: p.updates ?? [],
    })),
    fx: Object.fromEntries(fx.map((r) => [String(r.year), num(r.usd_npr)])),
  };
}
