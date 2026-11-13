// Generates SAMPLE data (plan §9): ~80 plausible projects with real partner names, real sectors and
// real area codes. Every project has is_sample = true and the UI shows a "Sample data" badge.
// Deterministic (seeded) so the output only changes when this script changes.
//   npm run seed:generate  ->  supabase/seed/sample_projects.json
import fs from "node:fs";
import path from "node:path";
import type { Area, Dataset, FlowType, Partner, Project, Sector, Status, Transaction } from "../../lib/data/types";

const ROOT = path.resolve(__dirname, "../..");
const areas: Area[] = JSON.parse(fs.readFileSync(path.join(ROOT, "public/geo/areas.json"), "utf8"));

// ---------- seeded RNG ----------
let s = 20261113;
const rnd = () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);
const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)];
const between = (a: number, b: number) => a + rnd() * (b - a);
const weighted = <T,>(items: [T, number][]) => {
  const t = items.reduce((x, [, w]) => x + w, 0);
  let r = rnd() * t;
  for (const [v, w] of items) if ((r -= w) <= 0) return v;
  return items[0][0];
};

// ---------- partners ----------
const partners: Partner[] = [
  { id: "japan", name_en: "Japan", name_ne: "Japan", type: "bilateral", iso2: "jp", short: "JP", hq: [139.69, 35.69] },
  { id: "india", name_en: "India", name_ne: "Bharat", type: "bilateral", iso2: "in", short: "IN", hq: [77.21, 28.61] },
  { id: "china", name_en: "China", name_ne: "Chin", type: "bilateral", iso2: "cn", short: "CN", hq: [116.4, 39.9] },
  { id: "usa", name_en: "United States", name_ne: "Sanyukta Rajya America", type: "bilateral", iso2: "us", short: "US", hq: [-77.04, 38.9] },
  { id: "uk", name_en: "United Kingdom", name_ne: "Belayat (UK)", type: "bilateral", iso2: "gb", short: "UK", hq: [-0.13, 51.5] },
  { id: "germany", name_en: "Germany", name_ne: "Germany", type: "bilateral", iso2: "de", short: "DE", hq: [13.4, 52.52] },
  { id: "switzerland", name_en: "Switzerland", name_ne: "Switzerland", type: "bilateral", iso2: "ch", short: "CH", hq: [7.45, 46.95] },
  { id: "norway", name_en: "Norway", name_ne: "Norway", type: "bilateral", iso2: "no", short: "NO", hq: [10.75, 59.91] },
  { id: "korea", name_en: "South Korea", name_ne: "Dakshin Korea", type: "bilateral", iso2: "kr", short: "KR", hq: [126.98, 37.57] },
  { id: "australia", name_en: "Australia", name_ne: "Australia", type: "bilateral", iso2: "au", short: "AU", hq: [149.13, -35.28] },
  { id: "finland", name_en: "Finland", name_ne: "Finland", type: "bilateral", iso2: "fi", short: "FI", hq: [24.94, 60.17] },
  { id: "eu", name_en: "European Union", name_ne: "Europeli Sangh", type: "multilateral", iso2: "eu", short: "EU", hq: [4.35, 50.85] },
  { id: "adb", name_en: "Asian Development Bank", name_ne: "Asiyali Bikas Bank", type: "multilateral", iso2: null, short: "ADB", hq: [121.06, 14.59] },
  { id: "world-bank", name_en: "World Bank", name_ne: "Bishwa Bank", type: "multilateral", iso2: null, short: "WB", hq: [-77.04, 38.9] },
  { id: "undp", name_en: "UNDP", name_ne: "UNDP", type: "multilateral", iso2: null, short: "UNDP", hq: [-73.97, 40.75] },
  { id: "unicef", name_en: "UNICEF", name_ne: "UNICEF", type: "multilateral", iso2: null, short: "UNICEF", hq: [-73.97, 40.75] },
  { id: "wfp", name_en: "World Food Programme", name_ne: "Bishwa Khadya Karyakram", type: "multilateral", iso2: null, short: "WFP", hq: [12.5, 41.9] },
  { id: "ifad", name_en: "IFAD", name_ne: "IFAD", type: "multilateral", iso2: null, short: "IFAD", hq: [12.5, 41.9] },
];

