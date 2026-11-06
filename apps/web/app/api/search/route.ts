import type { SearchHit } from '@cm/core/screener';
import { NextResponse } from 'next/server';
import { logoUrl } from '@/lib/logo';
import { getSearch } from '@/lib/readApi';

export const dynamic = 'force-dynamic';

export interface TypeaheadHit extends SearchHit {
  logo: string | null;
}
export interface TypeaheadResponse {
  query: string;
  groups: { kind: SearchHit['kind']; title: string; hits: TypeaheadHit[] }[];
}

/** Typeahead for the top nav. The browser calls this route; only this route calls the read API, with the token. */
export async function GET(request: Request) {
  const q = (new URL(request.url).searchParams.get('q') ?? '').slice(0, 160);
  if (q.trim() === '') return NextResponse.json({ query: '', groups: [] } satisfies TypeaheadResponse);
  const res = await getSearch(q, { limit: 5 });
  if (!res.ok) return NextResponse.json({ error: 'Search is not available right now' }, { status: 503 });
  const body: TypeaheadResponse = {
    query: res.data.query,
    groups: res.data.groups.map((g) => ({ ...g, hits: g.hits.map((h) => ({ ...h, logo: h.kind === 'company' ? logoUrl(h.domain) : null })) })),
  };
  return NextResponse.json(body, { headers: { 'cache-control': 'private, max-age=60' } });
}
