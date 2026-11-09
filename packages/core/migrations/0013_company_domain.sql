-- First-party website domains for company logos. `company.domain` stays the one column
-- every reader uses; the resolver owns it. What the directory supplied moves to
-- `company.directory_domain`, one of the resolver's inputs.
alter table company add column directory_domain text;
update company set directory_domain = domain;

-- Hand corrections, editable at any time; they win over every other source.
-- A null domain is a deliberate monogram: no paid lookup is made for that company.
create table company_domain_override (
  company_id text primary key,
  domain     text check (domain is null or domain = lower(domain)),
  note       text not null default '',
  updated_at timestamptz not null default now()
);

-- One row per company the resolver has seen.
create table company_domain (
  company_id       text primary key,
  domain           text,                 -- registrable first-party domain; null when none is known
  source           text not null check (source in ('manual', 'directory', 'careers', 'brand', 'none')),
  name_checked     text,                 -- the company name the last paid lookup used
  brand_checked_at timestamptz,          -- last paid lookup; also counts credits spent per day
  logo             text check (logo in ('real', 'monogram')),  -- what the logo service holds for the domain
  logo_checked_at  timestamptz,
  checked_at       timestamptz not null default now()
);
create index company_domain_brand_checked_idx on company_domain (brand_checked_at);
create index company_domain_logo_checked_idx on company_domain (logo_checked_at);
