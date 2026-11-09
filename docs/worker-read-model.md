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

Jobs filters use B-tree indexes for profession, employer, seniority, work mode,
posting/opening date and pay; GIN indexes cover country arrays, full-text search
and company-name substring search. A remote partial index supports remote-only
queries. Use `company.open > 0` for the paginated directory: historical companies
keep stable slugs after their last role closes.

Verdicts have the original `repostCount`, `staleScore`, `openedSource`, age and
posting dates in `payload`. Typical hiring windows can join `company_daily` and
`survival_curve`; those remain nightly facts. Closed jobs are removed from the
open mirror; the event ledger retains closures. Job and company-role reads,
search and filters should query Postgres exclusively.

## Scheduling and consistency

The watcher checks metadata every five minutes (`BUILDER_POLL_MINUTES=5`). A new
snapshot must have `exportedAt` for its date; older providers without that field
must report the date in every enabled ATS's `lastRun`. Already successful dates
are skipped unless `--force` is supplied. A failed build retries at the next poll.

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
change. It sums counts for companies represented in both endpoint snapshots,
then divides the current total by the previous total. Newly discovered employers
still contribute to the headline role count. `GROWTH_MODE=raw` includes the full
endpoint totals. A complete seven-day baseline is required; no shorter interval
is labeled as a week. Other existing compute functions retain their established
series and segment behavior.

## Upstream detail limitation

The current `/v1/jobs` listing is capped at 100 jobs/page and omits descriptions.
The mirror stores every listing field needed for filters and verdicts. Changes
hydrate full job detail, and later snapshots preserve an existing description.
A first import cannot contain every job's description with the present API:
individual detail hydration needs one request per job. A bulk listing/export
that includes descriptions is needed to complete this bootstrap within the
nightly build budget. Do not put upstream calls back into public request paths.
