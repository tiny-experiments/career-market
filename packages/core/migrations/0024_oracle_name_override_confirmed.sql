-- The four Oracle tenants held unnamed in 0023, confirmed by the product owner. Each name is the
-- employer's own public name; the hold rows are released so company_name_override names them.
insert into company_name_override (company_id, name, note) values
  ('co_vzmmz2sr1pgftzf5', 'LCS', 'eexs: product owner confirmed Life Care Services (US senior living); site CX_1 states "LCS"'),
  ('co_prwgwcnwvpr5565s', 'DeKalb County Government', 'ertd: product owner confirmed; site "DC Career Site"'),
  ('co_a91d11f55d17nz6t', 'Transguard Group', 'iaboey: product owner confirmed; sites "TG_JobSite_main" and "TG_HQJOBS"'),
  ('co_k5bzv7gc5xma0nh2', 'Ascendion', 'iaheme: product owner confirmed Ascendion Mexico Talent Community portal; site code Ascendion*')
on conflict (company_id) do nothing;

insert into company_domain_override (company_id, domain, note) values
  ('co_prwgwcnwvpr5565s', 'dekalbcountyga.gov', 'ertd: DeKalb County Government; the tenant site''s logo is served from dekalbcountyga.gov'),
  ('co_k5bzv7gc5xma0nh2', 'ascendion.com', 'iaheme: Ascendion; the tenant site''s og:image is on ascendion.com')
on conflict (company_id) do nothing;

delete from company_site_name_hold where company_id in
  ('co_vzmmz2sr1pgftzf5', 'co_prwgwcnwvpr5565s', 'co_a91d11f55d17nz6t', 'co_k5bzv7gc5xma0nh2');
