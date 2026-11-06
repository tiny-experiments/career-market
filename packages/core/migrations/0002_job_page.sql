-- Career Market read model, part 2: what the Job page needs.
-- Derived from krill and rebuildable (`pnpm builder -- --force`).

-- Pay bands for "Salary vs. band": the 25th, 50th and 75th percentile of the
-- annualised pay midpoint of open roles that list pay, per profession and
-- seniority. Built from a sample of the newest roles with listed pay (krill has
-- no percentile endpoint yet), US roles in USD only. A band is stored only when
-- the sample holds MIN_BAND_N (30) roles. '' stands for "all".
create table pay_band (
  date      date    not null,
  family    text    not null,
  specialty text    not null default '',
  level     text    not null default '',
  country   text    not null,
  currency  text    not null,
  n         integer not null,                -- roles in the sample that fall in this band
  p25       double precision not null,
  p50       double precision not null,
  p75       double precision not null,
  primary key (date, family, specialty, level, country, currency)
);
