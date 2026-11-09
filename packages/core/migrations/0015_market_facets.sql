-- What the company and skill pages say about open roles: shares, levels, places and pay.
-- Counted once per snapshot from the job mirror, so a page of companies never scans it.
create table company_facet (
  company_id text primary key,
  open integer not null,
  top_family text,
  remote integer not null,
  stated_mode integer not null,
  families jsonb not null default '[]'::jsonb,
  levels jsonb not null default '[]'::jsonb,
  countries jsonb not null default '[]'::jsonb,
  work_modes jsonb not null default '[]'::jsonb,
  skills jsonb not null default '[]'::jsonb,
  median_days_open double precision,
  pay_n integer not null default 0,
  pay_low double precision,
  pay_median double precision,
  pay_high double precision
);

create table skill_facet (
  skill text primary key,
  open integer not null,
  remote integer not null,
  stated_mode integer not null,
  pay_n integer not null default 0,
  pay_low double precision,
  pay_median double precision,
  pay_high double precision
);

create function refresh_market_facets() returns void language plpgsql as $$
begin
  delete from company_facet;
  delete from skill_facet;

  insert into company_facet (
    company_id, open, top_family, remote, stated_mode, families, levels, countries, work_modes, skills,
    median_days_open, pay_n, pay_low, pay_median, pay_high
  )
  with jobs as (
    select company_id, family, level, countries, work_mode, payload, opened_at,
      case when salary_currency = 'USD' and salary_min is not null and salary_max is not null
        then (salary_min + salary_max) / 2 end as pay
    from job_mirror
  ),
  totals as (
    select company_id, count(*)::int as open,
      count(*) filter (where work_mode = 'remote')::int as remote,
      count(*) filter (where work_mode is not null)::int as stated_mode,
      percentile_cont(0.5) within group (order by current_date - opened_at) as median_days_open,
      count(pay)::int as pay_n,
      percentile_cont(0.25) within group (order by pay) as pay_low,
      percentile_cont(0.5) within group (order by pay) as pay_median,
      percentile_cont(0.75) within group (order by pay) as pay_high
    from jobs group by company_id
  ),
  family_counts as (
    select company_id, family as value, count(*)::int as n from jobs where family is not null group by 1, 2
  ),
  level_counts as (
    select company_id, level as value, count(*)::int as n from jobs where level is not null group by 1, 2
  ),
  mode_counts as (
    select company_id, work_mode as value, count(*)::int as n from jobs where work_mode is not null group by 1, 2
  ),
  country_counts as (
    select company_id, value, n, row_number() over (partition by company_id order by n desc, value) as place
    from (select company_id, country as value, count(*)::int as n from jobs, unnest(countries) as country group by 1, 2) c
  ),
  skill_counts as (
    select company_id, value, n, row_number() over (partition by company_id order by n desc, value) as place
    from (select company_id, skill as value, count(*)::int as n from jobs, jsonb_array_elements_text(payload -> 'skills') as skill group by 1, 2) s
  ),
  families as (
    select company_id, jsonb_agg(jsonb_build_object('value', value, 'count', n) order by n desc, value) as items,
      (array_agg(value order by n desc, value))[1] as top from family_counts group by 1
  ),
  levels as (
    select company_id, jsonb_agg(jsonb_build_object('value', value, 'count', n) order by n desc, value) as items from level_counts group by 1
  ),
  modes as (
    select company_id, jsonb_agg(jsonb_build_object('value', value, 'count', n) order by n desc, value) as items from mode_counts group by 1
  ),
  countries as (
    select company_id, jsonb_agg(jsonb_build_object('value', value, 'count', n) order by place) as items from country_counts where place <= 12 group by 1
  ),
  skills as (
    select company_id, jsonb_agg(jsonb_build_object('value', value, 'count', n) order by place) as items from skill_counts where place <= 12 group by 1
  )
  select t.company_id, t.open, f.top, t.remote, t.stated_mode,
    coalesce(f.items, '[]'::jsonb), coalesce(l.items, '[]'::jsonb), coalesce(c.items, '[]'::jsonb),
    coalesce(m.items, '[]'::jsonb), coalesce(s.items, '[]'::jsonb),
    t.median_days_open, t.pay_n, t.pay_low, t.pay_median, t.pay_high
  from totals t
  left join families f using (company_id)
  left join levels l using (company_id)
  left join countries c using (company_id)
  left join modes m using (company_id)
  left join skills s using (company_id);

  insert into skill_facet (skill, open, remote, stated_mode, pay_n, pay_low, pay_median, pay_high)
  select skill, count(*)::int,
    count(*) filter (where work_mode = 'remote')::int,
    count(*) filter (where work_mode is not null)::int,
    count(pay)::int,
    percentile_cont(0.25) within group (order by pay),
    percentile_cont(0.5) within group (order by pay),
    percentile_cont(0.75) within group (order by pay)
  from (
    select work_mode, jsonb_array_elements_text(payload -> 'skills') as skill,
      case when salary_currency = 'USD' and salary_min is not null and salary_max is not null
        then (salary_min + salary_max) / 2 end as pay
    from job_mirror
  ) j
  where skill in (select t.skill from skill_tracked t where t.date = (select max(date) from skill_tracked))
  group by skill;
end;
$$;

select refresh_market_facets();
