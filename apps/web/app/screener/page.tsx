import {
  parseScreenerQuery,
  screenerHref,
  SCREENER_MODES,
  type ScreenerMode,
  type ScreenerPayload,
} from '@cm/core/screener';
import { Laptop, Layers, Snowflake, Trophy, Zap } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ScreenerFilterBar } from '@/components/ScreenerFilterBar';
import { ScreenerJobs } from '@/components/ScreenerJobs';
import { ScreenerSummary } from '@/components/ScreenerSummary';
import { ScreenerTable } from '@/components/ScreenerTable';
import { logoUrl } from '@/lib/logo';
import { getScreener } from '@/lib/readApi';
import '@/styles/screener.css';

export const metadata: Metadata = {
  title: 'Screener',
  description: 'Filter tech hiring like a stock screener: professions, companies and skills by region, work mode, seniority, pay and posting age.',
};

const MODE_LABEL: Record<ScreenerMode, string> = { companies: 'Companies', professions: 'Professions', skills: 'Skills' };

type SearchParams = Record<string, string | string[] | undefined>;

export default async function ScreenerPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const query = parseScreenerQuery(params);
  // Normalised query string: unknown or malformed parameters never reach the read API.
  const qs = screenerHref(query).split('?')[1] ?? '';
  const res = await getScreener(qs);
  if (!res.ok) return <Unavailable status={res.status} />;
  const data = res.data;

  const logos: Record<string, string | null> = {};
  if (data.mode === 'companies') for (const r of data.rows) logos[r.id] = logoUrl(r.domain);
  if (data.jobs.available) for (const j of data.jobs.jobs) logos[j.company.id] = logoUrl(j.company.domain);

  const keep: Record<string, string> = {};
  if (query.sort !== 'open') keep.sort = query.sort;
  if (query.dir === 'asc') keep.dir = 'asc';
  if (query.jobSort !== 'newest') keep.jobs = query.jobSort;

  return (
    <div className="screener">
      <section className="scr-head" aria-labelledby="scr-title">
        <div className="scr-title-block">
          <p className="eyebrow scr-eyebrow">{MODE_LABEL[data.mode]} screener</p>
          <h1 id="scr-title" className="scr-title">
            Screener
          </h1>
        </div>
        <ScreenerFilterBar mode={data.mode} filters={data.filters} options={data.options} keep={keep} />
        <div className="scr-subrow">
          <Presets data={data} />
          <nav className="mode-toggle" aria-label="Screener mode">
            {SCREENER_MODES.map((m) => (
              <Link
                key={m}
                href={screenerHref({ mode: m, filters: data.filters })}
                className={m === data.mode ? 'is-active' : undefined}
                aria-current={m === data.mode ? 'page' : undefined}
              >
                {MODE_LABEL[m]}
              </Link>
            ))}
          </nav>
        </div>
      </section>

      <ScreenerTable data={data} logos={logos} jobSort={query.jobSort} />
      <ScreenerSummary summary={data.summary} growthOn={data.filters.growth !== null} />
      <ScreenerJobs data={data} logos={logos} />
    </div>
  );
}

function Presets({ data }: { data: ScreenerPayload }) {
  const f = data.filters;
  const only = (keys: (keyof typeof f)[]) => Object.entries(f).every(([k, v]) => (keys.includes(k as keyof typeof f) ? v !== null : v === null));
  const presets = [
    {
      label: 'Fastest growing',
      icon: <Zap size={16} aria-hidden="true" />,
      href: screenerHref({ mode: 'companies', sort: 'change1w' }),
      active: data.mode === 'companies' && data.sort === 'change1w' && data.dir === 'desc' && only([]),
    },
    {
      label: 'Freezing now',
      icon: <Snowflake size={16} aria-hidden="true" />,
      href: screenerHref({ mode: 'companies', filters: { growth: 'freezing' }, sort: 'change1w', dir: 'asc' }),
      active: data.mode === 'companies' && f.growth === 'freezing' && only(['growth']),
    },
    {
      label: 'Remote-friendly',
      icon: <Laptop size={16} aria-hidden="true" />,
      href: screenerHref({ mode: data.mode, filters: { workMode: 'remote' } }),
      active: f.workMode === 'remote' && only(['workMode']),
    },
    {
      label: 'AI-heavy stacks',
      icon: <Layers size={16} aria-hidden="true" />,
      href: screenerHref({ mode: data.mode, filters: { family: 'ai-ml' } }),
      active: f.family === 'ai-ml' && only(['family']),
    },
    {
      label: 'Best paid (US)',
      icon: <Trophy size={16} aria-hidden="true" />,
      href: screenerHref({ mode: data.mode, filters: { country: 'US', salary: { currency: 'USD', min: 200_000 } }, jobSort: 'salary' }),
      active: f.country === 'US' && f.salary?.currency === 'USD' && f.salary.min === 200_000 && only(['country', 'salary']),
    },
  ];
  return (
    <ul className="presets" aria-label="Presets">
      {presets.map((p) => (
        <li key={p.label}>
          <Link href={p.href} className={`preset${p.active ? ' is-active' : ''}`} aria-current={p.active ? 'true' : undefined} scroll={false}>
            {p.icon}
            {p.label}
          </Link>
        </li>
      ))}
    </ul>
  );
}

function Unavailable({ status }: { status: number | null }) {
  return (
    <section className="card unavailable" aria-labelledby="unavailable-title">
      <h1 id="unavailable-title">The Screener is not available right now</h1>
      <p className="muted">
        {status === 503
          ? 'The nightly build has not finished its first run yet. Data appears after the first build.'
          : 'The read model did not answer. Try again in a few minutes.'}
      </p>
    </section>
  );
}