// ---------- sectors (grouped DAC codes) ----------
const sectors: Sector[] = [
  { code: "transport", name_en: "Transport", name_ne: "Yatayat", dac_codes: ["210"] },
  { code: "energy", name_en: "Energy", name_ne: "Urja", dac_codes: ["230"] },
  { code: "water", name_en: "Water & Sanitation", name_ne: "Khanepani tatha Sarsafai", dac_codes: ["140"] },
  { code: "health", name_en: "Health", name_ne: "Swasthya", dac_codes: ["120", "130"] },
  { code: "education", name_en: "Education", name_ne: "Shiksha", dac_codes: ["110"] },
  { code: "agriculture", name_en: "Agriculture & Food Security", name_ne: "Krishi tatha Khadya Surakshya", dac_codes: ["310", "520"] },
  { code: "governance", name_en: "Governance & Federalism", name_ne: "Sushasan tatha Sanghiyata", dac_codes: ["151"] },
  { code: "disaster", name_en: "Disaster Risk & Reconstruction", name_ne: "Bipad Jokhim tatha Punarnirman", dac_codes: ["730", "740"] },
  { code: "climate", name_en: "Environment & Climate", name_ne: "Batabaran tatha Jalbayu", dac_codes: ["410"] },
  { code: "trade", name_en: "Trade, Industry & Tourism", name_ne: "Byapar, Udyog tatha Paryatan", dac_codes: ["250", "320", "330"] },
  { code: "social", name_en: "Social Protection & Gender", name_ne: "Samajik Surakshya tatha Laingik Samanata", dac_codes: ["160"] },
  { code: "urban", name_en: "Urban Development", name_ne: "Shahari Bikas", dac_codes: ["430"] },
];

// title templates per sector: [english, romanized nepali]; {p} = place
const TITLES: Record<string, [string, string][]> = {
  transport: [["{p} Rural Road Connectivity Improvement", "{p} Grameen Sadak Sanjal Sudhar"], ["Strategic Road Upgrading: {p}", "Rananitik Sadak StarOnnati: {p}"], ["{p} Motorable Bridges Programme", "{p} Motorbato Pul Karyakram"], ["{p} Highway Safety and Maintenance", "{p} Rajmarga Surakshya tatha Marmat"]],
  energy: [["{p} Transmission Line and Substations", "{p} Prasaran Line tatha Sabstation"], ["{p} Small Hydropower Development", "{p} Sana Jalvidyut Bikas"], ["Solar Mini-Grids for {p}", "{p} ka lagi Saur Mini-Grid"], ["{p} Distribution System Strengthening", "{p} Bitaran Pranali Sudridhikaran"]],
  water: [["{p} Drinking Water and Sanitation", "{p} Khanepani tatha Sarsafai"], ["{p} Town Water Supply Improvement", "{p} Bazar Khanepani Sudhar"], ["{p} Irrigation Canal Rehabilitation", "{p} Sinchai Nahar Punarsthapana"]],
  health: [["{p} Maternal and Newborn Health", "{p} Matri tatha Navashishu Swasthya"], ["{p} Hospital Upgrading", "{p} Aspatal StarOnnati"], ["{p} Primary Health Care Strengthening", "{p} Prathamik Swasthya Sewa Sudridhikaran"]],
  education: [["{p} School Sector Support", "{p} Vidyalaya Kshetra Sahayog"], ["{p} Technical and Vocational Skills", "{p} Prabidhik tatha Byabasayik Seep"], ["Safe Schools Reconstruction: {p}", "Surakshit Vidyalaya Punarnirman: {p}"]],
  agriculture: [["{p} Agricultural Value Chains", "{p} Krishi Mulya Shrinkhala"], ["{p} Food and Nutrition Security", "{p} Khadya tatha Poshan Surakshya"], ["{p} High-Value Crops and Market Access", "{p} Uchcha Mulya Bali tatha Bazar Pahunch"]],
  governance: [["{p} Local Government Capacity Building", "{p} Sthaniya Sarkar Kshamata Bikas"], ["Provincial Public Finance: {p}", "Pradesh Sarvajanik Bitta: {p}"], ["{p} Digital Public Services", "{p} Digital Sarvajanik Sewa"]],
  disaster: [["{p} Earthquake Housing Reconstruction", "{p} Bhukampa Aawas Punarnirman"], ["{p} Flood Early Warning and Resilience", "{p} Badhi Purva Suchana tatha Utthanshilata"], ["{p} Landslide Risk Reduction", "{p} Pahiro Jokhim Nyunikaran"]],
  climate: [["{p} Community Forestry and Climate Adaptation", "{p} Samudayik Ban tatha Jalbayu Anukulan"], ["{p} Watershed Management", "{p} Jalaadhar Byabasthapan"], ["{p} Clean Air and Urban Greening", "{p} Swachchha Hawa tatha Harit Shahar"]],
  trade: [["{p} Tourism Infrastructure", "{p} Paryatan Purbadhar"], ["{p} Small Enterprise Finance", "{p} Sana Udyam Bitta"], ["{p} Trade Logistics and Dry Port", "{p} Byapar Logistics tatha Sukkha Bandargah"]],
  social: [["{p} Women's Economic Empowerment", "{p} Mahila Aarthik Sashaktikaran"], ["{p} Child Grant and Social Protection", "{p} Bal Anudan tatha Samajik Surakshya"], ["{p} Inclusive Livelihoods", "{p} Samabeshi Jeevikopārjan"]],
  urban: [["{p} Integrated Urban Development", "{p} Ekikrit Shahari Bikas"], ["{p} Municipal Infrastructure", "{p} Nagar Purbadhar"], ["{p} Solid Waste Management", "{p} Thos Fohor Byabasthapan"]],
};

