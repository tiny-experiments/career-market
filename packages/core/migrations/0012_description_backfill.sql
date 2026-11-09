-- Coverage is the resume cursor: completed rows leave the newest-first queue.
create index job_mirror_description_queue_idx on job_mirror(first_seen_at desc, id desc)
  where not description_present;
create index job_mirror_stage_description_queue_idx on job_mirror_stage(first_seen_at desc, id desc)
  where not description_present;

create table job_description_retry (
  job_id text primary key,
  retry_after timestamptz not null,
  attempts integer not null default 1
);
