# career-market

Tech careers charted like market instruments: bull, bear or sideways, from daily job-board data.

A [Tiny Experiments](https://github.com/tiny-experiments) project.

## How it fits together

```
krill API (/v1)  ──daily + 15 min──▶  worker  ──▶  Postgres read model  ──▶  read API  ──▶  web app
krill.kurso.sh                       apps/worker   (plain SQL migrations)    apps/api       apps/web
```

- **krill** collects every board each day and captures the facts that exist only on their day.
- **worker** (`apps/worker`) polls krill `/v1/meta`; on a completed new snapshot day it mirrors every open job
  (the read API serves jobs from this mirror) and pulls
  `/v1/stats/daily`, `/v1/stats/panel/daily`, `/v1/facets`, `/v1/companies`, a sample of the
  day's closings and, per profession, the newest open US roles that list pay (the Job page's pay bands),
  then rebuilds every derived number: the chain-linked Tech Hiring Index, 1W/1M/3M/1Y/ALL
  changes, profession ticker codes, rule-written market notes and the survival-corrected back-cast
  (estimated history before 2026-11-02). For the Profession page it also pulls `/v1/stats/companies/daily`,
  `/v1/companies/{id}`, per-family facets and job lists, and writes a back-cast, work mode, pay band, top
  companies with signals and the latest roles per profession. For the Skill pages (`/skills/<skill>`) it also reads
  `/v1/facets` (companies, paired skills, posted-day cuts), `/v1/companies/{id}` and `/v1/jobs` for the
  `BUILDER_SKILL_PAGES` largest skills (default 60; regulations and compliance items such as GDPR are never treated as skills) and writes each skill's demand series, companies,
  paired skills, salary effect and latest roles. Every krill response is parsed with zod. Every table can
  be rebuilt from krill, except the day-by-day skill counts: krill serves no skill history, so those rows
  accumulate from the first build onward and earlier days are estimated by the back-cast. Between builds a
  15-minute sweep of krill's change feed keeps the job mirror current; see
  [worker read model](docs/worker-read-model.md).
- **read API** (`apps/api`) is a small public, read-only Express service over the read model: JSON under
  `/api/*` (see `apps/api/README.md`), no token. It runs behind a single reverse proxy and sets
  `API_TRUST_PROXY=1` so the per-IP rate limit sees each client. Job lists, the Job page
  (`GET /api/jobs/{krill id}`), company roles and search read the worker's job mirror in Postgres; only the
  first visit to a role whose text is not stored yet fetches it once from krill (see `apps/api/README.md`).
  The Job page joins the posting, the employer's company history and similar roles with the read model's
  profession trend, pay band and typical posting window. A panel that could not be answered shows as
  unavailable and marks the payload `degraded`. A closed role answers 410 with its tombstone.
- **web app** (`apps/web`, Vite + React 19 + react-router 7 + Tailwind 4 + shadcn/ui) is the single-page
  app being built page by page on the design system in `apps/web/src/components` (see
  `docs/UI-RULEBOOK.md`; `/design`, in development builds only, shows every token and component in both themes). It reads the public
  API from the browser and never connects to Postgres.
- **previous web app** (`apps/web-next`, Next.js App Router) stays runnable until the new pages replace
  it. It renders pages on the server from the read API only and never connects to Postgres.
- **packages/core**: the one config module that reads the environment, logging (pino), the Postgres
  client (postgres.js), migrations, display codes and the shared payload types.

