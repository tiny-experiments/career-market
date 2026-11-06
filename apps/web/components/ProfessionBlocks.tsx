import { formatDayShort } from '@cm/core/dates';
import type { CompanySignal, ProfessionPage } from '@cm/core/professions';
import type { Change } from '@cm/core/types';
import { Building2, CalendarDays, Globe, Layers, MapPin, Wallet } from 'lucide-react';
import Link from 'next/link';
import { ChangeText } from '@/components/ChangePill';
import { CompanyLogo } from '@/components/CompanyLogo';
import { Flag } from '@/components/Flag';
import { fmtInt, fmtPct } from '@/lib/format';
import { jobHref } from '@/lib/links';
import { logoUrl } from '@/lib/logo';

/** Compact money: 185000 -> "$185K". */
function money(n: number, currency: string): string {
  const sym = currency === 'USD' ? '$' : currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : `${currency} `;
  return n >= 1000 ? `${sym}${Math.round(n / 1000)}K` : `${sym}${Math.round(n)}`;
}

export function KeyStats({ page }: { page: ProfessionPage }) {
  const { salary, workMode } = page;
  return (
    <section aria-label={`${page.name} key figures`}>
      <div className="pf-stats">
      <div className="card pf-stat">
        <span className="stat-icon" aria-hidden="true">
          <Wallet size={20} />
        </span>
        <div>
          <p className="stat-label">Salary band (US, senior)</p>
          {salary.available ? (
            <p className="stat-value num" title={`Middle half of listed pay: ${salary.scope}. Midpoint of each posted range, in ${salary.currency}.`}>
              {money(salary.p25, salary.currency)} – {money(salary.p75, salary.currency)}
            </p>
          ) : (
            <>
              <p className="stat-value num">—</p>
              <p className="stat-sub">{salary.reason}</p>
            </>
          )}
        </div>
      </div>
      <div className="card pf-stat pf-stat-modes">
        <span className="stat-icon" aria-hidden="true">
          <MapPin size={20} />
        </span>
        {workMode ? (
          <dl className="pf-modes">
            <div>
              <dt>Remote</dt>
              <dd className="num">{fmtInt(workMode.remote)}</dd>
            </div>
            <div>
              <dt>Hybrid</dt>
              <dd className="num">{fmtInt(workMode.hybrid)}</dd>
            </div>
            <div>
              <dt>On-site</dt>
              <dd className="num">{fmtInt(workMode.onsite)}</dd>
            </div>
          </dl>
        ) : (
          <div>
            <p className="stat-label">Work mode</p>
            <p className="stat-value num">—</p>
          </div>
        )}
      </div>
      <div className="card pf-stat">
        <span className="stat-icon" aria-hidden="true">
          <CalendarDays size={20} />
        </span>
        <div>
          <p className="stat-label">Median days open</p>
          <p className="stat-value num" title="Median age of open roles in this profession, from their opened day">
            {page.medianDaysOpen === null ? '—' : fmtInt(page.medianDaysOpen)}
          </p>
        </div>
      </div>
      <div className="card pf-stat">
        <span className="stat-icon" aria-hidden="true">
          <Building2 size={20} />
        </span>
        <div>
          <p className="stat-label">Companies hiring</p>
          <p className="stat-value num" title="Companies with at least one open role in this profession">
            {page.companiesHiring === null ? '—' : fmtInt(page.companiesHiring)}
          </p>
        </div>
      </div>
      </div>
      <p className="footnote pf-stats-note">
        {salary.available
          ? `Salary band: middle half (p25–p75) of the pay midpoint in the ${fmtInt(salary.n)} newest US senior roles with listed pay (${salary.currency}).`
          : ''}
        {workMode ? ` Work mode is not stated for ${fmtInt(workMode.notStated)} of ${fmtInt(page.open)} roles.` : ''}
      </p>
    </section>
  );
}

/** Level segment colors, blue to purple, by rank (the legend names every segment). */
const SEGMENT_COLORS = ['#2563eb', '#3b82f6', '#4f9bff', '#79c3ff', '#8f8cf0', '#a07cf0', '#a96be0', '#8a4fd8', '#6f3fc0'];

