-- Hand-checked names for Oracle Recruiting tenants whose careers site name is an
-- abbreviation, a sub-brand or Oracle's default ("Candidate Experience site"). Each name
-- comes from the tenant's own site: its site name together with the logo or tagline the
-- site shows. The note gives the tenant code and what the site states. Every other tenant
-- takes its site name as is (company_site_name).
insert into company_name_override (company_id, name, note) values
  ('co_cg5b0j5aeq3m1gcw', 'Avient', 'fa-eqzh-saasfaprod1: site "Avient", logo avient.com'),
  ('co_ev9bxcy4jejj5wt8', 'Mayo Clinic', 'fa-euwp-saasfaprod1: site "Mayo Career Site US", logo design.mayoclinic.org'),
  ('co_26xdqfebxg468tn4', 'Marks & Spencer', 'fa-eqid-saasfaprod1: site "MS", logo corporate.marksandspencer.com'),
  ('co_ebj3btq82xvt5bbn', 'Majesco', 'fa-emad-saasfaprod1: site "Candidate Experience site", logo majesco.com'),
  ('co_grqa1sz8vfc3fkc6', 'Ma''aden', 'fa-epod-saasfaprod1: site "Candidate Experience site", logo maaden.com.sa'),
  ('co_c1petsjckheq8d00', 'IBS Software', 'fa-etbm-saasfaprod1: site "IBS Career Portal", logo careers.ibsplc.com IBS_Software'),
  ('co_gdxh75f13jdqh9ds', 'Community Health Systems', 'fa-evxo-saasfaprod1: site "CHS Career Site", logo chs.net'),
  ('co_egyt9efdmkra7avn', 'Baptist Memorial Health Care', 'fa-ewpe-saasfaprod1: site "Baptist", logo careers.baptistonline.org'),
  ('co_nnzz89www4sh4q6d', 'National Heritage Academies', 'fa-eotc-saasfaprod1: site "NHA" and role sites, logo nhaschoolsitesprod/nha'),
  ('co_z13a64ex1m9djhxm', 'Associated Wholesale Grocers', 'fa-etwq-saasfaprod1: site "AWG Career Site", tagline "Associated Wholesale Grocers - Retailer Owned"'),
  ('co_8qv33bhv132zgddk', 'University of Southern Denmark', 'fa-eosd-saasfaprod1: site "SDU Career Site", logo sdu.dk'),
  ('co_2dxmwafrw4rh2b6v', 'L&L Products', 'fa-eosa-saasfaprod1: site "LLP", logo llproducts.com'),
  ('co_dftffjayz6y3vwxx', 'Hillsborough County', 'fa-eqsg-saasfaprod1: site "BOCC Career Site", tagline "Working for Hillsborough County"'),
  ('co_7w979g6a3zkh017c', 'City of Oklahoma City', 'fa-etyr-saasfaprod1: sites "OKC", "OKC Police", "OKC Fire", City of Oklahoma City seal'),
  ('co_xxypfqr1n3gnnabr', 'Emirates NBD', 'fa-evlo-saasfaprod1: sites "ENBD Recruitment Team", "Emirate Islamic Bank Recruitment Team"'),
  ('co_hj2bz2k66mtv33am', 'The Guardian', 'fa-euxy-saasfaprod1: site "Guardian Careers", logo workforus.theguardian.com'),
  ('co_p23gwpsxqtkw3wb4', 'Boutique Group', 'fa-eute-saasfaprod1: site "Career.Boutiquegroup.com", logo boutiquegroup.com'),
  ('co_hdbhzjxn0hd3ta1x', 'Stamford Health', 'fa-ewfb-saasfaprod1: sites "Stamford Health", "Stamford Health Medical Group", "Providers"'),
  ('co_wqq8h1tt1rfqf9z9', 'Hexaware', 'fa-etqo-saasfaprod1: site "HEXAWARE", logo hexaware.com'),
  ('co_r629jdwjkn4cmtwf', 'Ichor', 'fa-eovh-saasfaprod1: site "ICHOR Candidate Experience", logo ichorsystems.com'),
  ('co_tya03sk0fdfca4zh', 'Eni', 'fa-evkm-saasfaprod1: site "EniJobs", image eni.com'),
  ('co_7e34qedwjdcybe9t', 'Fine Hygienic Holding', 'fa-emmq-saasfaprod1: site "FHH", logo finecareer fhh-logo'),
  ('co_c6fhgdm1985s3mfd', 'Brinker International', 'fa-etjg-saasfaprod1: sites "Chili''s", "Maggiano''s", "RSC" with logo brinkerjobs.com'),
  ('co_02pxm4m6d4mb5d3z', 'SVKM', 'fa-elxu-saasfaprod1: sites "SVKM''s ..." schools and colleges'),
  ('co_s7rzkpcje9pm4k6b', 'SVKM', 'fa-elxu-saasfaprod1 CX_1012: site "SVKM Central Office"'),
  ('co_s1d6d1yhez0jn4ee', 'GM Financial', 'fa-exvu-saasfaprod1 CX_1003: site "GM Financial IO"')
on conflict (company_id) do nothing;

-- The employer's website, so the logo matches the name.
insert into company_domain_override (company_id, domain, note) values
  ('co_cg5b0j5aeq3m1gcw', 'avient.com', 'fa-eqzh-saasfaprod1')
on conflict (company_id) do nothing;
