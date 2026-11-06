import { ExternalLink } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { CompanyLogo } from '@/components/CompanyLogo';
import { fmtInt } from '@/lib/format';
import { logoUrl } from '@/lib/logo';
import { getSearch } from '@/lib/readApi';
import '@/styles/screener.css';
import '@/styles/search.css';

export const metadata: Metadata = { title: 'Search' };

export default async function SearchPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const raw = (await searchParams).q;
  const q = (Array.isArray(raw) ? raw[0] : raw)?.trim().slice(0, 160) ?? '';
  if (q === '') {
    return (
      <section className="search-page">
        <h1>Search</h1>
        <p className="muted">Type a profession, company, skill or role in the search box above.</p>
      </section>
    );
  }
  const res = await getSearch(q, { limit: 10, roles: true });
  if (!res.ok) {
    return (
      <section className="search-page">
        <h1>Search</h1>
        <p className="card unavailable">Search is not available right now. Try again in a few minutes.</p>
      </section>
    );
  }
  const { groups, roles, rolesUnavailable } = res.data;
  const none = groups.length === 0 && roles.length === 0;
  return (
    <section className="search-page" aria-labelledby="search-title">
      <h1 id="search-title">Results for “{q}”</h1>
      {none && <p className="card unavailable muted">No profession, company, skill or role matches “{q}”.</p>}
      {groups.map((g) => (
        <div key={g.kind} className="card result-group">
          <h2>{g.title}</h2>
          <ul className="result-list">
            {g.hits.map((h) => (
              <li key={`${h.kind}-${h.id}`}>
                {h.kind === 'company' && <CompanyLogo name={h.label} src={logoUrl(h.domain)} size={22} />}
                <Link href={h.href}>{h.label}</Link>
                {h.sublabel && <span className="muted">{h.sublabel}</span>}
                <span className="result-meta num">{fmtInt(h.open)} {h.kind === 'skill' ? 'roles' : 'open'}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
      {(roles.length > 0 || rolesUnavailable) && (
        <div className="card result-group">
          <h2>Roles</h2>
          {rolesUnavailable ? (
            <p className="muted">Roles could not be searched right now.</p>
          ) : (
            <ul className="result-list">
              {roles.map((r) => (
                <li key={r.id}>
                  <Link href={`/job/${r.id}/${r.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'role'}`}>{r.title}</Link>
                  <span className="muted">{r.company}</span>
                  <span className="result-meta">
                    {r.location ?? ''}{' '}
                    <a href={r.url} target="_blank" rel="noopener noreferrer" aria-label={`Open ${r.title} on the employer's site (new tab)`}>
                      <ExternalLink size={14} aria-hidden="true" />
                    </a>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
