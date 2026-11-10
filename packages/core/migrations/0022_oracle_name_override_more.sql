-- More hand-checked names for Oracle Recruiting tenants, read from each tenant's own sites
-- (company_site_name keeps naming the rest). Every row is a name the tenant site states in its
-- site name or logo text, in the spelling the site uses; the note gives the tenant code and the
-- evidence. Tenants whose sites do not state the employer stay unnamed.
insert into company_name_override (company_id, name, note) values
  ('co_v65x9gnzj9yn8zep', 'Kotak', 'hcbt: site CX_1001 "Kotak Additional Career Site"; logo reads "kotak"'),
  ('co_h0hx2jnny8gzm3gj', 'Coherent', 'hcwp: sites "Coherent UK", "Coherent India", "Coherent Corp. US"'),
  ('co_x1z6vyd0ayzapytq', 'The Church of Jesus Christ of Latter-day Saints', 'epej: site "Church"; wordmark image reads "The Church of Jesus Christ of Latter-day Saints"'),
  ('co_rt5ffgfpyc731g1m', 'Suffolk County Council', 'eoce: site "Suffolk County Council"'),
  ('co_edk555r3d8mxj621', 'Hayleys', 'emdm: site "Hayleys"'),
  ('co_hmj54jbj6b7g3cw9', 'Miral Experiences', 'enpk: site CX_4001 "Miral Experiences"; logo reads "MIRAL Experiences"'),
  ('co_1ykaszmzzmtpezwh', 'Aperam', 'hdhy: site titled "Home Page"; logo reads "aperam"'),
  ('co_aqgyz4fv9eqw6k8a', 'Ithaca College', 'ehwy: site "Student"; logo reads "Ithaca College"'),
  ('co_k2pv3stjqazzfwqc', 'Telamon', 'hcex: site "Telamon Career Site"'),
  ('co_1m6y5mnpr7pfgcw6', 'Samuel, Son & Co. 1855', 'ebct: sites CX and CX_1033 "Samuel, Son & Co. 1855"')
on conflict (company_id) do nothing;

-- fa-eqzh-saasfaprod1: the site states "Avient"; the company is Avient Corporation (confirmed).
update company_name_override set name = 'Avient Corporation', note = 'fa-eqzh-saasfaprod1: site "Avient", logo avient.com; Avient Corporation confirmed', updated_at = now()
where company_id = 'co_cg5b0j5aeq3m1gcw';
