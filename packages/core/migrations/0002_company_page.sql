-- Career Market read model, part 2: the Company page and the Companies ramping column.
-- Every table is derived from krill and rebuilt by the builder. Dates are snapshot days (UTC).

-- company_daily now also holds every company's krill daily statistics (family '*'), so the
-- name is optional there: names live in `company`.
alter table company_daily alter column name drop not null;

-- Company directory: every company with at least 10 open tech roles on the latest snapshot day.
create table company (
  company_id  text primary key,
  slug        text not null unique,
  name        text not null,
  domain      text,                         -- registrable domain krill holds (logo lookups); null when unknown
  careers_url text,                         -- board url of the largest live board (profiled companies only)
  ats         text[] not null default '{}',
  open        integer not null,             -- open tech roles on updated_on
  rank        integer not null,             -- by open roles, 1 = most
  profiled    boolean not null default false,
  updated_on  date not null
);
create index company_rank_idx on company (rank);
create index company_name_idx on company (lower(name));

-- krill company daily statistics by family and level, for profiled companies.
-- '' stands for "not classified" so the key stays a plain primary key.
create table company_slice_daily (
  date       date    not null,
  company_id text    not null,
  family     text    not null default '',
  level      text    not null default '',
  open       integer not null,
  new        integer not null,             -- krill "new": first seen (or seen again) that day
  closed     integer not null,
  primary key (date, company_id, family, level)
);
create index company_slice_company_idx on company_slice_daily (company_id, date);

-- Today's profile of a company (krill facets with a company filter), profiled companies only.
create table company_profile (
  as_of            date    not null,
  company_id       text    not null,
  total            integer not null,
  levels           jsonb   not null default '[]'::jsonb,   -- [{value, count}]
  skills           jsonb   not null default '[]'::jsonb,
  countries        jsonb   not null default '[]'::jsonb,
  work_modes       jsonb   not null default '[]'::jsonb,
  median_days_open double precision,
  primary key (as_of, company_id)
);

-- Rule-based hiring signal per company (ramping, steady, cooling, freezing).
create table company_signal (
  as_of       date    not null,
  company_id  text    not null,
  state       text    not null check (state in ('RAMPING', 'STEADY', 'COOLING', 'FREEZING')),
  window_from date    not null,           -- first day inside the flow window
  window_days integer not null,
  opened      integer not null,           -- openings inside the window (krill "new")
  closed      integer not null,           -- closings inside the window
  open_base   integer not null,           -- open roles the day before the window
  partial     boolean not null,           -- the window is shorter than 30 days
  explainer   text    not null,           -- the rule-written sentence under the hiring trend chart
  primary key (as_of, company_id)
);

-- Similar companies: cosine similarity of family and skill shares, profiled companies only.
create table company_peer (
  as_of      date    not null,
  company_id text    not null,
  peer_id    text    not null,
  rank       integer not null,
  similarity double precision not null,
  primary key (as_of, company_id, peer_id)
);
