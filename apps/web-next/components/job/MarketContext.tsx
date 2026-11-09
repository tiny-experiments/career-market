import { CalendarDays, ChevronRight, CircleCheck, Info, Layers, TriangleAlert, TrendingUp, Users, Building2 } from 'lucide-react';
import Link from 'next/link';
import type { CompanyTrend, JobContext, JobPosting, ProfessionTrend, SalaryBand, SimilarRole } from '@cm/core/job';
import { formatDayShort } from '@cm/core/dates';
import { formatMoney, formatMoneyShort } from '@cm/core/job';
import type { Unavailable } from '@cm/core/types';
import { ChangePill } from '@/components/ChangePill';
import { fmtInt } from '@/lib/format';
import { companyHref, jobHref, professionHref } from '@/lib/links';
import { AreaSpark } from './AreaSpark';
import { CompanyLogo } from './CompanyLogo';

type Logos = (domain: string | null) => string | null;

/** The right column: how this posting sits in the market. Every panel says plainly when its data is not there yet. */
export function MarketContext({ job, context, logo }: { job: JobPosting; context: JobContext; logo: Logos }) {
  return (
    <aside className="card ctx" aria-labelledby="ctx-title">
      <h2 id="ctx-title" className="ctx-title">
        Market context
      </h2>
      <DaysOpen job={job} />
      <Health health={context.health} />
      <SalaryVsBand band={context.salaryBand} />
      <div className="ctx-pair">
        <CompanyTrendCard company={job.company} trend={context.companyTrend} />
        <ProfessionTrendCard trend={context.professionTrend} />
      </div>
      <SimilarRoles similar={context.similar} logo={logo} />
    </aside>
  );
}

function Tip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <span className="info" tabIndex={0} role="note" aria-label={label}>
      <Info size={15} aria-hidden="true" />
      <span className="info-tip">{children}</span>
    </span>
  );
}

function Unavail({ reason }: { reason: string }) {
  return <p className="ctx-empty">{reason}</p>;
}

// ---------- Days open ----------

function DaysOpen({ job }: { job: JobPosting }) {
  const age = job.ageDays;
  const stale = job.staleScore === null ? null : Math.min(1, Math.max(0, job.staleScore));
  const tone = stale === null ? 'none' : stale < 0.6 ? 'fresh' : stale < 0.85 ? 'aging' : 'stale';
  return (
    <section className="ctx-tile days" aria-label="Days open">
      <span className="ctx-icon" aria-hidden="true">
        <CalendarDays size={20} />
      </span>
      <div className="days-text">
        <p className="ctx-label">Days open</p>
        <p className="days-value">
          {age === null ? '—' : age}
          {age === null ? '' : age === 1 ? ' day' : ' days'}
        </p>
      </div>
      {stale !== null && (
        <div className="gauge" role="img" aria-label={`Freshness: ${Math.round(stale * 100)} out of 100 on the scale from fresh to stale`}>
          <div className="gauge-labels" aria-hidden="true">
            <span>Fresh</span>
            <span>Stale</span>
          </div>
          <div className="gauge-track" aria-hidden="true">
            <span className={`gauge-fill gauge-${tone}`} style={{ width: `${stale * 100}%` }} />
            <span className="gauge-knob" style={{ left: `${stale * 100}%` }} />
          </div>
        </div>
      )}
    </section>
  );
}

// ---------- Posting health ----------

function Health({ health }: { health: JobContext['health'] }) {
  const ghost = health.state === 'ghost';
  return (
    <section className={`ctx-tile health ${ghost ? 'health-ghost' : 'health-active'}`} aria-label="Posting health">
      <span className="health-icon" aria-hidden="true">
        {ghost ? <TriangleAlert size={22} /> : <CircleCheck size={24} />}
      </span>
      <div>
        <p className="health-title">{health.headline}</p>
        <p className="health-detail">{health.detail}</p>
      </div>
    </section>
  );
}

// ---------- Salary vs. band ----------

