-- The name a visitor reads, worked out from the directory's name and the resolved domain.
-- `company.name` stays what the directory holds, which the domain resolver matches against.
-- Null until the worker has named the company; readers fall back to `name`.
alter table company add column display_name text;
alter table company add column named boolean;
