# Worker and read-model contract

Run `pnpm migrate`, `pnpm worker`, `pnpm worker:watch`, or `pnpm worker:sweep`.
The old `builder` scripts remain aliases for existing automation. The package and
Docker service are now `@cm/worker` / `worker`. No upstream credential belongs in
the SPA or the public read API.

`packages/core/migrations` is the single ordered SQL migration set. `0011` adds:

- `job_mirror`: one row per currently open job. `payload` is the validated source
  job record; scalar columns and arrays support filtering without JSON scans.
  `id`, `company_id`, `company_name`, `title`, `family`, `specialty`, `level`,
  `countries`, `locations`, `work_mode`, `remote`, `employment_type`, `posted_at`,
  `opened_at`, `first_seen_at`, `last_seen_at`, `opened_source`, `salary_min`,
  `salary_max`, `salary_currency`, `repost_count`, `stale_score`, `description`,
  `description_present`, `payload`, `mirrored_at` are the SQL column names.
  `description_present` distinguishes a missing listing field from full detail
  that explicitly has no text. Pay is annualized.
- `job_mirror_stage`: worker-only staging; never query this from an API route.
- `worker_state`: `name='changes'`, opaque `cursor`, last built `snapshot_date`
  and `exported_at`. Cursor and applied jobs commit in the same transaction.
- `worker_change`: page-position event ledger for replay-safe flow counters.
- `job_counter_daily`: `date`, `new_today` (opened + reopened), `closed_today`.
- `company_open_count`: exact current mirror counts by `company_id`, including
  employers with one role. `company.open` is refreshed with these counts.
  A sweep that meets an employer missing from `company` inserts it with the
  placeholder slug `company-<company_id>` (`placeholderSlug`); the next build
  replaces exactly that slug with the normal name-derived one.

`0015` adds `company_facet` and `skill_facet`: per-company and per-tracked-skill counts
of profession, level, country, work mode and skills, plus time open and the middle half
of listed USD pay. `refresh_market_facets()` rebuilds both from `job_mirror` inside the
snapshot transaction, so a page of companies never scans the mirror. Sweeps do not
refresh them: shares move slowly and the next build corrects them.

Jobs filters use B-tree indexes for profession, employer, seniority, work mode,
posting/opening date and pay; GIN indexes cover country arrays, full-text search
and company-name substring search. A remote partial index supports remote-only
queries. Use `company.open > 0` for the paginated directory: historical companies
keep stable slugs after their last role closes.

Verdicts have the original `repostCount`, `staleScore`, `openedSource`, age and
posting dates in `payload`. Typical hiring windows can join `company_daily` and
`survival_curve`; those remain nightly facts. Closed jobs are removed from the
open mirror; the event ledger retains closures. Job and company-role reads,
search and filters query Postgres exclusively; only a missing job description
may trigger the approved one-time detail hydration described below.

## Scheduling and consistency

The watcher checks metadata every five minutes (`BUILDER_POLL_MINUTES=5`). A new
snapshot must have `exportedAt` for its date; older providers without that field
must report the date in every enabled ATS's `lastRun`. Already successful dates
are skipped unless `--force` is supplied. A failed build retries at the next poll.
The one-off `build --assume-exported` passes the `exportedAt` check for an operator who has confirmed
the day's export exists; the watcher never does.

A complete mirror is staged before publication. Current facets prove whether
profession partitions cover every open job; when they do, ATS × profession
partitions overlap long pagination chains. Otherwise the worker falls back to
whole-ATS pulls, retaining unclassified jobs. The same snapshot supplies
current facets, age cuts and salary samples locally, avoiding thousands of
redundant network requests. Historical statistics and closing samples retain
the original upstream inputs and compute functions. Snapshot publication and
all derived tables are one database transaction. Both mirror tables carry the
same indexes; publication swaps their names atomically instead of copying the
whole indexed inventory. No other table holds foreign keys to either mirror. A session advisory lock
serializes builds and sweeps across worker processes without holding a long
transaction during network calls.

The change sweep runs every fifteen minutes (`WORKER_SWEEP_MINUTES=15`), resumes
from its stored cursor and never caches feed pages or job detail fetches. Each
page hydrates the latest job state, so a closure followed by a reopen cannot
erase the reopened job. If any hydration fails, neither that page's jobs nor its
cursor change. Initial snapshot capture obtains a current high-water cursor
from the empty next-day feed; subsequent builds retain the existing cursor.
A failed or interrupted full build leaves the previous read model available.

