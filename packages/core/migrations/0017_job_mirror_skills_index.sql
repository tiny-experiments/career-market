-- Jobs filtered by skill, similar roles matched on skills, and ranking by pay read the mirror directly.
-- Both tables carry the same indexes because publication swaps their names.
create index job_mirror_skills_idx on job_mirror using gin ((payload -> 'skills'));
create index job_mirror_stage_skills_idx on job_mirror_stage using gin ((payload -> 'skills'));
create index job_mirror_pay_rank_idx on job_mirror (salary_currency, (coalesce(salary_max, salary_min)) desc, opened_at desc, id)
  where salary_min is not null or salary_max is not null;
create index job_mirror_stage_pay_rank_idx on job_mirror_stage (salary_currency, (coalesce(salary_max, salary_min)) desc, opened_at desc, id)
  where salary_min is not null or salary_max is not null;
