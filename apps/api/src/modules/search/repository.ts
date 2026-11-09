import type { Queries as Sql } from '../../database/client.ts';
import {
  companyHref,
  professionHref,
  skillHref,
  type SearchHit,
  type SearchKind,
  type SearchResults,
} from '@cm/core/screener';
import { latestBuild, NotReadyError } from '../../database/readModel.ts';

const TITLES: Record<SearchKind, string> = {
  profession: 'Professions',
  company: 'Companies',
  skill: 'Skills',
};
const KIND_ORDER: SearchKind[] = ['profession', 'company', 'skill'];

export const MAX_QUERY_LENGTH = 80;
/** Escapes LIKE wildcards so user text always matches literally. */
export function likeEscape(text: string): string {
  return text.replace(/[\\%_]/g, (c) => `\\${c}`);
}

interface EntryRow {
  kind: SearchKind;
  id: string;
  slug: string;
  label: string;
  sublabel: string | null;
  open: number;
  domain: string | null;
}

export function hrefOf(e: Pick<EntryRow, 'kind' | 'id' | 'slug'>): string {
  if (e.kind === 'profession') {
    const sp = e.id.includes('/') ? e.id.slice(e.id.indexOf('/') + 1) : null;
    return sp
      ? `${professionHref(e.slug)}?specialty=${encodeURIComponent(sp)}`
      : professionHref(e.slug);
  }
  return e.kind === 'company' ? companyHref(e.slug) : skillHref(e.slug);
}

/** Typeahead over professions, companies and skills; ranked exact, prefix, word prefix, then contains, then by open roles. */
export async function search(
  sql: Sql,
  rawQuery: string,
  perGroup: number,
): Promise<SearchResults> {
  const build = await latestBuild(sql);
  if (!build) throw new NotReadyError();
  const query = rawQuery.trim().replace(/\s+/g, ' ').slice(0, MAX_QUERY_LENGTH);
  if (query.length === 0) return { query, groups: [] };
  const q = query.toLowerCase();
  const esc = likeEscape(q);
  const rows = await sql<EntryRow[]>`
    select kind, id, slug, label, sublabel, open, domain from (
      select kind, id, slug, label, sublabel, open, domain,
        row_number() over (
          partition by kind
          order by
            case
              when lower(label) = ${q} then 0
              when lower(label) like ${`${esc}%`} escape '\\' then 1
              when lower(label) like ${`% ${esc}%`} escape '\\' then 2
              when keywords like ${`${esc}%`} escape '\\' or keywords like ${`% ${esc}%`} escape '\\' then 2
              else 3
            end,
            open desc, label
        ) as rank
      from (
        select kind, id, slug, label, sublabel, open, domain, keywords
        from search_entry where as_of = ${build.asOf} and kind <> 'company'
        union all
        select 'company' as kind, company_id as id, slug, name as label, null as sublabel, open, domain,
          lower(name || ' ' || slug) as keywords
        from company where updated_on = ${build.asOf}
      ) entries
      where true
        and (lower(label) like ${`%${esc}%`} escape '\\' or keywords like ${`%${esc}%`} escape '\\')
    ) ranked where rank <= ${perGroup}
    order by kind, rank`;

  const hits = new Map<SearchKind, SearchHit[]>(KIND_ORDER.map((k) => [k, []]));
  for (const r of rows) {
    hits
      .get(r.kind)
      ?.push({
        kind: r.kind,
        id: r.id,
        label: r.label,
        sublabel: r.sublabel,
        href: hrefOf(r),
        open: r.open,
        domain: r.domain,
      });
  }

  return {
    query,
    groups: KIND_ORDER.map((kind) => ({
      kind,
      title: TITLES[kind],
      hits: hits.get(kind) ?? [],
    })).filter((g) => g.hits.length > 0),
  };
}
