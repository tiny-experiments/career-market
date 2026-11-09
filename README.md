# career-market

Tech careers charted like market instruments: bull, bear or sideways, from daily job-board data.

A [Tiny Experiments](https://github.com/tiny-experiments) project.

## How it fits together

```
krill API (/v1)  ──nightly──▶  builder  ──▶  Postgres read model  ──▶  read API  ──▶  web app
krill.kurso.sh                 apps/builder   (plain SQL migrations)    apps/api       apps/web
```

- **krill** collects every board each day and captures the facts that exist only on their day.
- **builder** (`apps/builder`) polls krill `/v1/meta`; on a new snapshot day it pulls
  `/v1/stats/daily`, `/v1/stats/panel/daily`, `/v1/facets`, `/v1/companies`, a sample of the
  day's closings and, per profession, the newest open US roles that list pay (the Job page's pay bands),
  then rebuilds every derived number: the chain-linked Tech Hiring Index, 1W/1M/3M/1Y/ALL
  changes, profession ticker codes, rule-written market notes and the survival-corrected back-cast
  (estimated history before 2026-11-02). For the Profession page it also pulls `/v1/stats/companies/daily`,
  `/v1/companies/{id}`, per-family facets and job lists, and writes a back-cast, work mode, pay band, top
  companies with signals and the latest roles per profession. For the Skill pages (`/skills/<skill>`) it also reads
  `/v1/facets` (companies, paired skills, posted-day cuts), `/v1/companies/{id}` and `/v1/jobs` for the
  `BUILDER_SKILL_PAGES` largest skills (default 60) and writes each skill's demand series, companies,
  paired skills, salary effect and latest roles. Every krill response is parsed with zod. Every table can
  be rebuilt from krill, except the day-by-day skill counts: krill serves no skill history, so those rows
  accumulate from the first build onward and earlier days are estimated by the back-cast.
- **read API** (`apps/api`) is a small public, read-only Express service over the read model: JSON under
  `/api/*` (see `apps/api/README.md`), no token. It runs behind a single reverse proxy and sets
  `API_TRUST_PROXY=1` so the per-IP rate limit sees each client. Job lists and `GET /api/jobs/{krill id}`
  (the Job page) also read krill live, cached for 1 hour and paced under krill's rate limit; job lists are
  depth-capped and limited in flight for the same reason (see `apps/api/README.md`). The Job page joins the
  posting, the employer's company history and similar roles with the read model's profession trend, pay
  band and typical posting window. A panel krill could not answer shows as unavailable and marks the
  payload `degraded`. A closed role answers 410 with its tombstone.
- **web app** (`apps/web`, Vite + React 19 + react-router 7 + Tailwind 4 + shadcn/ui) is the single-page
  app being built page by page on the design system in `apps/web/src/components` (see
  `docs/UI-RULEBOOK.md`; `/design`, in development builds only, shows every token and component in both themes). It reads the public
  API from the browser and never connects to Postgres.
- **previous web app** (`apps/web-next`, Next.js App Router) stays runnable until the new pages replace
  it. It renders pages on the server from the read API only and never connects to Postgres.
- **packages/core**: the one config module that reads the environment, logging (pino), the Postgres
  client (postgres.js), migrations, display codes and the shared payload types.

Hosting: the web app deploys to Vercel; the read API, builder and Postgres run on the VPS behind
`https://api.careers.market`. Nothing in this repository deploys anything.

## Run it locally

Requirements: Node 22.9+, pnpm 10 (`corepack enable`), Docker.

```sh
cp .env.example .env
pnpm install
pnpm db:up                    # Postgres 16 on 127.0.0.1:55432 (CM_PG_PORT to change)
pnpm migrate                  # apply packages/core/migrations/*.sql
```

### Builder

```sh
pnpm builder                  # build krill's latest snapshot day once (skips a day already built)
pnpm builder -- --force       # rebuild the latest day
pnpm builder -- --full        # refetch every grouped day since 2026-11-02, then rebuild
pnpm builder:watch            # poll krill every BUILDER_POLL_MINUTES (default 60) and build new days
```

Without `KRILL_API_KEY` krill allows 60 calls a minute per address; the builder paces itself under that
(`KRILL_RATE_PER_MIN`), follows `RateLimit-*` and `Retry-After`, and caches responses on disk per
snapshot day (`KRILL_CACHE_DIR`), so a rerun of the same day costs no krill calls. A first build makes a
few hundred calls (about 10 minutes unkeyed); later builds fetch only the recent days.

