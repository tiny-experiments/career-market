-- The site name each Oracle Recruiting careers site states for a company the directory
-- knows only by a tenant code ("fa-eqzh-saasfaprod1" states "Avient"). The worker finds the
-- sites in the company's job links, keeps the open roles on each, and reads each site's
-- name again after LOGO_RECHECK_DAYS. Naming takes the name that covers the most roles.
create table company_site_name (
  company_id text not null,
  site_url   text not null,
  jobs       integer not null default 0,
  -- Null until read, or when the page states no name.
  site_name  text,
  checked_at timestamptz,
  primary key (company_id, site_url)
);
create index company_site_name_url_idx on company_site_name (site_url);
