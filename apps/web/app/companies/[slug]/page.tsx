import { SENIOR_PLUS, type CompanyJob, type CompanyJobsPayload, type CompanyPage, type CompanySignalState, type CountValue } from '@cm/core/company';
import { formatDayShort } from '@cm/core/dates';
import type { Change } from '@cm/core/types';
import {
  Boxes,
  Cloud,
  CalendarDays,
  Code2,
  Laptop,
  MapPin,
  MinusCircle,
  Plus,
  Snowflake,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ChangePill, ChangeText } from '@/components/ChangePill';
import { CompanyLogo } from '@/components/CompanyLogo';
import { Flag } from '@/components/Flag';
import { HiringTrendChart } from '@/components/HiringTrendChart';
import { RoleFilters } from '@/components/RoleFilters';
import { SeniorityDonut } from '@/components/SeniorityDonut';
import { Sparkline } from '@/components/Sparkline';
import { WorldMap } from '@/components/WorldMap';
import { fmtInt } from '@/lib/format';
import { logoUrl } from '@/lib/logo';
import { getCompany, getCompanyJobs } from '@/lib/readApi';
import '../company.css';

type Params = { slug: string };
type Search = { profession?: string; country?: string; remote?: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const res = await getCompany(slug);
  return { title: res.ok ? res.data.company.name : 'Company' };
}

export default async function CompanyPageRoute({ params, searchParams }: { params: Promise<Params>; searchParams: Promise<Search> }) {
  const { slug } = await params;
  const search = await searchParams;
  const res = await getCompany(slug);
  if (!res.ok) {
    if (res.status === 404) notFound();
    return (
      <section className="card unavailable" aria-labelledby="unavailable-title">
        <h1 id="unavailable-title">Company data is not available right now</h1>
        <p className="muted">
          {res.status === 503
            ? 'The nightly build has not finished its first run yet. Data appears after the first build.'
            : 'The read model did not answer. Try again in a few minutes.'}
        </p>
      </section>
    );
  }
  // Other pages link a company by its krill id; send those visitors to the slug URL.
  if (/^co_[0-9a-z]{16}$/.test(slug)) {
    const q = new URLSearchParams(search as Record<string, string>).toString();
    redirect(`/companies/${res.data.company.slug}${q ? `?${q}` : ''}`);
  }
  const filter = {
    profession: typeof search.profession === 'string' ? search.profession : '',
    country: typeof search.country === 'string' ? search.country : '',
    remote: search.remote === '1',
  };
  const jobs = await getCompanyJobs(slug, { profession: filter.profession || undefined, country: filter.country || undefined, remote: filter.remote });
  return <CompanyView data={res.data} jobs={jobs.ok ? jobs.data : { available: false, reason: 'The role list did not answer. Try again in a few minutes.' }} filter={filter} />;
}

const SIGNAL_META: Record<CompanySignalState, { label: string; tone: string; Icon: typeof TrendingUp; what: string }> = {
  RAMPING: { label: 'Ramping', tone: 'up', Icon: TrendingUp, what: 'is ramping up: open roles are growing and openings outpace closings' },
  STEADY: { label: 'Steady', tone: 'flat', Icon: TrendingUp, what: 'is steady: open roles are not moving much' },
  COOLING: { label: 'Cooling', tone: 'warn', Icon: TrendingDown, what: 'is cooling: closings outpace openings' },
  FREEZING: { label: 'Freezing', tone: 'down', Icon: Snowflake, what: 'is freezing: open roles are falling fast as closings far outpace openings' },
};

function changeNote(changes: (Change | null)[]): string | null {
  const c = changes.find((x) => x && (x.partial || x.estimated));
  if (!c) return null;
  if (c.partial) return `* Since ${formatDayShort(c.baseDate)}: fewer than 30 comparable days so far (2–3 Nov were krill's bootstrap days).`;
  return '* Estimated: the base day comes from the back-cast.';
}

