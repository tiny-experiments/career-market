import { formatDayShort } from '@cm/core/dates';
import type { Change, MarketOverview } from '@cm/core/types';
import { BarChart3, Building2, CalendarDays, Info, MinusCircle, Plus, Snowflake, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { ChangePill, ChangeText } from '@/components/ChangePill';
import { CompanyLogo } from '@/components/CompanyLogo';
import { Flag } from '@/components/Flag';
import { OpenRolesChart } from '@/components/OpenRolesChart';
import { Sparkline } from '@/components/Sparkline';
import { WorldMap } from '@/components/WorldMap';
import { fmtInt, fmtPct } from '@/lib/format';
import { logoUrl } from '@/lib/logo';
import { getMarketOverview } from '@/lib/readApi';
import './companies/company.css';

export default async function MarketPage() {
  const res = await getMarketOverview();
  if (!res.ok) {
    return <ReadModelUnavailable status={res.status} />;
  }
  return <MarketOverviewView data={res.data} />;
}

function ReadModelUnavailable({ status }: { status: number | null }) {
  return (
    <section className="card unavailable" aria-labelledby="unavailable-title">
      <h1 id="unavailable-title">Market data is not available right now</h1>
      <p className="muted">
        {status === 503
          ? 'The nightly build has not finished its first run yet. Data appears after the first build.'
          : 'The read model did not answer. Try again in a few minutes.'}
      </p>
    </section>
  );
}

function footnoteFor(changes: (Change | null)[]): string | null {
  const c = changes.find((x) => x && (x.partial || x.estimated));
  if (!c) return null;
  if (c.partial) return `* Since ${formatDayShort(c.baseDate)}: fewer than 7 comparable days so far (2–3 Nov were krill's bootstrap days).`;
  return '* Estimated: the base day comes from the back-cast.';
}

function MarketOverviewView({ data }: { data: MarketOverview }) {
  const top = data.countries.slice(0, 6);
  const maxShare = Math.max(0.0001, ...top.map((c) => c.share));
  const movingNote = footnoteFor(data.professionsGaining.map((p) => p.change));
  const rampingNote = data.companiesRamping.available ? footnoteFor(data.companiesRamping.rows.map((c) => c.change)) : null;
  const skillsNote = data.hottestSkills.some((s) => s.change) ? footnoteFor(data.hottestSkills.map((s) => s.change)) : null;

  return (
    <div className="market">
      {/* 1. Headline index */}
      <section className="hero" aria-labelledby="index-title">
        <div className="hero-left">
          <p className="eyebrow">Market overview</p>
          <h1 id="index-title" className="hero-title">
            Tech Hiring Index
          </h1>
          <p className="hero-number num">{fmtInt(data.headline.open)}</p>
          <p className="hero-unit">open roles</p>
          <ChangePill change={data.headline.change} window="this week" size="lg" showWindow />
        </div>
        <div className="hero-chart">
          <OpenRolesChart series={data.series} firstObservedDay={data.firstObservedDay} />
          <p className="chart-note">{data.backcast.note}</p>
        </div>
      </section>

      {/* 2. Stat row */}
      <section className="stats" aria-label="Today's market">
        <Stat icon={<Building2 size={20} />} label="Companies hiring" value={data.stats.companies} title="Companies with at least one open tech role" />
        <Stat icon={<Plus size={20} />} label="New roles today" value={data.stats.newToday} title="Roles whose opened day is today: the posted day when the employer gives one, else the day krill first saw them" />
        <Stat icon={<MinusCircle size={20} />} label="Closed today" value={data.stats.closedToday} title="Closings krill detected today" />
        <Stat
          icon={<CalendarDays size={20} />}
          label="Median days open"
          value={data.stats.medianDaysOpen === null ? null : Math.round(data.stats.medianDaysOpen)}
          title="Median age of open tech roles, from their opened day"
        />
      </section>

      <div className="market-grid">
        {/* 3. What's moving */}
        <section className="card moving" aria-labelledby="moving-title">
          <h2 id="moving-title" className="card-title">
            What&apos;s moving
          </h2>
          <div className="moving-cols">
            <div className="moving-col">
              <h3 className="moving-tab is-active">
                <TrendingUp size={16} aria-hidden="true" /> Professions gaining
              </h3>
              <table className="table">
                <caption className="sr-only">Professions with the largest one-week change in open roles</caption>
                <thead>
                  <tr>
                    <th scope="col">Profession</th>
                    <th scope="col" className="r">
                      Open roles
                    </th>
                    <th scope="col" className="r">
                      Change (7D)
                    </th>
                    <th scope="col">
                      <span className="sr-only">Trend</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.professionsGaining.map((p) => (
                    <tr key={p.family}>
                      <th scope="row" title={p.code}>
                        {p.name}
                      </th>
                      <td className="r num">{fmtInt(p.open)}</td>
                      <td className="r">
                        <ChangeText change={p.change} window="7D" />
                      </td>
                      <td className="spark-cell">
                        <Sparkline values={p.spark} label={`${p.name} open roles`} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {movingNote && <p className="footnote">{movingNote}</p>}
            </div>
            <div className="moving-col">
              <h3 className="moving-tab">
                <Building2 size={16} aria-hidden="true" /> Companies ramping
              </h3>
              {data.companiesRamping.available ? (
                <>
                  <table className="table">
                    <caption className="sr-only">Companies with the largest one-week change in open roles</caption>
                    <thead>
                      <tr>
                        <th scope="col">Company</th>
                        <th scope="col" className="r">
                          Open roles
                        </th>
                        <th scope="col" className="r">
                          Change (7D)
                        </th>
                        <th scope="col">
                          <span className="sr-only">Trend</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.companiesRamping.rows.map((c) => (
                        <tr key={c.slug}>
                          <th scope="row">
                            <Link href={`/companies/${c.slug}`} className="co-name-cell">
                              <CompanyLogo name={c.name} src={logoUrl(c.domain)} size={22} />
                              {c.name}
                            </Link>
                          </th>
                          <td className="r num">{fmtInt(c.open)}</td>
                          <td className="r">
                            <ChangeText change={c.change} window="7D" />
                          </td>
                          <td className="spark-cell">
                            <Sparkline values={c.spark} label={`${c.name} open roles`} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {rampingNote && <p className="footnote">{rampingNote}</p>}
                </>
              ) : (
                <EmptyTable cols={['Company', 'Open roles', 'Change (7D)']} reason={data.companiesRamping.reason} />
              )}
            </div>
            <div className="moving-col">
              <h3 className="moving-tab">
                <Snowflake size={16} aria-hidden="true" /> Biggest freezes
              </h3>
              <EmptyTable cols={['Company', 'Open roles', 'Change (7D)']} reason={data.biggestFreezes.reason} />
            </div>
          </div>
        </section>

        {/* 4. Market themes */}
        <section className="card themes" aria-labelledby="themes-title">
          <h2 id="themes-title" className="card-title">
            Market themes
          </h2>
          <h3 className="sub-title">
            Hottest skills
            <span className="info" tabIndex={0} role="note" aria-label="About hottest skills">
              <Info size={14} aria-hidden="true" />
              <span className="info-tip">
                The tools and languages named in the most open tech roles. Changes compare skill share on matched boards and
                appear once Career Market has a week of daily skill counts.
              </span>
            </span>
          </h3>
          <ul className="skill-grid">
            {data.hottestSkills.map((s) => (
              <li key={s.id} className="skill-tile">
                <span className="skill-name">{s.label}</span>
                <span className="skill-count num">{fmtInt(s.open)}</span>
                <ChangePill change={s.change} window="7D" emptyTitle="Change appears after a week of daily skill counts" />
              </li>
            ))}
          </ul>
          {skillsNote && <p className="footnote">{skillsNote}</p>}
          <div className="notes">
            <h3 className="notes-title">
              <BarChart3 size={18} aria-hidden="true" /> State of tech hiring
            </h3>
            <ul>
              {data.notes.map((n) => (
                <li key={n.rule}>{n.text}</li>
              ))}
            </ul>
            <Link href="/report" className="link">
              Read the weekly report <span aria-hidden="true">→</span>
            </Link>
          </div>
        </section>

        {/* 5. Where the jobs are */}
        <section className="card where" aria-labelledby="where-title">
          <h2 id="where-title" className="card-title">
            Where the jobs are
          </h2>
          <div className="where-body">
            <WorldMap rows={data.countries} highlight={6} />
            <table className="table where-table">
              <caption className="sr-only">Countries with the most open tech roles (first located country of each role)</caption>
              <thead>
                <tr>
                  <th scope="col">#</th>
                  <th scope="col">Location</th>
                  <th scope="col" className="r">
                    Open roles
                  </th>
                  <th scope="col">
                    <span className="sr-only">Share bar</span>
                  </th>
                  <th scope="col" className="r">
                    <span className="sr-only">Share of all open roles</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {top.map((c, i) => (
                  <tr key={c.code}>
                    <td className="muted num">{i + 1}</td>
                    <th scope="row">
                      <Flag code={c.code} /> {c.name}
                    </th>
                    <td className="r num">{fmtInt(c.open)}</td>
                    <td className="bar-cell" aria-hidden="true">
                      <span className="share-bar">
                        <span style={{ width: `${(c.share / maxShare) * 100}%` }} />
                      </span>
                    </td>
                    <td className="r num muted">{fmtPct(c.share)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}

function Stat({ icon, label, value, title }: { icon: React.ReactNode; label: string; value: number | null; title: string }) {
  return (
    <div className="card stat" title={title}>
      <span className="stat-icon" aria-hidden="true">
        {icon}
      </span>
      <div>
        <p className="stat-label">{label}</p>
        <p className="stat-value num">{value === null ? '—' : fmtInt(value)}</p>
      </div>
    </div>
  );
}

function EmptyTable({ cols, reason }: { cols: string[]; reason: string }) {
  return (
    <div className="empty-table">
      <div className="table-head" aria-hidden="true">
        {cols.map((c) => (
          <span key={c}>{c}</span>
        ))}
      </div>
      <p className="empty-reason">
        <span className="badge-soon">Coming soon</span>
        {reason}
      </p>
    </div>
  );
}
