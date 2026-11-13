# Nepal Development Projects Map

An interactive map of development projects funded by Nepal's international partners, built for the Ministry of Foreign Affairs. Design and flow follow the Lowy Institute Pacific Aid Map, adapted to Nepal's 7 provinces, 77 districts and 753 palikas.

**Live:** https://nepal-projects-map.vercel.app. Every push to `main` deploys to production automatically on Vercel, and other branches get preview URLs.

**Status: Phase 1 prototype.** All project figures are generated **sample data** and are labelled as such in the interface.

The full plan is in [docs/PLAN.md](docs/PLAN.md).

## What it does

- Choropleth map of Nepal. Hover any province, district or palika for a summary; click to drill down. A breadcrumb leads back up.
- A partner ring of flags placed by compass direction. Hover a flag to draw arcs to the places that partner funds.
- Overview panel: animated totals, disbursements per year (click a bar to filter by year), and Partners / Locations / Sectors breakdowns linked to the map.
- Filters for partner, sector, status, type of aid and year, plus search across places, partners and projects.
- Project map (dots coloured by status), a summary drawer, and a full project page.
- `/data` table: sorting, search and CSV export.
- 3D mode, USD/NPR (lakh/crore/arba), English / Romanized Nepali, guided tour, shareable links, and a PNG export of the map.

## Boundaries

Boundaries come from the **Survey Department / National Geoportal** data, which includes the **2020 official map** (Kalapani, Lipulekh, Limpiyadhura).

The live Geoportal server was down when the data was built, so `scripts/geo/fetch.mjs` falls back to a GeoJSON mirror of the Geoportal shapefiles. `tests/unit/border.test.ts` fails the test run if the 2020 territory is missing or if the 7 / 77 / 753 counts drift.

The background is Nepal-only. Neighbouring countries are drawn as muted fills underneath Nepal, with no borders and no third-party street map.

## Stack

- Next.js 16 (App Router) and TypeScript, with Tailwind CSS 4.
- MapLibre GL 5 and deck.gl 9, the latter drawn inside the MapLibre canvas.
  - MapLibre 6 is not yet compatible with deck.gl's overlay, so this is pinned to 5.x.
- nuqs (view state in the URL), next-intl, Motion, TanStack Table, driver.js.
- Supabase (Postgres) holds the data: public read-only in Phase 1, enforced by row-level security.
  - If Supabase is unreachable or paused, the app falls back to the bundled sample JSON.

## Running locally

Requires Node 22.12 or later.

```bash
npm install
cp .env.example .env    # then fill in your Supabase values (optional: without them the sample JSON is used)
npm run dev
```

| Script | What it does |
|---|---|
| `npm test` | Unit tests: border/2020-map test, aggregation (no double counting), money formatting |
| `npm run geo:fetch` / `geo:build` | Download raw boundaries; rebuild `public/geo/*` (TopoJSON + area index) |
| `npm run seed:generate` | Regenerate `supabase/seed/sample_projects.json` |
| `npm run db:migrate` / `db:seed` | Apply `supabase/migrations/*.sql`; load areas and sample data (needs `SUPABASE_DB_CONNECTION_STR`) |

## Environment

| Variable | Used by |
|---|---|
| `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` | App (server-side read of the `project_dataset` view) |
| `SUPABASE_DB_CONNECTION_STR` | Only the `db:*` scripts. Never deploy it. |

## Credits

- Boundaries: Survey Department, Government of Nepal.
- Neighbouring countries: Natural Earth (public domain).
- Flags: flag-icons (MIT).
- Label font: Noto Sans (OFL).