function CompanyView({ data, jobs, filter }: { data: CompanyPage; jobs: CompanyJobsPayload; filter: { profession: string; country: string; remote: boolean } }) {
  const { company, signal } = data;
  const logo = logoUrl(company.domain);
  const meta = signal ? SIGNAL_META[signal.state] : null;
  const windowLabel = signal?.partial ? `since ${formatDayShort(signal.windowFrom)}` : '30D';
  const teamsNote = changeNote(data.teams.map((t) => t.change));
  const profile = 'available' in data.profile ? null : data.profile;

  return (
    <div className="co">
      <nav aria-label="Breadcrumb" className="co-crumbs">
        <ol>
          <li>
            <Link href="/">Market</Link>
          </li>
          <li>
            <Link href="/companies">Companies</Link>
          </li>
          <li aria-current="page">{company.name}</li>
        </ol>
      </nav>

      <div className="co-top">
        {/* 1. Header */}
        <header className="co-head">
          <div className="co-logo-card">
            <CompanyLogo name={company.name} src={logo} size={88} />
          </div>
          <div className="co-head-body">
            <h1 className="co-name">{company.name}</h1>
            <p className="co-open">
              <span className="co-open-n num">{fmtInt(company.open)}</span> <span className="co-open-u">open tech roles</span>
            </p>
            <div className="co-badges">
              {meta ? (
                <span className={`co-state co-state-${meta.tone}`} title={`${company.name} ${meta.what}`}>
                  <meta.Icon size={14} aria-hidden="true" />
                  <span aria-hidden="true">{meta.label.toUpperCase()}</span>
                  <span className="sr-only">{`${company.name} ${meta.what}`}</span>
                </span>
              ) : (
                <span className="co-state co-state-flat" title="A signal needs comparable days">
                  <span aria-hidden="true">NO SIGNAL YET</span>
                  <span className="sr-only">No hiring signal yet: not enough comparable days</span>
                </span>
              )}
              <ChangePill change={signal?.change ?? null} window="30D" size="lg" showWindow emptyLabel="— (30D)" emptyTitle="The 30-day change appears after enough comparable days" />
            </div>
            {company.careersUrl && (
              <a className="co-careers" href={company.careersUrl} target="_blank" rel="noopener noreferrer">
                Careers site <span aria-hidden="true">↗</span>
                <span className="sr-only"> (opens the employer&apos;s site in a new tab)</span>
              </a>
            )}
          </div>
        </header>

        {/* 2. Hiring trend */}
        <section className="card co-trend" aria-labelledby="trend-title">
          <HiringTrendChart series={data.series} companyName={company.name} />
          <span id="trend-title" className="sr-only">
            Hiring trend
          </span>
        </section>

        {/* 3. Signal explainer */}
        <aside className="co-explain" aria-label="Hiring signal">
          <span className="co-explain-icon" aria-hidden="true">
            <TrendingUp size={22} />
          </span>
          <p className="co-explain-text">{data.explainer}</p>
          {signal?.partial && (
            <p className="co-explain-note">Only {signal.windowDays} comparable day{signal.windowDays === 1 ? '' : 's'} of history so far.</p>
          )}
        </aside>

        {/* Stat tiles */}
        <section className="co-stats" aria-label="Flow of roles">
          <Stat
            icon={<Plus size={20} />}
            label={`New roles (${windowLabel})`}
            value={data.flow?.opened ?? null}
            title="Roles krill first saw during the window. Krill's bootstrap days and a company's first board fetch are left out."
          />
          <Stat icon={<MinusCircle size={20} />} label={`Closed roles (${windowLabel})`} value={data.flow?.closed ?? null} title="Roles krill saw disappear during the window" />
          <Stat
            icon={<CalendarDays size={20} />}
            label="Median days open"
            value={profile?.medianDaysOpen == null ? null : Math.round(profile.medianDaysOpen)}
            title="Median age of this company's open roles, from their opened day (estimated from age cuts)"
            emptyNote={profile ? 'Not estimated yet' : 'Not profiled'}
          />
        </section>
      </div>

      <div className="co-row co-row-2">
        {/* 4. Growing teams */}
        <section className="card co-card" aria-labelledby="teams-title">
          <h2 id="teams-title" className="co-card-title">
            Growing teams
          </h2>
          {data.teams.length > 0 ? (
            <>
              <table className="table co-teams">
                <caption className="sr-only">Professions with the most open roles at {company.name}, with their 30-day change</caption>
                <thead>
                  <tr>
                    <th scope="col">Profession</th>
                    <th scope="col" className="r">
                      Open roles
                    </th>
                    <th scope="col" className="r">
                      30D change
                    </th>
                    <th scope="col">
                      <span className="sr-only">Trend</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.teams.map((t) => (
                    <tr key={t.family}>
                      <th scope="row">{t.name}</th>
                      <td className="r num">{fmtInt(t.open)}</td>
                      <td className="r">
                        <ChangeText change={t.change} window="30D" />
                      </td>
                      <td className="spark-cell">
                        <Sparkline values={t.spark} width={96} height={24} label={`${t.name} open roles`} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {teamsNote && <p className="footnote">{teamsNote}</p>}
            </>
          ) : (
            <Empty reason="Team history is kept for the largest companies by open roles. This company is not profiled yet." />
          )}
        </section>

        {/* 5. Tech stack profile */}
        <section className="card co-card" aria-labelledby="stack-title">
          <h2 id="stack-title" className="co-card-title">
            Tech stack profile
          </h2>
          {profile ? (
            <div className="co-stack">
              {profile.stack.map((g) => (
                <section key={g.id} className="co-stack-group" aria-label={g.label}>
                  <h3 className="co-stack-head">
                    <StackIcon id={g.id} /> {g.label}
                  </h3>
                  {g.items.length > 0 ? (
                    <ul>
                      {g.items.map((s) => (
                        <li key={s.value}>
                          <span className="co-chip" aria-hidden="true">
                            {monogram(s.label)}
                          </span>
                          <span className="co-stack-name">{s.label}</span>
                          <span className="co-stack-n num">{fmtInt(s.count)}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="muted co-none">None named</p>
                  )}
                </section>
              ))}
            </div>
          ) : (
            <Empty reason={'available' in data.profile ? data.profile.reason : ''} />
          )}
        </section>
      </div>

      <div className="co-row co-row-3">
        {/* 6. Locations */}
        <section className="card co-card" aria-labelledby="loc-title">
          <div className="co-card-head">
            <h2 id="loc-title" className="co-card-title">
              Locations
            </h2>
            {profile?.remote != null && (
              <p className="co-remote">
                <Laptop size={15} aria-hidden="true" /> <span className="num">{fmtInt(profile.remote)}</span> remote
              </p>
            )}
          </div>
          {profile && profile.countries.length > 0 ? (
            <div className="co-where">
              <WorldMap
                rows={profile.countries.map((c) => ({ code: c.code, name: c.label, open: c.count, share: c.count / profile.total }))}
                highlight={5}
              />
              <table className="table co-where-table">
                <caption className="sr-only">Countries with the most open roles at {company.name} (a role can name more than one country)</caption>
                <thead>
                  <tr>
                    <th scope="col">#</th>
                    <th scope="col">Location</th>
                    <th scope="col" className="r">
                      Open roles
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {profile.countries.slice(0, 6).map((c, i) => (
                    <tr key={c.code}>
                      <td className="muted num">{i + 1}</td>
                      <th scope="row">
                        <Flag code={c.code} /> {c.label}
                      </th>
                      <td className="r num">{fmtInt(c.count)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty reason={profile ? 'krill placed none of these roles in a country.' : 'Locations are kept for the largest companies by open roles. This company is not profiled yet.'} />
          )}
        </section>

        {/* 7. Seniority mix */}
        <section className="card co-card" aria-labelledby="sen-title">
          <h2 id="sen-title" className="co-card-title">
            Seniority mix
          </h2>
          {profile && profile.levels.length > 0 ? (
            <div className="co-seniority">
              <SeniorityDonut levels={profile.levels} seniorPlus={seniorPlus(profile.levels)} />
              <table className="co-legend-table">
                <caption className="sr-only">Open roles by level</caption>
                <tbody>
                  {profile.levels.map((l) => (
                    <tr key={l.value}>
                      <th scope="row">
                        <span className="co-lv" style={{ background: `var(--lv-${l.value})` }} aria-hidden="true" /> {l.label}
                      </th>
                      <td className="r num">{fmtInt(l.count)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty reason={profile ? 'krill could not read a level for these roles.' : 'Seniority is kept for the largest companies by open roles. This company is not profiled yet.'} />
          )}
        </section>

        {/* 8. Current roles */}
        <section className="card co-card" aria-labelledby="roles-title">
          <div className="co-card-head">
            <h2 id="roles-title" className="co-card-title">
              Current roles
            </h2>
            <RoleFilters
              professions={data.roleFilters.professions}
              countries={data.roleFilters.countries}
              remoteCount={data.roleFilters.remote}
              value={filter}
            />
          </div>
          <CurrentRoles jobs={jobs} company={company.name} />
        </section>
      </div>

      {/* 9. Peers: not in v1, kept in the mockup position as a labelled coming-soon state */}
      <section className="card co-peers" aria-labelledby="peers-title">
        <div className="co-peers-head">
          <h2 id="peers-title" className="co-peers-title">
            Peers
          </h2>
          <p className="muted">Similar companies in tech hiring</p>
        </div>
        <p className="empty-reason co-peers-empty">
          <span className="badge-soon">Coming soon</span>
          {data.peers.reason}
        </p>
      </section>
    </div>
  );
}

function seniorPlus(levels: CountValue[]): number {
  return levels.filter((l) => SENIOR_PLUS.has(l.value)).reduce((n, l) => n + l.count, 0);
}

function monogram(label: string): string {
  const letters = label.replace(/[^A-Za-z0-9+#]/g, '');
  return letters.slice(0, label.includes('++') ? 3 : 2) || '·';
}

function StackIcon({ id }: { id: string }) {
  const props = { size: 16, 'aria-hidden': true } as const;
  if (id === 'languages') return <Code2 {...props} />;
  if (id === 'domains') return <Boxes {...props} />;
  if (id === 'platform') return <Cloud {...props} />;
  return <Sparkles {...props} />;
}

function Stat({
  icon,
  label,
  value,
  title,
  emptyNote = 'Not available yet',
}: {
  icon: React.ReactNode;
  label: string;
  value: number | null;
  title: string;
  emptyNote?: string;
}) {
  return (
    <div className="card stat" title={title}>
      <span className="stat-icon" aria-hidden="true">
        {icon}
      </span>
      <div>
        <p className="stat-label">{label}</p>
        <p className="stat-value num">{value === null ? '—' : fmtInt(value)}</p>
        {value === null && <p className="co-stat-note">{emptyNote}</p>}
      </div>
    </div>
  );
}

function Empty({ reason }: { reason: string }) {
  return (
    <p className="empty-reason co-empty">
      <span className="badge-soon">Not available yet</span>
      {reason}
    </p>
  );
}

const MODE_LABEL = { remote: 'Remote', hybrid: 'Hybrid', onsite: 'On-site' } as const;

function CurrentRoles({ jobs, company }: { jobs: CompanyJobsPayload; company: string }) {
  if (!jobs.available) return <Empty reason={jobs.reason} />;
  if (jobs.items.length === 0) return <p className="muted co-none">No open roles match these filters.</p>;
  return (
    <>
      <ul className="co-roles" aria-label={`Current roles at ${company}`}>
        {jobs.items.map((j) => (
          <Role key={j.id} job={j} />
        ))}
      </ul>
      <p className="footnote">
        Showing the {jobs.items.length} newest of {fmtInt(jobs.total)} matching roles, read live from krill. Applications happen on the employer&apos;s site.
      </p>
    </>
  );
}

function Role({ job }: { job: CompanyJob }) {
  return (
    <li className="co-role">
      <a className="co-role-title" href={job.url} target="_blank" rel="noopener noreferrer">
        {job.title}
        <span className="sr-only"> (opens the employer&apos;s posting in a new tab)</span>
      </a>
      <span className="co-role-team">{job.team ?? (job.level ? `${job.level.charAt(0).toUpperCase()}${job.level.slice(1)} level` : '')}</span>
      <span className="co-role-loc">
        <MapPin size={13} aria-hidden="true" /> {job.location}
      </span>
      {job.workMode ? <span className={`co-mode co-mode-${job.workMode}`}>{MODE_LABEL[job.workMode]}</span> : <span />}
    </li>
  );
}
