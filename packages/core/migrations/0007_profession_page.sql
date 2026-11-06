-- Career Market read model, part 2: what the Profession page needs.
-- Every table is derived from krill and rebuilt by the builder.

-- Open jobs per family by age, like open_age_cut but per family. Feeds the
-- family back-cast and the family's median days open.
-- kind 'opened': opened day on or after cut_date. kind 'posted': posted day on or
-- after cut_date (dated jobs only); cut_date '1970-01-01' counts every dated job.
create table family_age_cut (
  snapshot_date date    not null,
  family        text    not null,
  kind          text    not null check (kind in ('opened', 'posted')),
  cut_date      date    not null,
  count         integer not null,
  primary key (snapshot_date, family, kind, cut_date)
);

-- Estimated (back-cast) days per family before the first observed day. Observed
-- days live in family_daily. Rebuilt on every build.
create table family_estimate_daily (
  date   date    not null,
  family text    not null,
  open   integer not null,
  opened integer not null,
  closed integer not null,
  primary key (date, family)
);

-- One row per family and snapshot day: figures that need their own krill calls.
create table profession_snapshot (
  date             date    not null,
  family           text    not null,
  companies        integer,           -- companies with at least one open role in the family
  median_days_open double precision,  -- from family_age_cut ('opened')
  remote           integer,
  hybrid           integer,
  onsite           integer,
  work_mode_total  integer,           -- open roles the work-mode facet covers
  salary_n         integer,           -- roles with listed pay in the sample
  salary_p25       integer,
  salary_p50       integer,
  salary_p75       integer,
  salary_currency  text,
  salary_scope     text,              -- e.g. 'US, senior, newest 300 with pay'
  primary key (date, family)
);

-- Top hiring companies per family and day, with the change since the base day.
create table profession_company (
  date        date    not null,
  family      text    not null,
  rank        integer not null,
  company_id  text    not null,
  name        text    not null,
  domain      text,
  open        integer not null,
  base_date   date,
  base_open   integer,
  change      double precision,       -- fraction; null without a comparable base day or on a coverage jump
  coverage_jump boolean not null default false, -- open roles moved by more than half: krill added or lost a board
  partial     boolean not null default false,
  new_sum     integer,
  closed_sum  integer,
  signal      text,                    -- HOT | STRONG | RISING | STEADY | COOLING | null
  primary key (date, family, rank)
);

-- Newest roles per family at the snapshot day.
create table profession_latest_role (
  date          date    not null,
  family        text    not null,
  rank          integer not null,
  job_id        text    not null,
  title         text    not null,
  company_id    text,
  company_name  text    not null,
  company_domain text,
  location      text,
  work_mode     text,
  salary_text   text,
  opened_on     date    not null,
  primary key (date, family, rank)
);