`KRILL_API_KEY` enables a client-wide 500 starts/minute ceiling. Concurrency is
bounded at `WORKER_CONCURRENCY=12`, including retries, with serialized request
start times and server rate-limit holds. Anonymous workers stay below 50/minute.

## Growth

`GROWTH_MODE=like-for-like` is the default for the market headline week-on-week
change. It sums counts for companies represented in both endpoint snapshots
that kept the same boards all week, then divides the current total by the
previous total. A company drops out of the comparison when any day after the
base restarts its series by the company pages' rule (`isBoardEvent`: a board
added, fetched in bulk or dropped, roles back from zero, or open roles that
moved well beyond the day's openings and closings because krill re-counted
them), because that day moves roles that were already open elsewhere. Without this, boards attached to
existing companies mid-week read the week to 10 Nov 2026 as +14.9% while open
roles rose about 1%. Newly discovered employers still contribute to the headline
role count. `GROWTH_MODE=raw` includes the full endpoint totals. A complete
seven-day baseline from the last bootstrap day on is required; no shorter
interval is labeled as a week. Other existing compute functions retain their
established series and segment behavior.

## Counting changes

krill sometimes re-counts open roles without opening or closing them: on
10 Nov 2026 it merged about 29,900 duplicate Oracle records (one requisition
listed on several careers sites of a tenant) into their canonical jobs, and it
keeps earlier daily totals as they were. Every series then steps down for one
day, which is an identity correction, not hiring.

- Market and professions: `countingChangeDays` marks a day whose market total
  or matched-board panel moved more than 2% (total) or 5% (panel) beyond that
  day's openings and closings; a normal day stays within 0.3% and 2%. The chain
  index holds that day flat like a bootstrap day, so the open-roles line and
  every market and profession change rebase the earlier history onto the
  corrected count, and profession shares hold across it.
- Skills: skill counts are kept on their build day and cannot be refetched, so
  after a re-count they disagree with the refetched market total until the next
  build. `sliceBasisChangeDays` holds a skill's share on any day the skills'
  combined share of open roles jumps by 5% or more.
- Companies: `isBoardEvent` treats open roles that moved by at least 10 and 10%
  beyond the day's openings and closings as a board event, so the company's
  series restarts there (company changes, signals, Cooling and Ramping fastest,
  Companies ramping, the headline week, profession top companies and the Job
  page's company trend). Companies left with no open roles leave every list.

## Description coverage

The accepted full keyed build took **9m16.228s** for 297,827 jobs. Historical
responses were warm; every job listing was fetched fresh. The eight-minute
figure was a planning target; this measured build time is accepted.

The source listing omits posting text. `description_present` distinguishes a
missing field from full detail that legitimately returns null. Coverage grows
through three paths:

- A first job-page visit hydrates the missing description, persists it, and
  returns the posting from Postgres. Later visits use Postgres. Concurrent first
  visits through one hydrator instance share one request. Fetch failures remain
  retryable; closed roles return tombstones and cannot be resurrected.
- Opened, updated and reopened change events hydrate full detail during the
  fifteen-minute sweep. Subsequent nightly snapshots preserve known text.
- The watcher's idle steps backfill missing text in newest-first-seen order.
  `WORKER_BACKFILL_PER_MIN=120` caps the background rate; 0 disables it. The
  normal client rate gate also applies. Builds and sweeps run first, and backfill
  admits only one in-flight job between foreground ticks. Other worker processes
  holding the build/sweep lock cause the backfill to yield. A completed coverage
  flag is its durable resume cursor. Failed or closed lookups receive a persisted
  one-hour deferral in `job_description_retry`, so they cannot pin the queue.

### API integration

`apps/api/src/server.ts` builds one `createDescriptionHydrator({sql, api})` from
`@cm/worker/descriptions`, with a core postgres.js pool and a keyed `KrillApi`.
Its `lookup(id)` returns `{kind:'open',job}`, `{kind:'closed',tombstone}` or
`{kind:'missing'}`. It updates only text and coverage, so an on-demand response
cannot overwrite newer sweep metadata. Lists, filters, company roles, similar
roles and search stay local.

`0012_description_backfill.sql` adds both queue indexes and the persisted retry
table to the same ordered migration set. `0017_job_mirror_skills_index.sql` adds
the skill and pay-ranking indexes to both mirror tables, and `0018_worker_change_job_index.sql`
indexes `worker_change` by `(job_id, kind, date desc)` for the closed-role lookup. Neither mirror may have incoming
foreign keys because publication rotates its physical table identity.