export function SeniorityMix({ page }: { page: ProfessionPage }) {
  const { seniority } = page;
  const total = seniority.reduce((n, s) => n + s.open, 0);
  return (
    <section className="card pf-seniority" aria-labelledby="seniority-title">
      <h2 id="seniority-title" className="pf-card-title">
        Seniority mix
      </h2>
      {seniority.length === 0 ? (
        <p className="muted pf-empty">No seniority is stated for roles in this profession.</p>
      ) : (
        <>
          <div
            className="pf-stack"
            role="img"
            aria-label={`Seniority of ${fmtInt(total)} roles that state a level: ${seniority.map((s) => `${s.label} ${fmtInt(s.open)}`).join(', ')}`}
          >
            {seniority.map((s, i) => (
              <span key={s.id} style={{ flexGrow: s.open, background: SEGMENT_COLORS[i % SEGMENT_COLORS.length] }} />
            ))}
          </div>
          <ul className="pf-legend">
            {seniority.map((s, i) => (
              <li key={s.id}>
                <span className="pf-swatch" style={{ background: SEGMENT_COLORS[i % SEGMENT_COLORS.length] }} aria-hidden="true" />
                <span className="pf-legend-label">{s.label}</span>
                <span className="pf-legend-count num">{fmtInt(s.open)}</span>
                <span className="pf-legend-share num muted">({fmtPct(s.share)})</span>
              </li>
            ))}
          </ul>
          {page.seniorityNotStated > 0 && (
            <p className="footnote">Shares of the {fmtInt(total)} roles that state a level; {fmtInt(page.seniorityNotStated)} do not.</p>
          )}
        </>
      )}
    </section>
  );
}

