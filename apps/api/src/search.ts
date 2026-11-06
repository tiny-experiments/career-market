import { addDays } from '@cm/core/dates';
import type { Sql } from '@cm/core/db';
import {
  companyHref,
  professionHref,
  skillHref,
  slugify,
  type RoleHit,
  type SearchHit,
  type SearchKind,
  type SearchResults,
} from '@cm/core/screener';
import { z } from 'zod';
import { KrillLive } from './krillLive.ts';
import { latestBuild, NotReadyError } from './readModel.ts';

const TITLES: Record<SearchKind, string> = { profession: 'Professions', company: 'Companies', skill: 'Skills' };
const KIND_ORDER: SearchKind[] = ['profession', 'company', 'skill'];

export const MAX_QUERY_LENGTH = 80;
/** Longest the typeahead waits for krill's company name search. */
const LIVE_WAIT_MS = 1_200;

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('timeout')), ms);
  });
  p.catch(() => undefined); // a late failure of the abandoned call is not an unhandled rejection
  return Promise.race([p, timeout]).finally(() => clearTimeout(timer));
}

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
    return sp ? `${professionHref(e.slug)}?specialty=${encodeURIComponent(sp)}` : professionHref(e.slug);
  }
  return e.kind === 'company' ? companyHref(e.slug) : skillHref(e.slug);
}

const liveCompaniesSchema = z.object({
  items: z.array(z.object({ id: z.string(), name: z.string(), domain: z.string().nullable().optional(), openJobs: z.number().int() })),
});
const liveRolesSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      company: z.object({ id: z.string(), name: z.string() }),
      url: z.string(),
      applyUrl: z.string().nullable(),
      locations: z.array(z.string()),
    }),
  ),
});

/** Typeahead over professions, companies and skills; ranked exact, prefix, word prefix, then contains, then by open roles. */
export async function search(sql: Sql, live: KrillLive, rawQuery: string, perGroup: number): Promise<SearchResults> {
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
      from search_entry
      where as_of = ${build.asOf}
        and (lower(label) like ${`%${esc}%`} escape '\\' or keywords like ${`%${esc}%`} escape '\\')
    ) ranked where rank <= ${perGroup}
    order by kind, rank`;

  const hits = new Map<SearchKind, SearchHit[]>(KIND_ORDER.map((k) => [k, []]));
  for (const r of rows) {
    hits.get(r.kind)?.push({ kind: r.kind, id: r.id, label: r.label, sublabel: r.sublabel, href: hrefOf(r), open: r.open, domain: r.domain });
  }

  // Companies beyond the largest ones the read model lists come from krill's name search (cached).
  const companyHits = hits.get('company') as SearchHit[];
  if (companyHits.length < perGroup && q.length >= 2) {
    try {
      // The typeahead never waits on krill for long: the read-model hits answer first.
      const page = await withTimeout(live.get('/v1/companies', { q: query, sort: 'openJobs', pageSize: perGroup }, liveCompaniesSchema), LIVE_WAIT_MS);
      const have = new Set(companyHits.map((h) => h.id));
      for (const c of page.items) {
        if (have.has(c.id) || companyHits.length >= perGroup || c.openJobs <= 0) continue;
        companyHits.push({ kind: 'company', id: c.id, label: c.name, sublabel: null, href: companyHref(slugify(c.name) || c.id), open: c.openJobs, domain: c.domain ?? null });
      }
    } catch {
      // krill busy or down: the read-model hits stand alone.
    }
  }

  return {
    query,
    groups: KIND_ORDER.map((kind) => ({ kind, title: TITLES[kind], hits: hits.get(kind) ?? [] })).filter((g) => g.hits.length > 0),
  };
}

/** Roles whose title or text matches, from krill (used by the full search page only). */
export async function searchRoles(sql: Sql, live: KrillLive, rawQuery: string, limit: number): Promise<RoleHit[]> {
  const build = await latestBuild(sql);
  if (!build) throw new NotReadyError();
  const query = rawQuery.trim().replace(/\s+/g, ' ').slice(0, MAX_QUERY_LENGTH);
  if (query.length < 2) return [];
  const page = await live.get('/v1/jobs', { q: query, sort: 'opened', pageSize: limit, openedSince: addDays(build.asOf, -60) }, liveRolesSchema);
  return page.items.map((j) => ({ id: j.id, title: j.title, company: j.company.name, location: j.locations[0] ?? null, url: j.applyUrl ?? j.url }));
}
