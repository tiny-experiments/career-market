import { companyDisplay, siteNameFor } from '@cm/core/companyName';
import type { Sql } from '@cm/core/db';
import { pickSiteName } from './siteNames.ts';

/**
 * Names every company from its hand-checked name, or else the name its careers site
 * states when the directory holds only that tenant's code (a site only confirms the
 * spelling of any other name), or else its directory name and
 * resolved domain, and copies the result to the tables that hold a company's name.
 * Runs after the domains are published, so a newly resolved site improves the name
 * at once. A site whose logo is only a placeholder still names the company: the
 * placeholder says nothing about whose site it is.
 */
export async function applyCompanyNames(tx: Sql): Promise<void> {
  const rows = await tx<
    {
      company_id: string;
      name: string;
      domain: string | null;
      checked: string | null;
      site_names: (string | null)[] | null;
      site_jobs: number[] | null;
      site_urls: string[] | null;
      display_name: string | null;
      named: boolean | null;
    }[]
  >`
    select c.company_id, c.name, coalesce(c.domain, d.domain) as domain, o.name as checked,
      s.site_names, s.site_jobs, s.site_urls, c.display_name, c.named
    from company c
    left join company_domain d using (company_id)
    left join company_name_override o using (company_id)
    left join (
      select company_id, array_agg(site_name) as site_names, array_agg(jobs) as site_jobs, array_agg(site_url) as site_urls
      from company_site_name where site_name is not null group by company_id
    ) s using (company_id)`;
  const changed = rows.flatMap((row) => {
    const urls = row.site_urls ?? [];
    const sites = (row.site_names ?? []).map((name, i) => ({ name, jobs: row.site_jobs?.[i] ?? 0, url: urls[i] }));
    const hosts = urls.map((url) => new URL(url).host);
    const display = companyDisplay(row.name, row.domain, row.checked, siteNameFor(row.name, hosts, pickSiteName(sites)));
    return display.name === row.display_name && display.named === row.named ? [] : [{ id: row.company_id, ...display }];
  });
  for (let i = 0; i < changed.length; i += 2000) {
    const batch = changed.slice(i, i + 2000);
    await tx`
      update company c set display_name = v.name, named = v.named
      from unnest(${tx.array(batch.map((r) => r.id))}::text[], ${tx.array(batch.map((r) => r.name))}::text[], ${tx.array(batch.map((r) => r.named))}::boolean[]) as v(id, name, named)
      where c.company_id = v.id`;
  }
  await tx`update company_ref t set name = c.display_name from company c where t.company_id = c.company_id and c.display_name is not null and t.name is distinct from c.display_name`;
  await tx`update screener_company t set name = c.display_name from company c where t.company_id = c.company_id and c.display_name is not null and t.name is distinct from c.display_name`;
  await tx`update profession_company t set name = c.display_name from company c where t.company_id = c.company_id and c.display_name is not null and t.name is distinct from c.display_name`;
  await tx`update profession_latest_role t set company_name = c.display_name from company c where t.company_id = c.company_id and c.display_name is not null and t.company_name is distinct from c.display_name`;
  await tx`update skill_latest_role t set company_name = c.display_name from company c where t.company_id = c.company_id and c.display_name is not null and t.company_name is distinct from c.display_name`;
  await tx`
    update search_entry t set label = c.display_name,
      keywords = case when position(lower(c.display_name) in t.keywords) > 0 then t.keywords else t.keywords || ' ' || lower(c.display_name) end
    from company c
    where t.kind = 'company' and t.id = c.company_id and c.display_name is not null and t.label is distinct from c.display_name`;
}