// partner profile: favourite sectors, typical flow, size range (USD m)
const PROFILE: Record<string, { sectors: string[]; flow: [FlowType, number][]; size: [number, number]; n: number }> = {
  japan: { sectors: ["transport", "disaster", "water", "education", "health"], flow: [["grant", 6], ["loan", 3], ["technical_assistance", 2]], size: [8, 160], n: 7 },
  india: { sectors: ["transport", "energy", "health", "education", "disaster"], flow: [["grant", 5], ["loan", 4]], size: [3, 220], n: 7 },
  china: { sectors: ["transport", "energy", "trade", "health"], flow: [["grant", 6], ["loan", 2]], size: [10, 180], n: 5 },
  usa: { sectors: ["health", "governance", "agriculture", "energy", "climate"], flow: [["grant", 8], ["technical_assistance", 3]], size: [5, 120], n: 6 },
  uk: { sectors: ["governance", "climate", "social", "disaster"], flow: [["grant", 6], ["technical_assistance", 4]], size: [5, 90], n: 5 },
  germany: { sectors: ["energy", "health", "climate", "trade"], flow: [["grant", 5], ["technical_assistance", 4], ["loan", 1]], size: [4, 70], n: 4 },
  switzerland: { sectors: ["transport", "agriculture", "governance", "education"], flow: [["grant", 7], ["technical_assistance", 3]], size: [3, 45], n: 5 },
  norway: { sectors: ["energy", "education", "climate"], flow: [["grant", 7]], size: [3, 40], n: 3 },
  korea: { sectors: ["health", "agriculture", "urban"], flow: [["grant", 5], ["loan", 2]], size: [3, 50], n: 3 },
  australia: { sectors: ["education", "social", "water"], flow: [["grant", 6]], size: [2, 25], n: 2 },
  finland: { sectors: ["water", "education"], flow: [["grant", 6], ["technical_assistance", 2]], size: [2, 30], n: 2 },
  eu: { sectors: ["education", "agriculture", "governance", "climate"], flow: [["grant", 7]], size: [10, 110], n: 4 },
  adb: { sectors: ["transport", "energy", "urban", "water", "disaster"], flow: [["loan", 8], ["grant", 2]], size: [40, 300], n: 7 },
  "world-bank": { sectors: ["energy", "transport", "disaster", "education", "agriculture", "social"], flow: [["loan", 7], ["grant", 2]], size: [40, 320], n: 7 },
  undp: { sectors: ["governance", "climate", "disaster", "social"], flow: [["grant", 4], ["technical_assistance", 6]], size: [1, 20], n: 4 },
  unicef: { sectors: ["health", "education", "social", "water"], flow: [["grant", 6], ["in_kind", 2]], size: [1, 18], n: 3 },
  wfp: { sectors: ["agriculture", "education"], flow: [["in_kind", 5], ["grant", 3]], size: [2, 25], n: 2 },
  ifad: { sectors: ["agriculture"], flow: [["loan", 6], ["grant", 2]], size: [15, 60], n: 2 },
};

