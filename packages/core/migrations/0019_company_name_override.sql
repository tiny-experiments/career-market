-- Hand-checked names for large employers whose directory name is a hiring-platform tenant
-- ("Eeho", "Fa Ewjt Saasfaprod1") or a lowercase account slug ("endeavoritsolution").
-- Each name is what the company's own careers page or job postings call it; the note says
-- what the directory held. They win over every other source. Edit this table freely; the
-- worker reads it each run.
create table company_name_override (
  company_id text primary key,
  name       text not null check (btrim(name) <> ''),
  note       text not null default '',
  updated_at timestamptz not null default now()
);

insert into company_name_override (company_id, name, note) values
  ('co_0xp45a8c6svd38ey', 'Oracle', 'Eeho'),
  ('co_davdzdkgd3152kpp', 'Endeavor IT Solution', 'endeavoritsolution'),
  ('co_7gg7xxcmazckyrwa', 'Fortinet', 'Edel'),
  ('co_a51agsfjwv2vem1b', 'Sonsoft', 'sonsoftinc'),
  ('co_9r5qfmvmc1j5aes6', 'onsemi', 'Hctz'),
  ('co_ft1fs6stjn1kew6p', 'EXL', 'Fa Ewjt Saasfaprod1'),
  ('co_radz95vrs647zkkt', 'Photon', 'Fa Ertb Saasfaprod1'),
  ('co_aj7n9r1fknbj932p', 'Ford BlueOval City', 'efds'),
  ('co_jsyx984hwbccgym7', 'WSP', 'emit'),
  ('co_cb28rfr260dw828y', 'SAIC', 'eihu'),
  ('co_zq1q49trtp96jwej', 'BIP Consulting', 'Fa Etjb Saasfaprod1'),
  ('co_yghxvz29mncmeg7b', 'Texas Instruments', 'Edbz'),
  ('co_kq8rybvcw80vxew3', '360 IT Professionals', '360itprofessionals1'),
  ('co_gbyh8dqj9ws4djfz', 'Nokia', 'fa-evmr-saasfaprod1'),
  ('co_cknrmdx8vv19afj4', 'Honeywell Aerospace', 'Icfcjb'),
  ('co_a41fxqc597tmrvrt', 'Cummins', 'Fa Espx Saasfaprod1'),
  ('co_zpadyqch54xsw7k6', 'Raydar', 'raydar'),
  ('co_0c462ps62aspn96s', 'Artech Information System', 'artechinformationsystemllc'),
  ('co_rckdw1tkavpnbzxp', 'Honeywell', 'ibqbjb'),
  ('co_cav1eszt6r8wzs4h', 'Tata Capital', 'Eofh'),
  ('co_v4wzxejwwrb4ma92', 'Atria Group', 'atriagroupllc'),
  ('co_k68gnbdp6e5fcb8t', 'Akamai', 'Fa Extu Saasfaprod1'),
  ('co_4s216hyky4hmd2kn', 'Dell', 'Iawmqy'),
  ('co_2sagp0cfhg68heaa', 'Uber', 'iaziqy'),
  ('co_t14erqtrjn54mybb', 'USM', 'USM')
on conflict (company_id) do nothing;

-- Their websites, where the brand is unmistakable, so the logo matches the name.
insert into company_domain_override (company_id, domain, note) values
  ('co_0xp45a8c6svd38ey', 'oracle.com', 'Eeho'),
  ('co_7gg7xxcmazckyrwa', 'fortinet.com', 'Edel'),
  ('co_9r5qfmvmc1j5aes6', 'onsemi.com', 'Hctz'),
  ('co_ft1fs6stjn1kew6p', 'exlservice.com', 'Fa Ewjt Saasfaprod1'),
  ('co_aj7n9r1fknbj932p', 'ford.com', 'efds'),
  ('co_jsyx984hwbccgym7', 'wsp.com', 'emit'),
  ('co_cb28rfr260dw828y', 'saic.com', 'eihu'),
  ('co_yghxvz29mncmeg7b', 'ti.com', 'Edbz'),
  ('co_gbyh8dqj9ws4djfz', 'nokia.com', 'fa-evmr-saasfaprod1'),
  ('co_cknrmdx8vv19afj4', 'honeywell.com', 'Icfcjb'),
  ('co_a41fxqc597tmrvrt', 'cummins.com', 'Fa Espx Saasfaprod1'),
  ('co_rckdw1tkavpnbzxp', 'honeywell.com', 'ibqbjb'),
  ('co_cav1eszt6r8wzs4h', 'tatacapital.com', 'Eofh'),
  ('co_k68gnbdp6e5fcb8t', 'akamai.com', 'Fa Extu Saasfaprod1'),
  ('co_4s216hyky4hmd2kn', 'dell.com', 'Iawmqy'),
  ('co_2sagp0cfhg68heaa', 'uber.com', 'iaziqy')
on conflict (company_id) do nothing;
