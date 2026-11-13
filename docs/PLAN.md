# Nepal Development Projects Map (MOFA): Implementation Plan

> Status: draft for review · 2026-10-18 · Phase 1 starts after approval.
> Once approved, this file is copied into the repo as `docs/PLAN.md`.

## 1. Context

MOFA needs one place where non-technical staff can see every foreign-funded project in Nepal. For each project it should show:
- who funded it,
- where it is (province, district, palika),
- what it does (sector),
- how far along it is, and how much was committed versus disbursed.

The top priorities are visual quality, smooth interaction and ease of use. The look, feel and flow are modelled on the **Lowy Institute Pacific Aid Map**, adapted from "partners → 14 Pacific countries" to "partners → Nepal's provinces, districts and palikas".

This is a prototype for 10–15 users, built for free hosting. It is delivered in three phases:
1. Map system with sample data (this plan covers it in detail).
2. Real data, plus Supabase Auth with admin approval of signups and admin-posted project updates.
3. Deployment on Vercel Hobby.

## 2. Locked decisions

| Area | Decision |
|---|---|
| Framework | Next.js (App Router) + TypeScript |
| Look | Tailwind CSS + shadcn/ui, Motion (animations), Recharts (charts), TanStack Table (tables) |
| Map | MapLibre GL JS via `@vis.gl/react-maplibre` (react-map-gl), with **deck.gl** for arcs and project points |
| Background | **Nepal-only style**: no third-party street map; Nepal drawn from our own boundary files; neighbours as muted fills with no borders |
| Boundaries | **Survey Department, National Geoportal** data, which **includes the 2020 map** (Kalapani, Lipulekh, Limpiyadhura) |
| Admin levels | 7 provinces → 77 districts → 753 palikas. No zones. |
| Language | Toggle between **English and Romanized Nepali** (Nepali in Latin script, e.g. "Pariyojana", "Pradesh", "Jilla") |
| Database, auth, files | Supabase (free plan) |
| Hosting | Vercel Hobby (prototype) |
| Design reference | Lowy Pacific Aid Map: layout, panels, flow, interactions, dark navy and teal palette |

## 3. Verified findings that shape the plan

### 3.1 The 2020 border: verified on 2026-10-18
**Method:** point-in-polygon tests against each dataset, run in memory.
- Test points: Lipulekh pass (81.029°E, 30.234°N) and the Kuti valley (80.77°E, 30.32°N).
- Also checked: Nepal's westernmost longitude north of 30°N. The 2020 map reaches about 80.5°E at Limpiyadhura.

| Dataset | 2020 territory? | Notes |
|---|---|---|
| **National Geoportal (Survey Dept), live server** | Can't check today | GeoServer, WFS and API return *"database system is in recovery mode"* |
| **National Geoportal shapefiles, GeoJSON mirror** (`github.com/manishacharya60/nepal-geojson`) | ✅ **Yes**: Lipulekh and Kuti fall inside Darchula; westernmost point 80.548°E | National, province, district (77) and local-unit layers. The local-unit layer has 776 features: 753 palikas, 22 protected areas, and 1 **"Kalapani Region"** polygon in Darchula holding the 2020 territory. Uses old province names ("Province No 1"). No licence file. |
| Open Knowledge Nepal LocalBoundaries (CC BY 4.0) | ✅ Yes (westernmost 80.527°E) | Already simplified. Used as a cross-check and fallback. |
| UN OCHA / HDX COD-AB (v02, 2024) | ❌ **No** | Lipulekh and Kuti fall outside Nepal. **Do not use.** |

**Plan:** the boundary pipeline tries the live Geoportal first and falls back to the Geoportal mirror. A **border test** fails the build if the 2020 territory is ever missing (see §7).

**Rendering rule:** the "Kalapani Region" polygon belongs to Darchula district. At palika level it is shown and labelled exactly as the Survey Department data has it. We make no political edits of our own.

### 3.2 How the Lowy Pacific Aid Map works (from its live app and code bundles)
- **Built with:** SvelteKit, MapLibre for the project map, and a canvas/SVG overview map.
- **Top navigation:** Map · Data · Graphing tool · Compare · currency selector · **Tour** · **Share**.
- **Map page overview panel:**
  - animated headline counters: Total Spent, Total Committed, number of projects, year range;
  - **Breakdown** tabs (Partners | Recipients | Sectors), each a ranked list with amount, a "share of total" bar and a year-on-year trend arrow;
  - year selector (All years, or one year to see trends);
  - toggles between overview and projects, and between project list and project map;
  - a Filter dialog (development partners, recipients, sectors, flow types, implementing partners, from/until years), with "Filtered results" and "Clear filters".