export function TopCountries({ page }: { page: ProfessionPage }) {
  return (
    <section className="card pf-countries" aria-labelledby="countries-title">
      <h2 id="countries-title" className="pf-card-title">
        <Globe size={20} aria-hidden="true" /> Top countries
      </h2>
      <table className="pf-list">
        <caption className="sr-only">Countries with the most open {page.name} roles (first located country of each role)</caption>
        <tbody>
          {page.countries.map((c) => (
            <tr key={c.code}>
              <th scope="row">
                <Flag code={c.code} /> {c.name}
              </th>
              <td className="r num">{fmtInt(c.open)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {page.countriesNotLocated > 0 && <p className="footnote">{fmtInt(page.countriesNotLocated)} roles have no located country.</p>}
    </section>
  );
}

const SIGNAL_CLASS: Record<CompanySignal, string> = {
  HOT: 'sig-hot',
  STRONG: 'sig-strong',
  RISING: 'sig-rising',
  STEADY: 'sig-steady',
  COOLING: 'sig-cooling',
};

function SignalBadge({ signal }: { signal: CompanySignal | null }) {
  if (!signal) {
    return (
      <span className="muted" title="Needs a company change to compare">
        <span aria-hidden="true">—</span>
        <span className="sr-only">no signal yet</span>
      </span>
    );
  }
  return <span className={`signal ${SIGNAL_CLASS[signal]}`}>{signal}</span>;
}

function companyChangeNote(changes: (Change | null)[]): string | null {
  const c = changes.find((x) => x?.partial);
  return c ? `* Since ${formatDayShort(c.baseDate)}: fewer than 7 comparable days so far (2–3 Nov were krill's bootstrap days).` : null;
}

export function TopCompanies({ page }: { page: ProfessionPage }) {
  const list = page.topCompanies;
  return (
    <section className="card pf-companies" aria-labelledby="companies-title">
      <h2 id="companies-title" className="pf-card-title">
        <Building2 size={20} aria-hidden="true" /> Top hiring companies
      </h2>
      {'available' in list ? (
        <p className="empty-reason">
          <span className="badge-soon">Not yet</span>
          {list.reason}
        </p>
      ) : (
        <>
          <table className="table pf-table">
            <caption className="sr-only">Companies with the most open {page.name} roles</caption>
            <thead>
              <tr>
                <th scope="col">Company</th>
                <th scope="col" className="r">
                  Open {page.name} roles
                </th>
                <th scope="col" className="r">
                  1W change
                </th>
                <th scope="col">Signal</th>
              </tr>
            </thead>
            <tbody>
              {list.map((c) => (
                <tr key={c.id}>
                  <th scope="row">
                    <span className="pf-company">
                      <CompanyLogo name={c.name} src={logoUrl(c.domain)} />
                      {c.name}
                    </span>
                  </th>
                  <td className="r num">{fmtInt(c.open)}</td>
                  <td className="r">
                    {c.coverageJump ? (
                      <span className="chg chg-flat" title="krill's coverage of this company's boards changed this week, so the move in open roles says nothing about hiring">
                        <span aria-hidden="true">n/a</span>
                        <span className="sr-only">not shown: krill&apos;s coverage of this company changed</span>
                      </span>
                    ) : (
                      <ChangeText change={c.change} window="1W" />
                    )}
                  </td>
                  <td>
                    <SignalBadge signal={c.signal} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {companyChangeNote(list.map((c) => c.change)) && <p className="footnote">{companyChangeNote(list.map((c) => c.change))}</p>}
          {list.some((c) => c.coverageJump) && (
            <p className="footnote">n/a: open roles moved by more than half, which mostly means krill added or lost a board of that company.</p>
          )}
        </>
      )}
    </section>
  );
}

export function TopSkills({ page }: { page: ProfessionPage }) {
  return (
    <section className="card pf-skills" aria-labelledby="skills-title">
      <h2 id="skills-title" className="pf-card-title">
        <Layers size={20} aria-hidden="true" /> Top skills ({page.code})
      </h2>
      {page.skills.length === 0 ? (
        <p className="muted pf-empty">Skill counts appear after the first full build.</p>
      ) : (
        <ul className="pf-skill-grid">
          {page.skills.map((s) => (
            <li key={s.id}>
              <span className="pf-skill-name">{s.label}</span>
              <span className="pf-skill-count num">{fmtInt(s.open)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ageText(days: number): string {
  if (days <= 0) return 'today';
  return `${days}d ago`;
}

export function LatestRoles({ page }: { page: ProfessionPage }) {
  return (
    <section className="card pf-latest" aria-labelledby="latest-title">
      <div className="pf-latest-head">
        <h2 id="latest-title" className="pf-card-title">
          <Layers size={20} aria-hidden="true" /> Latest roles ({page.code})
        </h2>
        <Link href={`/screener?family=${encodeURIComponent(page.family)}`} className="link">
          See all {fmtInt(page.open)} in Screener <span aria-hidden="true">→</span>
        </Link>
      </div>
      {page.latestRoles.length === 0 ? (
        <p className="muted pf-empty">Latest roles appear after the first full build.</p>
      ) : (
        <table className="table pf-table pf-roles">
          <caption className="sr-only">Newest open {page.name} roles</caption>
          <thead>
            <tr>
              <th scope="col">Company</th>
              <th scope="col">Title</th>
              <th scope="col">Location</th>
              <th scope="col">Salary (USD)</th>
              <th scope="col">Age</th>
              <th scope="col">
                <span className="sr-only">Open role</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {page.latestRoles.map((r) => (
              <tr key={r.id}>
                <th scope="row">
                  <span className="pf-company">
                    <CompanyLogo name={r.company} src={logoUrl(r.companyDomain)} />
                    {r.company}
                  </span>
                </th>
                <td>{r.title}</td>
                <td className="pf-loc">
                  {r.location ? (
                    <>
                      <MapPin size={14} aria-hidden="true" /> {r.location}
                      {r.workMode ? <span className="muted"> ({r.workMode})</span> : null}
                    </>
                  ) : (
                    <span className="muted">Not stated</span>
                  )}
                </td>
                <td className="num">{r.salary ?? <span className="muted">Not listed</span>}</td>
                <td className="num muted" title={`Opened ${formatDayShort(r.openedOn)}`}>
                  {ageText(r.ageDays)}
                </td>
                <td className="r">
                  <Link prefetch={false} href={jobHref(r.id, r.title)} className="btn-view" aria-label={`View ${r.title} at ${r.company}`}>
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
