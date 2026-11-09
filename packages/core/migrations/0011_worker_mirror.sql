-- One durable cursor and an atomic, queryable local copy of every open job.
create table worker_state (
  name text primary key,
  cursor text,
  snapshot_date date,
  exported_at timestamptz,
  updated_at timestamptz not null default now()
);

create table job_mirror (
  id text primary key,
  company_id text not null,
  company_name text not null,
  title text not null,
  family text,
  specialty text,
  level text,
  countries text[] not null default '{}',
  locations text[] not null default '{}',
  work_mode text,
  remote boolean not null,
  employment_type text,
  posted_at timestamptz,
  opened_at date not null,
  first_seen_at date not null,
  last_seen_at date not null,
  opened_source text not null,
  salary_min double precision,
  salary_max double precision,
  salary_currency text,
  repost_count integer not null,
  stale_score double precision,
  description text,
  payload jsonb not null,
  mirrored_at timestamptz not null default now()
);
create index job_mirror_company_idx on job_mirror(company_id, opened_at desc, id);
create index job_mirror_family_idx on job_mirror(family, opened_at desc, id);
create index job_mirror_level_idx on job_mirror(level, opened_at desc, id);
create index job_mirror_mode_idx on job_mirror(work_mode, opened_at desc, id);
create index job_mirror_remote_idx on job_mirror(opened_at desc, id) where remote;
create index job_mirror_posted_idx on job_mirror(posted_at desc, id);
create index job_mirror_opened_idx on job_mirror(opened_at desc, id);
create index job_mirror_pay_idx on job_mirror(salary_currency, salary_min, salary_max) where salary_min is not null or salary_max is not null;
create index job_mirror_countries_idx on job_mirror using gin(countries);
create index job_mirror_search_idx on job_mirror using gin(to_tsvector('simple', company_name || ' ' || title));
create extension if not exists pg_trgm;
create index job_mirror_company_name_idx on job_mirror using gin(lower(company_name) gin_trgm_ops);

-- Staging is persistent, but never read by the API; failed builds leave the previous mirror intact.
create table job_mirror_stage (like job_mirror including defaults including constraints);
alter table job_mirror_stage add primary key (id);

create table worker_change (
  event_key text primary key,
  job_id text not null,
  kind text not null,
  date date not null,
  company_id text,
  applied_at timestamptz not null default now()
);
create index worker_change_date_idx on worker_change(date, kind);
create table job_counter_daily (
  date date primary key,
  new_today integer not null default 0,
  closed_today integer not null default 0
);
create table company_open_count (
  company_id text primary key,
  open integer not null check (open >= 0)
);
