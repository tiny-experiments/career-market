-- Career Market read model, Screener and global search.
-- Every table is derived from krill and rebuilt by the builder.

-- krill company daily statistics (K2), per company, family and day.
-- family '*' is the company total. History starts on krill's first live day (2026-11-06).
create table screener_company_day (
  date       date    not null,
  company_id text    not null,
  family     text    not null default '*',
  open       integer not null,
  new        integer not null,
  closed     integer not null,
  primary key (date, company_id, family)
);
create index screener_company_day_company_idx on screener_company_day (company_id, date);

-- The companies the Screener lists (the largest by open roles) with the
-- columns krill cannot serve per company in one call.
create table screener_company (
  as_of          date    not null,
  company_id     text    not null,
  slug           text    not null,
  name           text    not null,
  domain         text,
  open           integer not null,
  top_family     text,
  top_family_open integer,
  top_skills     text[]  not null default '{}',
  remote         integer not null default 0,   -- open roles stating a work mode, by mode
  hybrid         integer not null default 0,
  onsite         integer not null default 0,
  signal         text check (signal in ('ramping', 'steady', 'cooling', 'freezing')),
  signal_days    integer,                      -- comparable days the signal covers
  primary key (as_of, company_id)
);
create index screener_company_slug_idx on screener_company (as_of, slug);

-- Work-mode counts and the largest profession per skill and per family.
create table screener_subject (
  as_of      date    not null,
  kind       text    not null check (kind in ('family', 'skill')),
  id         text    not null,
  open       integer not null,
  top_family text,
  remote     integer not null default 0,
  hybrid     integer not null default 0,
  onsite     integer not null default 0,
  primary key (as_of, kind, id)
);

-- Today's krill facet counts with no filter: the Screener's summary strip and the
-- values its dropdowns offer. kind: level | workMode | country | family | skill.
create table screener_facet (
  as_of date    not null,
  kind  text    not null,
  value text    not null,
  count integer not null,
  primary key (as_of, kind, value)
);

-- The typeahead index: professions, companies and skills.
create table search_entry (
  as_of    date    not null,
  kind     text    not null check (kind in ('profession', 'company', 'skill')),
  id       text    not null,
  slug     text    not null,
  label    text    not null,
  sublabel text,
  open     integer not null,
  domain   text,
  keywords text    not null default '',        -- lower-case extra match text (aliases, ticker, code)
  primary key (as_of, kind, id)
);
create index search_entry_label_idx on search_entry (as_of, kind, lower(label) text_pattern_ops);