const IMPLEMENTERS: Record<string, string[]> = {
  transport: ["Department of Roads", "Department of Local Infrastructure", "Ministry of Physical Infrastructure and Transport"],
  energy: ["Nepal Electricity Authority", "Alternative Energy Promotion Centre"],
  water: ["Department of Water Supply and Sewerage Management", "Department of Water Resources and Irrigation"],
  health: ["Ministry of Health and Population", "Department of Health Services"],
  education: ["Centre for Education and Human Resource Development", "CTEVT"],
  agriculture: ["Ministry of Agriculture and Livestock Development", "Provincial Ministry of Land Management and Agriculture"],
  governance: ["Ministry of Federal Affairs and General Administration", "Provincial and Local Governance Support Programme"],
  disaster: ["National Disaster Risk Reduction and Management Authority", "National Reconstruction Authority (legacy)"],
  climate: ["Ministry of Forests and Environment", "Department of Hydrology and Meteorology"],
  trade: ["Ministry of Industry, Commerce and Supplies", "Nepal Tourism Board"],
  social: ["Ministry of Women, Children and Senior Citizens", "Department of National ID and Civil Registration"],
  urban: ["Department of Urban Development and Building Construction", "Town Development Fund"],
};

const fx: Record<string, number> = { 2015: 102.4, 2016: 107.4, 2017: 104.5, 2018: 108.9, 2019: 112.6, 2020: 118.3, 2021: 117.9, 2022: 125.3, 2023: 132.1, 2024: 133.9, 2025: 137.6, 2026: 140.2 };

const provinces = areas.filter((a) => a.level === "province");
const districts = areas.filter((a) => a.level === "district");
const palikas = areas.filter((a) => a.level === "palika" && a.kind === "palika");
const TODAY = new Date("2026-11-13");
const iso = (d: Date) => d.toISOString().slice(0, 10);
const round = (v: number, step = 1000) => Math.round(v / step) * step;