function SalaryVsBand({ band }: { band: SalaryBand | Unavailable }) {
  const tip = (
    <Tip label="How the salary band is made">
      {'available' in band && band.available === true ? band.basis : 'The band is the middle half of listed pay for similar roles in the US.'} It is listed pay, not a
      forecast, and many employers list none.
    </Tip>
  );
  if (!('midpoint' in band)) {
    return (
      <section className="ctx-tile salary" aria-labelledby="salary-title">
        <h3 id="salary-title" className="ctx-label ctx-label-row">
          <Layers size={19} aria-hidden="true" /> Salary vs. band {tip}
        </h3>
        <Unavail reason={band.reason} />
      </section>
    );
  }
  const pct = band.position * 100;
  return (
    <section className="ctx-tile salary" aria-labelledby="salary-title">
      <h3 id="salary-title" className="ctx-label ctx-label-row">
        <Layers size={19} aria-hidden="true" /> Salary vs. band {tip}
      </h3>
      <p className="salary-mid num">{formatMoney(band.midpoint, band.currency)}</p>
      <p className="salary-verdict-wrap">
        <span className={`salary-verdict salary-${band.verdict.replace(/\s+/g, '-')}`}>{band.verdict}</span>
      </p>
      <div
        className="band"
        role="img"
        aria-label={`Pay midpoint ${formatMoney(band.midpoint, band.currency)} is ${band.verdict}. Market band ${formatMoney(band.p25, band.currency)} to ${formatMoney(band.p75, band.currency)}, median ${formatMoney(band.p50, band.currency)}, from ${band.n} roles.`}
      >
        <span className="band-track" aria-hidden="true" />
        <span className="band-knob" aria-hidden="true" style={{ left: `${pct}%` }} />
      </div>
      <div className="band-ends num" aria-hidden="true">
        <span>{formatMoneyShort(band.p25, band.currency)}</span>
        <span>{formatMoneyShort(band.p75, band.currency)}</span>
      </div>
    </section>
  );
}

// ---------- Company and profession trend ----------

function CompanyTrendCard({ company, trend }: { company: JobPosting['company']; trend: CompanyTrend | Unavailable }) {
  return (
    <section className="ctx-tile trend" aria-labelledby="co-trend-title">
      <h3 id="co-trend-title" className="ctx-label ctx-label-row">
        <Building2 size={19} aria-hidden="true" /> Company trend
      </h3>
      <p className="trend-name">
        <Link href={companyHref(company.id)}>{company.name}</Link>
      </p>
      {'open' in trend ? (
        <>
          <div className="trend-row">
            <p className="trend-count">
              <span className="num">{fmtInt(trend.open)}</span> open
            </p>
            {trend.signal ? (
              <span className={`signal signal-${trend.signal.toLowerCase()}`}>{trend.signal}</span>
            ) : (
              <span className="signal signal-none" title={trend.signalNote ?? undefined}>
                No signal yet
                <span className="sr-only">. {trend.signalNote}</span>
              </span>
            )}
          </div>
          <AreaSpark values={trend.spark} label={`${company.name} open roles`} tone="blue" id="spark-company" />
        </>
      ) : (
        <Unavail reason={trend.reason} />
      )}
    </section>
  );
}

function ProfessionTrendCard({ trend }: { trend: ProfessionTrend | Unavailable }) {
  return (
    <section className="ctx-tile trend" aria-labelledby="pro-trend-title">
      <h3 id="pro-trend-title" className="ctx-label ctx-label-row">
        <TrendingUp size={19} aria-hidden="true" /> Profession trend
      </h3>
      {'code' in trend ? (
        <>
          <p className="trend-name">{trend.code}</p>
          <div className="trend-row">
            <p className="trend-count">
              <span className="num">{fmtInt(trend.open)}</span>
            </p>
            <ChangePill change={trend.change} window="1W" emptyTitle="Change appears after a week of comparable days" />
          </div>
          <AreaSpark values={trend.spark} label={`${trend.name} open roles`} tone="green" id="spark-profession" />
          <Link href={professionHref(trend.code)} className="link trend-link">
            View {trend.code} profession page <span aria-hidden="true">→</span>
          </Link>
          {trend.change && (trend.change.partial || trend.change.estimated) && (
            <p className="footnote">
              {trend.change.partial
                ? `* Since ${formatDayShort(trend.change.baseDate)}: fewer than 7 comparable days so far (2–3 Nov were krill's bootstrap days).`
                : '* Estimated: the base day comes from the back-cast.'}
            </p>
          )}
        </>
      ) : (
        <Unavail reason={trend.reason} />
      )}
    </section>
  );
}

// ---------- Similar roles ----------

function SimilarRoles({ similar, logo }: { similar: JobContext['similar']; logo: Logos }) {
  return (
    <section className="ctx-tile similar" aria-labelledby="similar-title">
      <h3 id="similar-title" className="similar-title">
        <Users size={19} aria-hidden="true" /> Similar roles
      </h3>
      {'roles' in similar ? (
        <ul className="similar-list">
          {similar.roles.map((r) => (
            <SimilarRow key={r.id} role={r} logoSrc={logo(r.company.domain)} />
          ))}
        </ul>
      ) : (
        <Unavail reason={similar.reason} />
      )}
    </section>
  );
}

function SimilarRow({ role, logoSrc }: { role: SimilarRole; logoSrc: string | null }) {
  const meta = [role.company.name, role.location, role.salaryLabel].filter(Boolean);
  return (
    <li>
      <Link href={jobHref(role.id, role.title)} className="similar-row">
        <CompanyLogo name={role.company.name} src={logoSrc} size="md" />
        <span className="similar-main">
          <span className="similar-role">{role.title}</span>
          <span className="similar-meta">{meta.join(' · ')}</span>
        </span>
        <ChevronRight size={18} aria-hidden="true" className="similar-chev" />
      </Link>
    </li>
  );
}
