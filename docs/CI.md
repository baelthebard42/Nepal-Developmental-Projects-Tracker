# CI/CD

## How it fits together

```
pull request / push ──► GitHub Actions "CI" ─┬─ Lint, types & unit tests
                                             ├─ Database tests          (throwaway Postgres 17)
                                             └─ Build & end-to-end tests (production build + Chromium)

push to main ─────────► Vercel builds and deploys to production (Vercel's GitHub integration)
                         └─► "Smoke test deployment" runs the @smoke browser tests against the live URL

push to main touching supabase/migrations/** ─► "Database migrations": test on a throwaway DB,
                                                then apply to Supabase (never seeds)
```

Dependabot opens weekly update PRs, and CI tests each one.

## What is tested every time

| Check | Where | Catches |
|---|---|---|
| ESLint, `tsc --noEmit` | `checks` | Code errors and React hook misuse |
| **2020 border** (`tests/unit/border.test.ts`) | `checks` | Lipulekh/Kuti not in Darchula, Limpiyadhura missing, area counts not 7 / 77 / 753 |
| **Boundary assets** (`geo-assets.test.ts`) | `checks` | Area index out of sync with the TopoJSON files, broken parent links, files over the size budget, missing glyphs |
| **Data contract** (`data-contract.test.ts`, `lib/data/schema.ts`) | `checks` | Dataset with the wrong shape, unknown areas/partners/sectors, transactions that don't add up to totals, duplicate ids |
| **Aggregation** (`aggregate.test.ts`) | `checks` | Double counting, wrong co-financing or multi-location splits, year filter, lakh/crore/arba formatting |
| **Translations** (`i18n.test.ts`) | `checks` | A key missing in `en.json` or `ne.json`, or mismatched `{placeholders}` |
| **Shareable links** (`url-state.test.ts`) | `checks` | A link that doesn't reproduce the same view, or a crash on malformed URLs |
| **Partner ring** (`ring.test.ts`) | `checks` | Flags overlapping or placed in the wrong direction |
| **Database** (`tests/db/database.test.ts`) | `database` | Migrations that fail or can't be re-run, seed duplicates, any difference between data in and data out through the `project_dataset` view, anonymous users able to write, missing row-level security, constraints that don't reject bad references |
| **Browser** (`tests/e2e/*.spec.ts`) | `e2e` | Map not rendering, hover card, drill-down, deep links, palika files, filters and URL sharing, year chart, tabs, project drawer and page, search, language and currency toggles, 3D, tour, PNG export, `/data` sorting and CSV export, 404 page, static assets, phone layout. **Any console error or hydration mismatch fails the test.** |
| **Smoke** (`@smoke` subset) | after each deploy | The live site actually works with live (Supabase) data |

Browser tests in CI use the bundled sample data (Supabase variables are blanked), so they need no secrets and are deterministic.

## Running locally

```bash
npm run lint && npm run typecheck && npm test

# database tests: any disposable Postgres. Never Supabase; the suite refuses it.
docker run -d --rm -p 5432:5432 -e POSTGRES_PASSWORD=postgres postgres:17
TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/postgres npm run test:db

# browser tests (uses an installed Chrome; or run `npx playwright install chromium` and omit CHROME_PATH)
npm run build && CHROME_PATH=/usr/bin/google-chrome npm run test:e2e

# smoke tests against any deployment
BASE_URL=https://nepal-projects-map.vercel.app npm run test:smoke
```

## One-time setup in the GitHub UI

1. **Branch protection** (Settings → Rules → Rulesets → *New branch ruleset*, target `main`):
   - Require a pull request before merging.
   - Require status checks to pass. Add these three:
     - `Lint, types & unit tests`
     - `Database tests`
     - `Build & end-to-end tests`

     They appear in the picker after CI has run once.
   - Block force pushes.

   Merges then go to production only after CI passes. Vercel deploys whatever reaches `main`.
2. **Production environment for migrations** (Settings → Environments → *New environment* `production`):
   - Add the secret `SUPABASE_DB_CONNECTION_STR`, the same value as in your local `.env`.
   - Optional: under *Required reviewers*, add yourself so each migration waits for your approval.
3. **Preview smoke tests (optional):** in Vercel → Project → Settings → Deployment Protection, create a *Protection Bypass for Automation* secret. Add it to GitHub (Settings → Secrets and variables → Actions) as `VERCEL_AUTOMATION_BYPASS_SECRET`. Without it, only production deployments are smoke-tested.
4. **Optional, Vercel side:** in Vercel → Project → Settings → Deployment Checks (if your plan shows it), select the three CI checks. Vercel will then wait for them before promoting a build to production.

## Notes

- `db:seed` is never run by CI/CD against Supabase: it replaces all data. Real data will be loaded by the Phase 2 importer, which should reuse `DatasetSchema` + `integrityProblems` from `lib/data/schema.ts`.
- Dependabot ignores `maplibre-gl` 6.x (incompatible with deck.gl's overlay) and Next.js major versions.