- **Project card:** title, partner, recipient, committed vs. spent, status.
- **Project page:** partner, recipient, sector, flow type, implementing partner, status, committed, spent, policy goals, themes, source, links, and a **transaction history** table.
- **Data page:** counters plus a sortable, paginated project table (title, sector, recipient, partner, spent, committed, status %).
- **Palette:** dark navy `#16202b`, panels `#232d3a`/`#283948`, borders `#34495a`, muted text `#8b9fae`, light text `#eaf0f5`, **teal highlight `#4ebeca`** (darker `#2e8593`, hover `#49a9b9`), secondary blue `#2d90f2`.

## 4. Prerequisites before coding
1. **Node 22 LTS** via `nvm`. The installed Node v18.19 has reached end of life and is too old: Next 16, supabase-js and Vitest 5 need Node 20.9–22.12 or later (see §6.1).
2. **Supabase:** you create a free project, then put its URL and keys into `.env.local`. (The claude.ai Supabase connector is not authorised in this session, so I can't create it for you.)
3. A GitHub repo and Vercel account. Needed for Phase 3; optional earlier for preview links.

## 5. Design spec: Lowy adapted to Nepal

### 5.1 Concept mapping
| Lowy | Our app | Romanized Nepali label |
|---|---|---|
| Partners | Development partners (bilateral countries and multilaterals) | Bikas Saajhedar |
| Recipients (14 countries) | Locations: Province → District → Palika | Pradesh / Jilla / Palika |
| Regional initiatives | "Nationwide / multi-province" bucket | Rashtriya star |
| Sectors | Sectors (international DAC codes grouped into about 12 sectors) | Kshetra |
| Committed / Spent | Committed / Disbursed | Pratibaddha / Bitarit |
| Flow type | Grant · Loan · Technical assistance · In-kind | Anudan · Rin · Prabidhik sahayog |
| Status | Pipeline · Ongoing · Completed · Suspended, plus % progress | Prastaavit · Chaalu · Sampanna · Sthagit |
| Currency selector (11 currencies) | USD ⇄ NPR toggle (NPR also shown in lakh/crore) | |
| Tour | Guided tour | |
| Map · Data · Graphing tool · Compare | **Phase 1:** Map · Data · Project page. **Stretch:** Compare. **Later:** Graphing tool. | |

### 5.2 Map page layout (desktop; on mobile the panel becomes a bottom sheet)
```
┌──────────────────────────────────────────────────────────────────────────────┐
│ ▣ Nepal Development Projects   Map  Data  (Compare)    USD|NPR  EN|NE  Tour  Share│  ← navy masthead
├───────────────────────────┬──────────────────────────────────────────────────┤
│ Nepal › Bagmati › Kathmandu│                                                  │
│ USD 4.2B   USD 2.9B   612  │        ·  partner ring (flags around Nepal)  ·   │
│ Committed  Disbursed  Proj │      ·                                      ·    │
│ ▁▂▄▆█▆▅ trend (click year) │     ·    ███ NEPAL choropleth (teal ramp) ███   │
│ [Partners|Locations|Sectors]│     ·    hover → tooltip card                ·  │
│  🇯🇵 Japan  1.1B ████▌ 26% ▲│      ·   click → fly to area & drill down   ·   │
│  🇮🇳 India  0.9B ███▋  21% ▼│        ·                                  ·      │
│  ADB       0.7B ██▊   17% ▲│                                                  │
│  …  (hover row ⇄ map lights up)│   [Committed|Disbursed|# Projects]  [2D|3D] ◱ │
│ [Show projects ▸]  Filters (3) ✕ │                         legend ▭▭▭▭▭       │
└───────────────────────────┴──────────────────────────────────────────────────┘
```

### 5.3 Interactions (the core of Phase 1)
1. **Landing:** Nepal fades in at province level and the counters count up. A guided tour (driver.js) runs on the first visit.
2. **Hover on any area:** the area lifts and brightens, and a tooltip card shows:
   - the name and its parent area(s),
   - number of projects, committed and disbursed (with a bar),
   - the top 3 partners with flags,
   - a small status bar (pipeline / ongoing / completed).
3. **Click to drill down:** Province → districts → palikas, with an animated fly-to. A breadcrumb leads back up. The panel recalculates everything for the selected area ("Showing data for Kathmandu District").
4. **Linked highlighting:** hovering a partner row lights up the districts it funds and draws **arcs** from its flag on the ring. Hovering a sector or location row does the same on the map.
5. **Partner ring** (deck.gl): every partner's flag sits on a ring around Nepal at its real compass direction (Japan to the east, UK to the west, and so on). Arcs to the districts it funds appear on hover or selection.
6. **Colour the map by:** Committed, Disbursed or number of projects, plus an optional "all 77 districts" view.
7. **3D mode:** tilt the map and raise districts in proportion to funding (MapLibre's built-in 3D extrusion).
8. **Year:** clicking a bar in the trend chart filters to that year. Arrows show the change from the previous year.
9. **Filters dialog:** multi-select for partners, provinces/districts, sectors, status and flow type, plus a year range. Active filters appear as chips, with "Clear filters".
10. **Projects view:** project cards (flag, title, location, committed vs. disbursed bar, status pill), plus project dots on the map (deck.gl) sized by amount and coloured by status. Clicking a card opens a summary drawer with "Open full page".
11. **Share:** every view is encoded in the URL. "Copy link" plus "Download map image (PNG)" for briefings.
12. **Search:** one box for any district, palika, partner or project.

### 5.4 Other screens
- **`/data`:** headline counters plus the filterable, sortable project table (title, sector, location, partner, committed, disbursed, status/%), 20 rows per page, **CSV export**.
- **`/projects/[id]`:** includes
  - a header with partner flag, title, status pill, physical progress bar and financial progress bar (disbursed ÷ committed);
  - a key-facts grid: partner(s) and shares, implementing partner, sector, flow type, locations with a mini map, start/end and agreement dates, MOFA reference;
  - the description, a transaction history table, and links/documents;
  - an **updates timeline** (written by admins in Phase 2).
- **Phase 2:** `/login`, `/signup`, "pending approval" screen, `/admin` (approve users, edit projects, post updates).

### 5.5 Visual language
- **Colours:** Lowy-derived tokens on `:root`, with the dark navy chrome and map:
  - background `#16202b`, panels `#232d3a`, borders `#34495a`, light text `#eaf0f5`, muted text `#8b9fae`;
  - highlight teal `#4ebeca`;
  - status colours: pipeline `#8b9fae`, ongoing `#4ebeca`, completed `#5cc489`, suspended `#e07a5f`.
  - The Data and Project pages use a light panel variant, as Lowy's do.
- **Map colours:** a 5-step teal scale for the choropleth (from `#1d3a46` to `#7fe0ea`). Nepal's base fill is `#2a3a4a` and neighbouring countries `#1c2733`. Province borders are 1.5 px `#6c8191`, district borders 0.6 px, palika borders 0.4 px. Hover and selection use a teal outline glow.
- **Typography:** Inter (via next/font) with tabular numbers for counters. Large type: 14 px minimum, 36–44 px counters.
- **Motion:** 200–300 ms ease-out on panels, 1.0–1.4 s map fly-tos, counters animated when values change. All of it respects `prefers-reduced-motion`.
- **Flags:** `flag-icons` (MIT-licensed SVG). Multilateral organisations get neutral initials badges (ADB, WB, UN), not their logos.
- **Accessibility and ease of use:**
  - keyboard navigation for lists, tabs and dialogs;
  - every map view has an equivalent ranked list;
  - colour-blind-safe colour scale;
  - large click targets;
  - plain-language labels.

### 5.6 Language
- `next-intl` with two message files: `messages/en.json` and `messages/ne.json` (Romanized Nepali).
- Place names use the standard romanized spellings in both languages.
- A glossary of about 120 terms will be shared with you for review. Romanized Nepali has no fixed spelling standard, so a single glossary keeps the wording consistent.
- Numbers: international format in EN ("USD 1.2M"); lakh/crore for NPR ("Rs 15.6 crore").

## 6. Architecture

### 6.1 Packages (latest versions as checked on npm today; all MIT, BSD, ISC, Apache or MPL licensed)
- **App:** `next` 16.4, `react` 19.3, `typescript`, `tailwindcss` 4.3, shadcn/ui (Radix), `motion` 14, `recharts` 3, `@tanstack/react-table` 9, `next-intl` 4, `driver.js` 1.10 (guided tour), `flag-icons` 7, `fuse.js` (search), `zod`, `papaparse` (CSV export).
- **Map:** `maplibre-gl` 6.14, `@vis.gl/react-maplibre` 8.1 (the MapLibre-only build of react-map-gl), `@deck.gl/core` + `@deck.gl/layers` + `@deck.gl/mapbox` 9.4 (`MapboxOverlay`), `topojson-client`, `@turf/bbox`, `d3-scale`.
- **Node 22 is required:** Next 16 needs at least Node 20.9, supabase-js at least 22, and Vitest 5 at least 22.12.
- **State:** `nuqs` (filters stored in the URL, so links can be shared) and `zustand` (short-lived hover and tooltip state).
- **Data:** `@supabase/supabase-js` and `@supabase/ssr`.
- **Development tools:** `mapshaper`, `polylabel`, `@turf/boolean-point-in-polygon`, `world-atlas`, `tsx`, `vitest`, `@playwright/test` (using the installed Chrome).

### 6.2 Folder structure
```
app/
  layout.tsx                  masthead, fonts, theme tokens, i18n + nuqs providers
  page.tsx                    Map (server: loads dataset → <MapExplorer/>)
  data/page.tsx               project table
  projects/[id]/page.tsx      project detail
  compare/page.tsx            (stretch)
  api/dataset/route.ts        cached dataset JSON (client refresh)
components/
  map/        NepalMap.tsx (dynamic, ssr:false) · map-style.ts · Tooltip · Breadcrumb · Legend · MapControls
  map/deck/   partner-ring.ts · arcs.ts · project-points.ts
  panel/      OverviewPanel · Counters · TrendChart · BreakdownTabs · RankedList · Meter · TrendIcon
  projects/   ProjectList · ProjectCard · ProjectDrawer · KeyFacts · TransactionTable · UpdatesTimeline · MiniMap
  filters/    FilterDialog · MultiSelect · FilterChips · SearchBox
  layout/     Masthead · LanguageToggle · CurrencyToggle · ShareMenu · Tour · SampleBadge
  ui/         shadcn primitives
lib/
  data/       types.ts · load-dataset.ts (seed | supabase) · supabase/{server,client}.ts
  analytics/  filter.ts · aggregate.ts (by partner/area/sector/year, YoY trend) · split.ts
  geo/        areas.ts (code → name/level/parent index) · topo.ts (lazy load + cache) · ring.ts · bounds.ts
  state/      url-state.ts (nuqs parsers) · ui-store.ts (zustand)
  format/     money.ts (USD, NPR lakh/crore) · numbers.ts
messages/     en.json · ne.json (Romanized Nepali)
public/geo/   provinces/districts/neighbours .topo.json · palikas/P1..P7.topo.json · labels.json
public/glyphs/ Noto Sans PBF glyphs (Latin)
scripts/      geo/{fetch,normalize,build,verify-border}.ts · seed/generate.ts · screens/reference.ts
supabase/     migrations/0001_schema.sql · 0002_rls.sql · seed/sample_projects.json · seed.sql
tests/        unit/*.test.ts · e2e/*.spec.ts
docs/PLAN.md
```

### 6.3 Map composition
- **Base map:** a `@vis.gl/react-maplibre` `<Map>` with an **inline style object** (no external style URL).
  - Sources: neighbours, provinces, districts, the open province's palikas, and label points.
  - Layers, bottom to top: background → neighbour fills → (optional hillshade) → Nepal base → choropleth fill → borders → hover/selected outline → 3D extrusion (in 3D mode only) → labels.
  - Hillshade: a subtle shading of the hills and Himalaya from free, keyless elevation tiles (AWS Terrain Tiles), shown only inside Nepal. It's a nice-to-have and gets dropped if it hurts readability or speed.
- **Choropleth and hover use MapLibre's per-feature state.** When filters change, only the per-area values update, not the boundary data, so hover and recolouring stay smooth. This needs each boundary source to use the area `code` as its feature ID (`promoteId: 'code'`).
- **deck.gl draws inside MapLibre's own canvas** via `new MapboxOverlay({ interleaved: true })` mounted with react-map-gl's `useControl`. That gives one canvas and shared camera movement. Layers:
  - `ArcLayer`: partner → district arcs;
  - `ScatterplotLayer`: project dots, which can be hovered and clicked.
  - The ~20 partner flags on the ring are crisp HTML `<Marker>`s using flag-icons.
- **Partner ring:** an ellipse around Nepal's centre. Each partner's angle is the compass bearing from Kathmandu to its capital, spread out so flags don't overlap. Multilateral organisations sit along the lower arc.
- **Drill-down:** the selected area code is stored in the URL.
  - On change, the map flies to the area's bounding box, leaving room for the panel.
  - The province's palika file is preloaded on hover and loaded on click.
  - Sibling areas are dimmed.
  - The view is limited to the area around Nepal, and the minimum zoom is fitted so Nepal is always visible.
- The map loads in the browser only (`next/dynamic`, `ssr: false`). The panel and lists are rendered on the server, so text appears immediately.

### 6.4 State and data flow
- **In the URL (nuqs):** `area`, `year`, `partners[]`, `sectors[]`, `status[]`, `flow[]`, `metric`, `view` (overview | projects), `mode` (2d | 3d), `project` (drawer), `cur`. Every view can be shared and survives a browser refresh.
- **In zustand:** short-lived UI state — hovered area, hovered partner, tooltip position.
- **Language:** a cookie read by next-intl. The toggle switches the language without changing the URL.
- **Data flow:**
  1. The server loads the dataset once (cached 300 s).
  2. `<DatasetProvider>` passes it to the page.
  3. `filterProjects()` and `aggregate()` run as memoised selectors keyed by the URL state.
  4. Results go to the counters, lists, map values and arcs.
- **Avoiding double counting:**
  - A project spanning several areas has its amount split across its locations (by `share_pct`, otherwise equally) for area totals.
  - National totals count each project once.
  - Co-financing is split by `project_funding` rows.
  - Tooltips say "split across N locations" when this happens.

## 7. Boundary data pipeline (Node scripts, no GDAL)
| Step | Script | Output |
|---|---|---|
| 1. Fetch | `scripts/geo/fetch.ts`: try Geoportal WFS (`admin.nationalgeoportal.gov.np/geoserver`); if it is down, use the Geoportal mirror; optionally cross-check against OKN | `data/raw/*.geojson` (gitignored) |
| 2. Normalise | `scripts/geo/normalize.ts`: current province names (Koshi, Madhesh, Bagmati, Gandaki, Lumbini, Karnali, Sudurpashchim); title-case names; stable codes (`P1`…`P7`, district and palika codes); `kind` = palika / protected_area / special_region (Kalapani Region); alias table for spelling fixes | normalised GeoJSON plus `data/admin_areas.csv` |
| 3. Simplify | `mapshaper` (npm), all layers imported together so shared borders stay identical, simplified with topology kept, cleaned | `public/geo/provinces.topo.json` (≈50–80 KB), `districts.topo.json` (≈150–300 KB), `palikas/<P#>.topo.json` (one per province, loaded when needed) |
| 4. Label points | `polylabel`, the best inside point for each area | `public/geo/labels.json` |
| 5. Neighbours | `world-atlas` countries (Natural Earth, public domain), cut to the area around Nepal and drawn **beneath** Nepal with no borders | `public/geo/neighbours.topo.json` |
| 6. **Border test** | `scripts/geo/verify-border.ts` (Vitest), run in `npm test` and before builds. Checks: Lipulekh and Kuti fall inside Darchula; westernmost point north of 30°N is below 80.6°E; 7 / 77 / 753 counts; every palika sits inside its district | test pass/fail |

Boundary files are generated once and committed to the repo. They are served as static files from Vercel's CDN, with no database involved.

## 8. Data model (Supabase, ready for Phase 2)
Location codes in the database are the same codes used in the boundary files, so data and map always line up.

| Table | Key columns | Notes |
|---|---|---|
| `admin_areas` | `code` PK, `level` (province / district / palika), `parent_code`, `name_en`, `name_ne`, `kind` | Loaded from `data/admin_areas.csv` |
| `partners` | `id`, `slug`, `name_en`, `name_ne`, `type` (bilateral / multilateral / ingo / other), `iso2` (for flags), `ring_lng`, `ring_lat` (optional manual ring position) | |
| `sectors` | `code`, `name_en`, `name_ne`, `dac_codes text[]` | Uses the international DAC codes, which makes future imports from aid-data sources easier |
| `projects` | `id` uuid, `mofa_ref`, `title_en`, `title_ne`, `description`, `sector_code`, `flow_type`, `status`, `progress_pct`, `implementing_partner`, `start_date`, `end_date`, `agreement_date`, `source`, `links` jsonb, `is_sample`, `created_at`, `updated_at`, `updated_by` | |
| `project_funding` | `project_id`, `partner_id`, `committed_usd`, `disbursed_usd`, `currency_original`, `committed_original` | Links projects and partners many-to-many, so co-financed projects work from day one |
| `project_locations` | `project_id`, `area_code`, `share_pct` (nullable) | Any level. A project with no location is counted as "Nationwide". |
| `transactions` | `id`, `project_id`, `partner_id`, `date`, `type` (commitment / disbursement / expenditure), `amount_usd`, `note` | Feeds the trend chart and the transaction history table |
| `fx_rates` | `year`, `usd_npr` | NPR toggle (approximate; source noted) |
| `project_updates` *(Phase 2)* | `id`, `project_id`, `author_id`, `body`, `progress_pct`, `status`, `attachments` jsonb, `created_at` | Admin-written timeline |
| `profiles` *(Phase 2)* | `id` (= auth user), `full_name`, `role` (admin / user), `status` (pending / approved / rejected), `approved_by`, `approved_at` | Approval flow |

- **Access rules:**
  - *Phase 1:* anyone can read the sample data; no writes are allowed.
  - *Phase 2:* reading requires an `approved` profile, and writing requires `role = 'admin'`. Both are checked by a database function, `is_approved()` / `is_admin()`.
- **Loading:** a single `project_dataset` database view returns denormalised projects (funding and locations as nested lists). The app fetches it **once**, cached for 5 minutes on the server, and filters and aggregates it in the browser. With fewer than ~5,000 projects that is a few hundred KB and makes every interaction instant.
- **Before Supabase is connected:** the loader in `lib/data/` reads `supabase/seed/sample_projects.json`, which has the same shape. Map work (milestones M1–M4) can therefore start before the Supabase project exists, and the loader is switched to Supabase in M5.

## 9. Sample data (Phase 1)
About 80 projects in `supabase/seed/sample_projects.json`, created by `scripts/seed/generate.ts`:
- **Partners:** real names (Japan, India, China, USA, UK, Germany, Switzerland, Norway, Korea, Australia, EU, ADB, World Bank, UN agencies).
- **Sectors:** real categories.
- **Locations:** real province, district and palika codes, spread across all 7 provinces.
- **Figures:** plausible amounts, dates and progress.
- **Labelling:** every record carries `is_sample = true`, and the interface shows a visible **"Sample data"** badge. Nothing is presented as verified MOFA data.
- **Phase 2:** an importer (`scripts/import/`) loads your real spreadsheet into the same tables.

## 10. Phase 1 milestones (ordered so the map looks impressive early)
| # | Milestone | Done when |
|---|---|---|
| M0 | **Setup:** Node 22; Next.js app with TypeScript, Tailwind, shadcn/ui, ESLint, Vitest; colour tokens and fonts; copy this plan to `docs/PLAN.md`; capture reference screenshots of the Lowy map | `npm run dev` shows a navy page with the masthead; lint and tests pass |
| M1 | **Boundary pipeline and border test** (§7) | Files generated within their size budgets; `verify-border` passes; counts are 7 / 77 / 753 |
| M2 | **Map canvas:** Nepal-only style, neighbours, view locked to Nepal; province ↔ district ↔ palika drill-down with fly-to and breadcrumb; hover lift and tooltip; labels | Smooth hover with no lag; drilling down works at all three levels; Kalapani–Lipulekh–Limpiyadhura visibly part of Darchula |
| M3 | **Overview panel:** animated counters, trend chart, Partners / Locations / Sectors tabs with share bars and trend arrows; choropleth by selected measure; linked highlighting between list rows and the map | Panel numbers recalculate for any selected area; hovering a row lights up the matching areas |
| M4 | **Filters, URL sharing, search, guided tour, USD/NPR toggle** | A copied link reproduces the exact view; the tour runs on first visit and can be reopened |
| M5 | **Projects:** connect Supabase (schema and seed data); project cards and list; project dots on the map; summary drawer; `/projects/[id]` page | Every number traces back to the projects in the database; the project page renders all fields |
| M6 | **deck.gl showcase:** partner ring and arcs, 3D extrusion mode, PNG map export | Arcs animate on partner hover; the 3D toggle tilts the map and raises districts |
| M7 | **`/data` page:** table with sorting, filters, pagination and CSV export | The exported CSV matches the filtered table |
| M8 | **Language and polish:** Romanized Nepali toggle (glossary reviewed by you), mobile bottom sheet, keyboard navigation, reduced-motion support, empty and loading states, "Sample data" badge | Passes the checklist in §12 |
| M9 | **Preview deploy** to Vercel Hobby, so you and MOFA colleagues can review before Phase 2 | A public preview URL works on desktop and phone |
| (stretch) | **`/compare`:** two partners or two provinces side by side | |

## 11. Phase 2 and 3 outline
**Phase 2:**
- **Auth:** Supabase Auth with email and password, plus email confirmation.
  - New signups start as `profiles.status = 'pending'` and see a "waiting for approval" screen.
  - In `/admin`, admins approve or reject users and change roles.
  - Approval is checked against the database on each request (not cached in the login token), so it takes effect immediately.
- **Data editing:** admins add and edit projects, post **project updates** (text, progress %, status, photos and documents via Supabase Storage), and record transactions.
- **Data access rules:** only approved users can read data; only admins can change it.
- **Import:** real data loaded from spreadsheets (CSV/XLSX) through the importer, with a validation report.

**Phase 3:**
- Vercel Hobby deployment, with Supabase keys stored as Vercel settings and Supabase's allowed redirect URLs configured.
- Supabase pauses after a week of inactivity. Weekly team use prevents this; a Vercel cron health check can be added if needed.

## 12. Verification
- **Automated** (`npm test`, Vitest):
  - the border test (§7);
  - tests for filtering and aggregation (totals per partner, area and year; co-financing splits; no double-counting when a project spans several districts);
  - URL state round-trips (save a view to a link, load it back, get the same view);
  - number formatting (lakh/crore).
- **Browser tests** (Playwright, using the installed Chrome):
  - load the map, hover a district (tooltip appears), drill down to a palika, apply a filter, copy the link, reopen it (same view), open a project page, switch language;
  - screenshots at 1440, 1024 and 390 px wide, compared by eye against the Lowy reference screenshots from M0.
- **Performance budget:**
  - first map paint under 2.5 s on a fast connection;
  - province + district boundary files under 400 KB gzipped;
  - hover with no visible lag (hover uses MapLibre's per-feature state, so it doesn't re-render the page);
  - Lighthouse performance score of 85 or more on `/`.
- **Usability check** (for non-technical users):
  - a first-time user can answer "How much has Japan committed in Gandaki?" in under 30 seconds with no help;
  - every icon has a text label;
  - every view works without the map, through the lists.
- **Border spot check:** compare Darchula visually with the Survey Department's published 2020 political map.

## 13. Risks
| Risk | Mitigation |
|---|---|
| Live Geoportal is down, and the mirror has no licence file | Data comes from the Survey Department and was verified against it; re-download from the official Geoportal when it is back up (the script tries it first); OKN (CC BY 4.0) is the fallback, also verified ✅ |
| Local Node 18 is too old | Install Node 22 LTS with nvm (M0); pin `engines` in package.json; Vercel builds with Node 22 |
| MapLibre and deck.gl only run in the browser, not during Next.js server rendering | Map component loaded with `next/dynamic` and `ssr: false`; deck.gl drawn inside MapLibre (via `MapboxOverlay` and `useControl`) so both share one canvas |
| deck.gl 9.4 drawing inside the newest MapLibre (6.x) is untested | Run a small test in M2 first; fallbacks are MapLibre 5.x or drawing deck.gl as a separate layer on top |
| Map labels need font files (glyphs) and we're not using a third-party map service | Host Noto Sans glyph files (Latin range only) in `public/glyphs/` |
| Palika files are large | Split per province and load only when a province is opened; simplified with mapshaper |
| Romanized Nepali spellings drift | One glossary file; you review it in M8 |
| Supabase pauses after 7 days idle | Weekly use prevents it; optional Vercel cron health check (Phase 3) |
| Sample data mistaken for real data | `is_sample` flag plus a permanent "Sample data" badge until real data is loaded |
| Disputed area rendered wrongly by a third party | No third-party street map; neighbours drawn under Nepal with no borders; border test runs in CI |