### Read API and web app

```sh
pnpm api                      # read API on READ_API_HOST:READ_API_PORT (default 127.0.0.1:4100)
pnpm web:dev                  # web app (Vite) on http://localhost:3000; /design shows the design system (dev only)
pnpm web:build                # production build to apps/web/dist
PORT=3001 pnpm web-next:dev   # previous Next.js app in development
pnpm web-next:build && PORT=3001 pnpm web-next:start
```

The read API needs no token. `CONTEXT_DEV_PUBLIC_CLIENT_ID` is optional (company logos).

### Jobs and search

- The builder also reads the 150 largest companies (`/v1/companies`, with domain), their daily statistics
  (`/v1/stats/companies/daily`), and krill facets per company, profession and skill. It writes
  `screener_company`, `screener_company_day`, `screener_subject`, `screener_facet` and `search_entry`.
- The read API serves `/api/jobs` (replacing the Screener) and `/api/search`; see `apps/api/README.md`.
  Job lists ask krill for the counts and the matching roles, cache each answer in memory for an hour and
  share requests in flight. They need `KRILL_API_KEY` for a comfortable rate (600 calls a minute; 60
  without a key).
- Company logos use `CONTEXT_DEV_PUBLIC_CLIENT_ID`; without it each company shows its initial.

### Company page

`/companies/<slug>` shows one company. The builder keeps a `company` directory (every company with at
least 10 open tech roles), krill's daily company statistics (`/v1/stats/companies/daily`) for all of them,
and a full profile for the largest `BUILDER_COMPANY_PROFILES` (default 100): facets for skills, countries,
levels and work modes, the careers-site url, a median age from six facet cuts and family-by-level history.
Peers are not in v1 and show a coming-soon state.

- Openings are krill's "new" for a company: roles first seen that day. krill's bootstrap days (2-3 Nov)
  and board events (a day with at least 50 openings that are 10% of the previous day's open roles, or at
  least 50 closings that are 25%: a board fetched for the first time, added or dropped) are left out of
  every flow and change. A board event restarts the company's series, the chart marks each excluded day
  as "board change excluded", and when the latest day is one the signal reads "Unclear: board change on
  <date>" instead of STEADY. krill has no per-company board status yet, so a real mass layoff looks the same.
- The signal (RAMPING, STEADY, COOLING, FREEZING) looks at the last 30 comparable days (fewer while history
  is short, and the page says so): RAMPING needs open roles up 5% with openings at least 1.5x closings;
  COOLING needs down 3% with closings at least 1.5x openings; FREEZING needs down 10% with closings at least
  2.5x openings.
- Current roles are read live from krill by the read API (`/api/companies/:slug/jobs`) through the shared live
  krill client, so it shares its pacing and hour cache with job lists and the Job page.
- Logos come from Context.dev Logo Link when `CONTEXT_DEV_PUBLIC_CLIENT_ID` is set and krill knows the
  company's domain; otherwise the page draws a monogram tile.

### Checks

```sh
pnpm typecheck
pnpm test
```

The API integration tests need a scratch Postgres that may be wiped: set `TEST_DATABASE_URL` to run them
(CI does); without it they are skipped. See `apps/api/README.md`.

## Deploy shape (VPS)

`Dockerfile` builds one server image for the read API and the builder.
`deploy/docker-compose.yml` runs both on the external `infra` network next to the shared Postgres; it
publishes no ports, and the reverse proxy routes `https://api.careers.market` to `read-api:4100`.
The proxy is the sole ingress, so the compose file sets `API_TRUST_PROXY=1` (override it in `deploy/.env`).

```sh
cp deploy/.env.example deploy/.env
docker compose -f deploy/docker-compose.yml up -d --build
```

On Vercel the project root `apps/web` now holds the Vite app (`apps/web/vercel.json` rewrites every path but
the hashed `assets/` to `index.html`); set `VITE_API_URL` there to the API's origin. Until the new pages
replace it, the Next.js app at `apps/web-next` can be deployed instead; it needs `READ_API_URL` pointing at the
API.

## Data

Every number comes from [krill](https://krill.kurso.sh), which reads public company career boards
(Greenhouse, Ashby, Lever, Workday, SmartRecruiters and more). See the Methodology and Data pages in the
app for how each number is made.
