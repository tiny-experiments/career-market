-- Career Market read model, part 4: the tables the Skill page needs.
-- Every table is derived from krill and can be rebuilt by the builder, except
-- the day-by-day counts (skill_company_daily, skill_pair_daily): krill serves no
-- skill history, so those rows accumulate from the first build onward.

-- One row per tracked skill per snapshot day.
create table skill_summary (
  date           date    not null,
  skill          text    not null,
  slug           text    not null,
  open_total     integer not null,   -- open roles naming the skill, every profession
  primary_family text,               -- the profession with the most roles naming the skill
  primary key (date, skill)
);
create index skill_summary_slug_idx on skill_summary (slug, date desc);

-- Posted-day cuts per skill and profession (inputs of the skill back-cast):
-- open roles naming the skill that were posted on or after cut_date.
-- family '*' = every profession; cut_date 1970-01-01 = every dated role.
create table skill_age_cut (
  snapshot_date date    not null,
  skill         text    not null,
  family        text    not null,
  cut_date      date    not null,
  count         integer not null,
  primary key (snapshot_date, skill, family, cut_date)
);

-- The demand chart: estimated days (back-cast), then observed days adjusted to
-- today's boards. family '*' = every profession.
create table skill_series (
  date      date    not null,
  skill     text    not null,
  family    text    not null,
  estimated boolean not null,
  open      integer not null,
  primary key (skill, family, date)
);

-- Companies naming the skill, largest first (top of krill's company facet).
create table skill_company_daily (
  date       date    not null,
  skill      text    not null,
  company_id text    not null,
  open       integer not null,
  primary key (date, skill, company_id)
);

-- Skills that appear in the same roles as the skill (top of krill's skill facet).
create table skill_pair_daily (
  date  date    not null,
  skill text    not null,
  other text    not null,
  open  integer not null,   -- roles naming both
  primary key (date, skill, other)
);

-- Company names and websites, looked up once from krill /v1/companies/{id}.
create table company_ref (
  company_id text primary key,
  name       text not null,
  domain     text,
  fetched_on date not null
);

-- The newest roles naming each skill, as krill listed them on the snapshot day.
create table skill_latest_role (
  date            date    not null,
  skill           text    not null,
  rank            integer not null,
  job_id          text    not null,
  title           text    not null,
  company_id      text    not null,
  company_name    text    not null,
  location        text,
  salary_min      integer,
  salary_max      integer,
  salary_currency text,
  opened_on       date    not null,
  primary key (date, skill, rank)
);

-- "Salary effect": median listed pay of roles naming the skill against roles
-- in the same profession without it (US roles with listed USD pay).
create table skill_salary_effect (
  date           date    not null,
  skill          text    not null,
  family         text    not null,
  currency       text    not null,
  n_with         integer not null,
  n_without      integer not null,
  median_with    integer,
  median_without integer,
  sample_size    integer not null,   -- priced roles sampled in the profession
  primary key (date, skill)
);
