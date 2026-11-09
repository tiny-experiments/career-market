# Career Market read API

Express 5 serves public, read-only JSON for the SPA. Browser requests do not need
a token. Start with `pnpm api` from the repository root. `DATABASE_URL`,
`READ_API_HOST` and `READ_API_PORT` retain their existing meanings. The worker
continues to own migrations; this app never migrates on startup.

## Routes

| Route                           | Response                                                   |
| ------------------------------- | ---------------------------------------------------------- |
| `GET /health`                   | Database readiness, `{ok}`                                 |
| `GET /api/meta`                 | Ticker and chrome (formerly `/v1/chrome`)                  |
| `GET /api/market`               | Headline, time series and market panels                    |
| `GET /api/professions`          | Profession index; optional `region` scopes it to a region  |
| `GET /api/professions/:code`    | Profession detail                                          |
| `GET /api/companies`            | Paginated directory over every current company             |
| `GET /api/company-signals`      | Counts by hiring signal and the week's biggest movers      |
| `GET /api/companies/:slug`      | Company detail (also accepts company id)                   |
| `GET /api/companies/:slug/jobs` | Paginated roles at that company                            |
| `GET /api/skills`               | Tracked skill index, with last-good-day fallback           |
| `GET /api/skills/:slug`         | Skill detail                                               |
| `GET /api/jobs`                 | Paginated jobs (replaces Screener)                         |
| `GET /api/jobs/facets`          | Unfiltered counts and available filter values              |
| `GET /api/jobs/:id`             | Posting, verdict and market context; 410 for a closed role |
| `GET /api/search`               | Grouped profession, company and skill hits; optional roles |

The existing detail/index payloads are retained. Lists for companies, jobs and
company roles return `{items,page,pageSize,total}`. `page` starts at 1;
`pageSize` defaults to 50 and cannot exceed 100. Out-of-range pages have an empty
`items` array and retain the total. Requests use strict zod schemas; unknown
query keys, repeated parameters and invalid filter values return 400 with
`{message,code,fields}`. Other errors return `{message,code}`. There is no
success envelope. The old `/v1` API and `/api/revalidate` are removed.

`GET /api/professions` accepts one optional `region` (an id from `PROFESSION_REGIONS` in
`@cm/core`: `north-america`, `europe`, `apac`, `latam`, `mena`). Under a region, open
roles, new roles and the 1-day and 1-week changes are that region's; remote share,
companies and the 1-month change come back `null`.

Companies accept `q` (literal case-insensitive name substring), `signal`
(`ramping`, `steady`, `cooling`, `freezing`), `sort` (`open`, `name`, `change1w`,
`change30d`, `rank`) and `dir` (`asc`, `desc`). `dir` defaults to `asc` for `name`
and `rank` and `desc` for the rest; the default ordering is open roles descending,
with a stable company-id tie-break. Missing changes, and changes whose window is
too short to show (`fullWindow` in `@cm/core/changes`), sort last.

Jobs and company roles accept `q`, `company` (id, slug or exact name), `family`,
`specialty`, `skill`, `region`, `country`, `workMode`, `level`, `postedWithin`
(days, 1–365), `salaryMin`, `hasPay=true`, `currency` (default USD) and `sort`
(`newest`, `opened`, `salary`). A company route always scopes to its company.
Seniority accepts the entry/mid/senior/staff/management groups and individual
levels. Until the job mirror replaces the upstream adapter, job lists reach at most
page 4; deeper pages return 400 `VALIDATION_FAILED` on `page` asking the client to
narrow the filters. A list costs at most one count call and four job-page calls, and at
most two list requests that need upstream run at once per process; a third gets 503
`SOURCE_UNAVAILABLE` immediately. Fully cached lists are unaffected. Search roles cost two upstream calls per request. The
upstream client uses `KRILL_API_KEY` (and its higher pace limit) when set, and remembers
failures briefly. List items expose an internal `href` instead of an employer link; Apply
lives on the job detail page. Company names can be selected with the search
endpoint and passed as their ids.

Search accepts `q` (max 80 characters), `limit` (per group, 1–10, default 5),
and `roles=1` to include up to eight matching roles. Company search uses the
whole local directory, including companies outside `search_entry`. Role-source
failure preserves local search hits and sets `rolesUnavailable`.

## Data access and module boundaries

Each module has routes, controllers, services, repository, domain and schemas.
Controllers validate requests and write responses; services coordinate the
repositories. Modules import another module only through its `domain.ts`.
`test/boundaries.test.ts` checks the TypeScript dependency graph, including
reexports and dynamic imports.

`database/client.ts` owns the pg pool and Kysely connection. Existing aggregate
SQL is parameterised through Kysely raw builders; directory queries use the typed
query builder. `database/generated.ts` is generated from the current schema:

```sh
pnpm --filter @cm/api db:types --url "$DATABASE_URL"
pnpm --filter @cm/api db:types:check --url "$DATABASE_URL"
```

Jobs, posting detail, company roles, similar roles and role search share the
`JobsRepository` interface in `src/modules/jobs/domain.ts`. The temporary
`integrations/upstreamJobs.ts` adapter retains today's job source and translates
its cursor pages to numbered pages. Its transport has bounded caching and shares
in-flight requests. Company identities, logos, hiring history, market context,
pay bands and global company search already read Postgres. The worker's job
mirror can replace the adapter in `server.ts`, without changing modules or HTTP
contracts. This API creates no mirror table or migrations.

## HTTP deployment

CORS allows `https://careermarket.app`, `https://www.careermarket.app`, HTTPS
Vercel preview hosts, and HTTP localhost/loopback origins with explicit dev
ports. Credentials are not enabled. `createApp` also accepts a
`previewOriginPattern` to narrow preview hosts. The default limit is 120
requests per IP per minute, with standard rate-limit and Retry-After headers.
The limiter is process-local, appropriate to the single VPS API process.

Forwarded headers are untrusted by default. The VPS compose file sets
`API_TRUST_PROXY=1`, because the Caddy reverse proxy is the sole ingress. Higher hop
counts (up to 5) require the matching controlled ingress topology. Successful
reads cache for 60 seconds in browsers and 300 seconds in shared caches, with a
60-second stale revalidation window. Errors and health checks use `no-store`.
CORS emits `Vary: Origin`.

## Validation

```sh
# Use your own disposable database; never point tests at career_market.
TEST_DATABASE_URL=postgres://cm:cm@127.0.0.1:55432/cm_cmr_p2_api pnpm --filter @cm/api test
pnpm --filter @cm/api typecheck
pnpm --filter @cm/api lint
```

Integration tests require a database name beginning `cm_test` or
`cm_cmr_p2_api`. They apply the existing migrations and reset test fixtures.
All seven modules run through real Express HTTP and Postgres; only job-source
responses are faked. CI runs those tests and verifies generated database types.
