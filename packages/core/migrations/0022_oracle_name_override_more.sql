-- More hand-checked names for Oracle Recruiting tenants, read from each tenant's own sites
-- (company_site_name keeps naming the rest). These tenants' sites name only a sub-brand, a
-- community, an audience ("Student", "Home Page") or Oracle's default, or tie between brands.
-- Each note gives the tenant code and what its sites state.
insert into company_name_override (company_id, name, note) values
  ('co_v65x9gnzj9yn8zep', 'Kotak Mahindra Bank', 'hcbt: sites "Candidate Experience site" and "Kotak Additional Career Site", logo kotak.com/bank'),
  ('co_vzmmz2sr1pgftzf5', 'LCS', 'eexs: site CX_1 "LCS"; its other sites are single senior living communities ("Aldersly", "Clarendale Ann Arbor", "All Jobs")'),
  ('co_h0hx2jnny8gzm3gj', 'Coherent', 'hcwp: sites "Coherent Corp. US", "Coherent Corp. Vietnam", "Coherent India", "Coherent UK"'),
  ('co_k5bzv7gc5xma0nh2', 'Ascendion', 'iaheme: site "Ascendion" titled "Career Site - Mexico", logo ascendion.com'),
  ('co_x1z6vyd0ayzapytq', 'The Church of Jesus Christ of Latter-day Saints', 'epej: sites "Church" and "MTC Employment", wordmark church_jesus_christ_wordmark_english'),
  ('co_prwgwcnwvpr5565s', 'DeKalb County', 'ertd: site "DC Career Site", logo dekalbcountyga.gov'),
  ('co_rt5ffgfpyc731g1m', 'Suffolk County Council', 'eoce: sites "Suffolk Jobs Direct" and "Suffolk County Council"'),
  ('co_edk555r3d8mxj621', 'Hayleys', 'emdm: sites "Hand Protection", "Fentons Careers" and "Hayleys" ("Join One of Sri Lanka''s Most Respected Conglomerates")'),
  ('co_hmj54jbj6b7g3cw9', 'Miral', 'enpk: sites "Talent Acquisition" and "Miral Experiences", logo Miral_Logo_Suite'),
  ('co_1ykaszmzzmtpezwh', 'Aperam', 'hdhy: site AperamCareerSite titled "Home Page", logo aperam.com'),
  ('co_a91d11f55d17nz6t', 'Transguard Group', 'iaboey: sites "TG_JobSite_main" and "TG_HQJOBS" ("Join TransGuard"), logo transguard_group'),
  ('co_aqgyz4fv9eqw6k8a', 'Ithaca College', 'ehwy: site "Student" ("Prospective Student Employees"), logo ithaca.edu'),
  ('co_k2pv3stjqazzfwqc', 'Telamon', 'hcex: sites "Robotics Career Site" (Telamon Robotics logo) and "Telamon Career Site"'),
  ('co_1m6y5mnpr7pfgcw6', 'Samuel, Son & Co.', 'ebct: sites CX and CX_1033 "Samuel, Son & Co. 1855" (1855 is its founding year)')
on conflict (company_id) do nothing;

-- fa-eqzh-saasfaprod1: the site states "Avient"; the company is Avient Corporation (confirmed).
update company_name_override set name = 'Avient Corporation', note = 'fa-eqzh-saasfaprod1: site "Avient", logo avient.com; Avient Corporation confirmed', updated_at = now()
where company_id = 'co_cg5b0j5aeq3m1gcw';
