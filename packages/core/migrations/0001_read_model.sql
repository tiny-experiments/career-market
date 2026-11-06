-- Career Market read model, part 1: the tables the Market overview needs.
-- Every table is derived from krill and can be rebuilt by the builder
-- (`pnpm builder -- --full`). Dates are snapshot days (UTC calendar days).

-- One row per builder run.
create table build_run (
  id               bigserial primary key,
  snapshot_date    date        not null,
  status           text        not null check (status in ('running', 'ok', 'failed')),
  taxonomy_version integer,
  started_at       timestamptz not null default now(),
  finished_at      timestamptz,
  error            text,
  stats            jsonb       not null default '{}'::jsonb
);
create index build_run_ok_idx on build_run (snapshot_date desc) where status = 'ok';

-- Whole tech market, one row per day. Observed rows come from krill
-- /v1/stats/daily and /v1/stats/panel/daily; estimated rows (before the first
-- observed day) come from the survival-corrected back-cast.
create table market_daily (
  date                  date    primary key,
  estimated             boolean not null default false,
  open                  integer not null,          -- raw open count krill held that day (estimated: back-cast)
  open_on_today_boards  integer not null,          -- open rebased with the chain-linked index onto today's boards
  new                   integer,                   -- first sightings (krill "new")
  new_known             integer,                   -- first sightings on boards krill already knew
  new_first_fetch       integer,                   -- first sightings on boards fetched for the first time
  opened                integer not null,          -- jobs whose opened day is this day (posted, else first seen)
  closed                integer not null,          -- closings detected this day
  boards_ok             integer,
  matched_boards        integer,
  matched_open          integer,
  matched_previous_open integer,
  link                  double precision,          -- day link used by the index (1 when excluded)
  index_value           double precision not null, -- chain-linked index, 100 on the first observed day
  companies             integer,                   -- companies with an open tech job (snapshot days only)
  boards                integer,                   -- boards krill tracks (snapshot days only)
  median_days_open      double precision           -- median age of open jobs (snapshot days only)
);

-- krill daily_stat at its own grain: family x specialty x level x country.
-- '' stands for "not classified" so the key stays a plain primary key.
create table profession_daily (
  date      date    not null,
  family    text    not null,
  specialty text    not null default '',
  level     text    not null default '',
  country   text    not null default '',
  open      integer not null,
  new       integer not null,
  closed    integer not null,
  opened    integer not null,
  primary key (date, family, specialty, level, country)
);
create index profession_daily_family_idx on profession_daily (family, date);

-- Family-level series derived from profession_daily and the market index.
create table family_daily (
  date        date    not null,
  family      text    not null,
  code        text    not null,
  open        integer not null,
  opened      integer not null,
  closed      integer not null,
  share       double precision not null,  -- open / market open that day
  index_value double precision not null,  -- share-adjusted chain-linked index, 100 on the first observed day
  primary key (date, family)
);

-- Open jobs per skill and family, from /v1/facets on each snapshot day.
-- country '*' means all countries (per-country skill counts come later).
create table skill_daily (
  date    date    not null,
  skill   text    not null,
  family  text    not null,
  country text    not null default '*',
  open    integer not null,
  primary key (date, skill, family, country)
);

-- Open tech jobs per company on each snapshot day (top companies from
-- /v1/companies). family '*' = all families. new/closed arrive with krill K2.
create table company_daily (
  date       date    not null,
  company_id text    not null,
  name       text    not null,
  family     text    not null default '*',
  open       integer not null,
  new        integer,
  closed     integer,
  primary key (date, company_id, family)
);

-- Changes over the standard ranges for every subject the pages show.
create table market_change (
  as_of      date    not null,
  subject    text    not null,           -- 'market' | 'family:<id>' | 'skill:<id>'
  range      text    not null check (range in ('1W', '1M', '3M', '1Y', 'ALL')),
  base_date  date    not null,
  change     double precision not null,  -- fraction: 0.021 = +2.1%
  partial    boolean not null,           -- the range reaches before the first comparable day
  estimated  boolean not null,           -- the base value comes from the back-cast
  primary key (as_of, subject, range)
);

-- Inputs of the back-cast and of "median days open".
-- kind 'opened': open jobs whose opened day is on or after cut_date.
-- kind 'posted': open jobs whose posted day is on or after cut_date (dated jobs only).
create table open_age_cut (
  snapshot_date date    not null,
  kind          text    not null check (kind in ('opened', 'posted')),
  cut_date      date    not null,
  count         integer not null,
  primary key (snapshot_date, kind, cut_date)
);

-- A systematic sample of the jobs krill closed each day, with their age at close.
create table closing_sample (
  job_id        text primary key,
  detected_on   date not null,   -- the change-feed day (close detection)
  closed_on     date not null,   -- krill closedAt (first missed day)
  opened_on     date not null,
  opened_source text not null,
  family        text
);
create index closing_sample_day_idx on closing_sample (detected_on);

-- Survival curve fitted from closing_sample, one row per age bucket.
create table survival_curve (
  snapshot_date date    not null,
  age_from      integer not null,
  age_to        integer not null,
  hazard        double precision not null,  -- daily closing rate inside the bucket
  survival_end  double precision not null,  -- S(age_to)
  closings      integer not null,           -- sampled closings in the bucket
  primary key (snapshot_date, age_from)
);

-- Rule-written market notes (no LLM), a few per day.
create table market_note (
  date    date    not null,
  rank    integer not null,
  rule    text    not null,
  text    text    not null,
  numbers jsonb   not null default '{}'::jsonb,
  primary key (date, rank)
);
