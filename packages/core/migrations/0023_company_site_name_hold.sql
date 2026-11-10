-- Tenants whose careers sites do not state the employer, so the site-name resolver must not
-- name them from a side site ("Aldersly", "DC", "TG JobSite main"). A held company stays
-- unnamed until the product owner confirms its name; a company_name_override row then names it.
create table company_site_name_hold (
  company_id text primary key,
  note       text not null default '',
  updated_at timestamptz not null default now()
);

insert into company_site_name_hold (company_id, note) values
  ('co_vzmmz2sr1pgftzf5', 'eexs: site CX_1 states only "LCS"; the other sites are single communities ("Aldersly", "Clarendale Ann Arbor"); needs confirmation by the product owner'),
  ('co_prwgwcnwvpr5565s', 'ertd: site "DC Career Site"; needs confirmation by the product owner'),
  ('co_a91d11f55d17nz6t', 'iaboey: sites "TG_JobSite_main" and "TG_HQJOBS"; needs confirmation by the product owner'),
  ('co_k5bzv7gc5xma0nh2', 'iaheme: site titled "Career Site - Mexico", site code Ascendion*, logo URL ascendion.com could not be read; needs confirmation by the product owner')
on conflict (company_id) do nothing;