const projects: Project[] = [];
let ref = 1;
for (const partner of partners) {
  const prof = PROFILE[partner.id];
  for (let i = 0; i < prof.n; i++) {
    const sector = pick(prof.sectors);
    const flow = weighted(prof.flow);

    // ----- location: palika(s), district(s), province, or nationwide
    const scope = weighted<"palika" | "district" | "multi" | "province" | "national">([["palika", 3], ["district", 4], ["multi", 3], ["province", 1.2], ["national", 0.8]]);
    let locs: string[] = [];
    let place = "";
    if (scope === "palika") {
      const p = pick(palikas);
      locs = [p.code];
      if (rnd() < 0.4) locs.push(pick(palikas.filter((x) => x.parent === p.parent && x.code !== p.code)).code);
      place = p.short;
    } else if (scope === "district") {
      const d = pick(districts);
      locs = [d.code];
      place = d.short;
    } else if (scope === "multi") {
      const prov = pick(provinces);
      const ds = districts.filter((d) => d.parent === prov.code).sort(() => rnd() - 0.5).slice(0, 2 + Math.floor(rnd() * 3));
      locs = ds.map((d) => d.code);
      place = prov.short;
    } else if (scope === "province") {
      const prov = pick(provinces);
      locs = [prov.code];
      place = prov.short;
    } else {
      place = "Nepal";
    }
    const [tEn, tNe] = pick(TITLES[sector]);
    const placeNe = place;

    // ----- dates / status
    const start = new Date(Date.UTC(2016 + Math.floor(rnd() * 12), Math.floor(rnd() * 12), 1));
    const agreement = new Date(start.getTime() - between(60, 300) * 864e5);
    const durYears = Math.round(between(2, 7));
    const end = new Date(Date.UTC(start.getUTCFullYear() + durYears, start.getUTCMonth(), 28));
    let status: Status;
    if (start > TODAY) status = "pipeline";
    else if (end < TODAY) status = rnd() < 0.9 ? "completed" : "ongoing";
    else status = rnd() < 0.07 ? "suspended" : "ongoing";
    const elapsed = Math.min(1, Math.max(0, (TODAY.getTime() - start.getTime()) / (end.getTime() - start.getTime())));
    const progress = status === "completed" ? 100 : status === "pipeline" ? 0 : Math.round(Math.min(97, elapsed * between(70, 110)));

    // ----- money
    const committed = round(between(prof.size[0], prof.size[1]) * 1e6, 10000);
    const disbRatio = status === "completed" ? between(0.85, 1) : status === "pipeline" ? 0 : Math.min(0.95, progress / 100 * between(0.7, 1.05));
    const fundings = [{ partner_id: partner.id, committed_usd: committed, disbursed_usd: 0 }];
    // ~15% co-financed
    if (rnd() < 0.15) {
      const co = pick(partners.filter((p) => p.id !== partner.id && PROFILE[p.id].sectors.includes(sector)));
      if (co) fundings.push({ partner_id: co.id, committed_usd: round(committed * between(0.15, 0.5), 10000), disbursed_usd: 0 });
    }
    const transactions: Transaction[] = [];
    for (const f of fundings) {
      transactions.push({ date: iso(agreement), type: "commitment", partner_id: f.partner_id, amount_usd: f.committed_usd, note: "Financing agreement signed" });
      const total = round(f.committed_usd * disbRatio, 1000);
      const lastYear = Math.min(end.getUTCFullYear(), TODAY.getUTCFullYear());
      const years: number[] = [];
      for (let y = start.getUTCFullYear(); y <= lastYear; y++) years.push(y);
      if (total > 0 && years.length) {
        const weights = years.map((_, k) => 0.6 + Math.sin((k + 1) / (years.length + 1) * Math.PI) + rnd() * 0.4);
        const wsum = weights.reduce((a, b) => a + b, 0);
        let left = total;
        years.forEach((y, k) => {
          const amt = k === years.length - 1 ? left : round(total * weights[k] / wsum, 1000);
          left -= amt;
          const month = y === TODAY.getUTCFullYear() ? Math.floor(rnd() * 10) : Math.floor(rnd() * 12);
          transactions.push({ date: iso(new Date(Date.UTC(y, month, 15))), type: "disbursement", partner_id: f.partner_id, amount_usd: amt, note: null });
        });
      }
      f.disbursed_usd = total;
    }
    transactions.sort((a, b) => a.date.localeCompare(b.date));

    const updates = status === "pipeline" ? [] : [
      { date: iso(new Date(start.getTime() + 120 * 864e5)), body_en: "Project management unit established and inception workshop held with the local government.", progress_pct: Math.min(progress, 5) },
      ...(progress > 30 ? [{ date: iso(new Date(start.getTime() + (end.getTime() - start.getTime()) * 0.4)), body_en: "Mid-term review completed. Works on schedule; procurement for the second package is under way.", progress_pct: Math.min(progress, 40) }] : []),
      ...(status === "completed" ? [{ date: iso(end), body_en: "Physical works completed and handed over. Completion report submitted.", progress_pct: 100 }] : []),
      ...(status === "suspended" ? [{ date: iso(new Date(TODAY.getTime() - 90 * 864e5)), body_en: "Works temporarily suspended pending resolution of land acquisition issues.", progress_pct: progress }] : []),
    ].reverse();

    const id = `SAMPLE-${String(ref).padStart(3, "0")}`;
    projects.push({
      id,
      mofa_ref: `MOFA/DP/${start.getUTCFullYear()}/${String(ref).padStart(3, "0")}`,
      title_en: tEn.replace("{p}", place),
      title_ne: tNe.replace("{p}", placeNe),
      description_en: `Sample project for demonstration only. Supports ${sectors.find((x) => x.code === sector)!.name_en.toLowerCase()} outcomes in ${place === "Nepal" ? "all seven provinces" : scope === "province" || scope === "multi" ? `${place} Province` : place}, financed by ${partner.name_en}${fundings.length > 1 ? " with co-financing" : ""} and implemented by ${IMPLEMENTERS[sector][0]}.`,
      sector_code: sector,
      flow_type: flow,
      status,
      progress_pct: progress,
      implementing_partner: pick(IMPLEMENTERS[sector]),
      start_date: iso(start),
      end_date: iso(end),
      agreement_date: iso(agreement),
      source: "Sample data generated for the Phase 1 prototype",
      links: [],
      is_sample: true,
      funding: fundings,
      locations: locs.map((c) => ({ area_code: c, share_pct: null })),
      transactions,
      updates,
    });
    ref++;
  }
}

const dataset: Dataset = { source: "seed", generated_at: new Date().toISOString(), partners, sectors, projects, fx };
const out = path.join(ROOT, "supabase/seed/sample_projects.json");
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(dataset, null, 1));
console.log(`wrote ${projects.length} sample projects -> ${path.relative(ROOT, out)} (${(fs.statSync(out).size / 1024).toFixed(0)} KB)`);
