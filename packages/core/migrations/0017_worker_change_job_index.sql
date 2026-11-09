-- A job page for a closed or unmirrored role looks up its last recorded closing by job.
create index worker_change_job_idx on worker_change(job_id, kind, date desc);