Hosting: the web app deploys to Vercel at `https://careermarket.app`; the read API, worker and Postgres run
on the VPS behind `https://api.careermarket.app` (see [Production](#production)).

## Run it locally

Requirements: Node 22.9+, pnpm 10 (`corepack enable`), Docker.

```sh
cp .env.example .env
pnpm install
pnpm db:up                    # Postgres 16 on 127.0.0.1:55432 (CM_PG_PORT to change)
pnpm migrate                  # apply packages/core/migrations/*.sql
```

### Worker

```sh
pnpm worker                   # build krill's latest snapshot day once (skips a day already built)
pnpm worker -- --force        # rebuild the latest day
pnpm worker -- --full         # refetch every grouped day since 2026-11-02, then rebuild
pnpm worker:sweep             # apply krill's change feed once, from the stored cursor
pnpm worker:watch             # poll krill every BUILDER_POLL_MINUTES (default 5) and build completed new days;
                              # sweep changes every WORKER_SWEEP_MINUTES (default 15); backfill job descriptions when idle
```

The `pnpm builder` and `pnpm builder:watch` scripts remain aliases.

Without `KRILL_API_KEY` krill allows 60 calls a minute per address; the worker paces itself under that
(`KRILL_RATE_PER_MIN`), follows `RateLimit-*` and `Retry-After`, and caches responses on disk per
snapshot day (`KRILL_CACHE_DIR`), so a rerun of the same day costs no krill calls. Every build fetches the
full open-job listing fresh, so build with a `KRILL_API_KEY` (a keyed full build takes about 10 minutes);
timings and rate limits are in the [worker read model](docs/worker-read-model.md).

### Read API and web app

```sh
pnpm api                      # read API on READ_API_HOST:READ_API_PORT (default 127.0.0.1:4100)
pnpm web:dev                  # web app (Vite) on http://localhost:3000; /design shows the design system (dev only)
pnpm web:build                # production build to apps/web/dist
PORT=3001 pnpm web-next:dev   # previous Next.js app in development
pnpm web-next:build && PORT=3001 pnpm web-next:start
```

The read API needs no token. Logos are optional: see Company logos below.

### Jobs and search

- The worker also reads the 150 largest companies (`/v1/companies`, with domain), their daily statistics
  (`/v1/stats/companies/daily`), and krill facets per company, profession and skill. It writes
  `screener_company`, `screener_company_day`, `screener_subject`, `screener_facet` and `search_entry`.
- The read API serves `/api/jobs` (replacing the Screener) and `/api/search`; see `apps/api/README.md`.
  Job lists, counts, filters and search run over the job mirror in Postgres. `KRILL_API_KEY` only raises the
  pace limit of the one-off text fetch for a role whose description is not stored yet.

### Company page

`/companies/<slug>` shows one company. The worker keeps a `company` directory (every company with at
least one open tech role), krill's daily company statistics (`/v1/stats/companies/daily`) for all of them,
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
- Current roles are read from the job mirror by the read API (`/api/companies/:slug/jobs`), the same
  source as job lists and the Job page.

### Company logos

`pnpm --filter @cm/worker logos [--limit N]` (also part of `worker:watch`) keeps `company.domain` current.
For each company it takes the first of: a row in `company_domain_override` (a null domain there is a
deliberate monogram), the directory's domain, the first-party careers site or job links (hiring platforms
do not count), then a paid Context.dev brand search by name with a strict match. Biggest employers go
first, within `LOGO_DAILY_CREDITS` and `LOGO_DAILY_CHECKS`. A domain with no real mark at the logo service
is withheld, so the page draws our monogram tile. The browser needs `VITE_CONTEXT_DEV_PUBLIC_CLIENT_ID`;
the worker needs `CONTEXT_DEV_PUBLIC_CLIENT_ID` and, for paid lookups, `CONTEXT_DEV_API_KEY`.

The same pass names each company (`company.display_name`): a row in `company_name_override` wins, then
the directory's name cleaned of careers-page wording and checked against the resolved site. When the
directory holds only an Oracle Recruiting tenant code (`fa-eqzh-saasfaprod1`, `Eeho`), the pass reads
the name each of the company's Oracle careers sites states (`og:site_name`, else the page title; the
sites come from its job links), keeps it in `company_site_name`, reads it again after `LOGO_RECHECK_DAYS`,
and takes the cleaned name that covers the most open roles ("Chubb External" becomes Chubb). Where a
site states only an abbreviation or Oracle's default "Candidate Experience site", a hand-checked
`company_name_override` row names it instead. A company we
can only call by a hiring-platform code (`named = false`) stays listed and searchable, but every sort of
the Companies table lists it after the named companies.

### Checks

```sh
pnpm typecheck
pnpm test
```

The API integration tests need a scratch Postgres that may be wiped: set `TEST_DATABASE_URL` to run them
(CI does); without it they are skipped. See `apps/api/README.md`.

## Production

The web app (`apps/web`) deploys to Vercel with the root directory `apps/web`; `apps/web/vercel.json` rewrites
every path but the hashed `assets/` to `index.html`, and `VITE_API_URL` is set to `https://api.careermarket.app`.

The VPS runs the compose project `career-market` from `/srv/projects/career-market`, a clone of this repository.
`Dockerfile` builds one server image for the API and the worker.

| Service    | What it does                                                                                  |
| ---------- | --------------------------------------------------------------------------------------------- |
| `postgres` | The read model, on its own volume (`career-market_pgdata`) and the project's private network  |
| `api`      | The read API on port 4100, reachable only on `kurso_default` as `cm-api`                      |
| `worker`   | Snapshot builds, 15-minute change sweeps, description backfill and logo resolution            |
| `migrate`  | One-off: applies SQL migrations (profile `ops`)                                               |

No service publishes a port. The host's Caddy is the sole ingress and routes `api.careermarket.app` to
`cm-api:4100`, so `API_TRUST_PROXY` is `1`. CORS allows `https://careermarket.app`, `https://www.careermarket.app`
and Vercel preview origins.

First deploy, on the VPS:

```sh
git clone https://github.com/tiny-experiments/career-market.git /srv/projects/career-market
cd /srv/projects/career-market
cp deploy/.env.example deploy/.env && chmod 600 deploy/.env   # fill in the required values
docker compose -f deploy/docker-compose.yml build
docker compose -f deploy/docker-compose.yml up -d --wait postgres
docker compose -f deploy/docker-compose.yml run --rm migrate
docker compose -f deploy/docker-compose.yml up -d api worker
```

The worker's first build takes about ten minutes; until it finishes the API has no market data to serve.

Each later release, from a machine that can `ssh mide-cloud`: `deploy/deploy-main.sh` fast-forwards the VPS clone
to `origin/main`, builds, migrates, restarts the API and worker, and checks the API from inside Caddy's container.

## Data

Every number comes from [krill](https://krill.kurso.sh), which reads public company career boards
(Greenhouse, Ashby, Lever, Workday, SmartRecruiters and more). See the Methodology and Data pages in the
app for how each number is made.

Worker scheduling, mirror columns, indexes and bootstrap limits: [worker read model](docs/worker-read-model.md).
