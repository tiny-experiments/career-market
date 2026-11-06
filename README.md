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
  (estimated history before 2026-11-02). Every krill response is parsed with zod. Every table can be
  rebuilt from krill.
- **read API** (`apps/api`) is a small read-only HTTP service over the read model. Every `/v1` route
  needs `Authorization: Bearer $READ_API_TOKEN`. `GET /v1/jobs/{krill id}` (the Job page) is the one route
  that also reads krill live: the posting, the employer's company history and similar roles, cached for 1 hour
  and paced under krill's rate limit, joined with the read model's profession trend, pay band and typical
  posting window. A panel krill could not answer shows as unavailable and marks the payload `degraded`;
  the web app then caches that page for 60 seconds instead of an hour. A closed role answers 410 with its
  tombstone.
- **web app** (`apps/web`, Next.js App Router) renders pages on the server from the read API only. It
  never connects to Postgres, and the token never reaches the browser. Pages render per request; the read
  API responses they use are cached for 1 hour, and the builder expires that cache right after a build
  through `POST /api/revalidate`.
- **packages/core**: the one config module that reads the environment, logging (pino), the Postgres
  client (postgres.js), migrations, display codes and the shared payload types.

Hosting: the web app deploys to Vercel; the read API, builder and Postgres run on the VPS behind
`https://api.careers.market`. Nothing in this repository deploys anything.

## Run it locally

Requirements: Node 22.9+, pnpm 10 (`corepack enable`), Docker.

```sh
cp .env.example .env          # then set READ_API_URL=http://127.0.0.1:4100 for local work
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
PORT=3000 pnpm web:dev        # web app in development
pnpm web:build && PORT=3000 pnpm web:start
```

The web app needs only `READ_API_URL` and `READ_API_TOKEN` (and `REVALIDATE_TOKEN` to accept the
builder's refresh call). `CONTEXT_DEV_PUBLIC_CLIENT_ID` is optional (company logos).

### Screener and search

- The builder also reads the 150 largest companies (`/v1/companies`, with domain), their daily statistics
  (`/v1/stats/companies/daily`), and krill facets per company, profession and skill. It writes
  `screener_company`, `screener_company_day`, `screener_subject`, `screener_facet` and `search_entry`.
- The read API serves `/v1/screener` and `/v1/search`. With no filter the Screener comes from the read
  model; with filters the read API asks krill for the counts (`/v1/facets`, company facet) and for the
  matching roles (`/v1/jobs`), caches each answer in memory for an hour and shares requests in flight.
  It needs `KRILL_API_KEY` for a comfortable rate (600 calls a minute; 60 without a key).
- The web app calls `/api/search` (its own route) for the typeahead; the browser never sees the read API
  token. Company logos use `CONTEXT_DEV_PUBLIC_CLIENT_ID`; without it each company shows its initial.

### Company page

`/companies/<slug>` shows one company. The builder keeps a `company` directory (every company with at
least 10 open tech roles), krill's daily company statistics (`/v1/stats/companies/daily`) for all of them,
and a full profile for the largest `BUILDER_COMPANY_PROFILES` (default 100): facets for skills, countries,
levels and work modes, the careers-site url, a median age from six facet cuts and family-by-level history.
Peers are not in v1 and show a coming-soon state.

- Openings are krill's "new" for a company: roles first seen that day. krill's bootstrap days (2-3 Nov)
  and the day a company's board is first fetched list every role as new, so both are left out of every
  flow and change, and the chart draws them as gaps.
- The signal (RAMPING, STEADY, COOLING, FREEZING) looks at the last 30 comparable days (fewer while history
  is short, and the page says so): RAMPING needs open roles up 5% with openings at least 1.5x closings;
  COOLING needs down 3% with closings at least 1.5x openings; FREEZING needs down 10% with closings at least
  2.5x openings.
- Current roles are read live from krill by the read API (`/v1/companies/:slug/jobs`) and cached for an hour.
- Logos come from Context.dev Logo Link when `CONTEXT_DEV_PUBLIC_CLIENT_ID` is set and krill knows the
  company's domain; otherwise the page draws a monogram tile.

### Checks

```sh
pnpm typecheck
pnpm test
```

## Deploy shape (VPS)

`Dockerfile` builds one server image for the read API and the builder.
`deploy/docker-compose.yml` runs both on the external `infra` network next to the shared Postgres; it
publishes no ports, and the reverse proxy routes `https://api.careers.market` to `read-api:4100`.

```sh
cp deploy/.env.example deploy/.env
docker compose -f deploy/docker-compose.yml up -d --build
```

On Vercel, set the project root to `apps/web` and set `READ_API_URL=https://api.careers.market`,
`READ_API_TOKEN` and `REVALIDATE_TOKEN`.

## Data

Every number comes from [krill](https://krill.kurso.sh), which reads public company career boards
(Greenhouse, Ashby, Lever, Workday, SmartRecruiters and more). See the Methodology and Data pages in the
app for how each number is made.
