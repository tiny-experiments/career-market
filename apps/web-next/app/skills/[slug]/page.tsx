import { formatDayLong, formatDayShort } from '@cm/core/dates';
import { companyHref, skillHref } from '@cm/core/screener';
import { skillNamespace, type SkillPagePayload } from '@cm/core/skills';
import type { Change } from '@cm/core/types';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BrandMark } from '@/components/BrandMark';
import { SkillDemandChart } from '@/components/SkillDemandChart';
import { changeSentence, fmtInt, fmtPct, isUp } from '@/lib/format';
import { jobHref } from '@/lib/links';
import { logoSrc } from '@/lib/logos';
import { getSkillPage } from '@/lib/readApi';
import '../skills.css';

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const res = await getSkillPage(slug);
  return { title: res.ok ? `${res.data.label} skill` : 'Skill' };
}

export default async function SkillPage({ params }: { params: Params }) {
  const { slug } = await params;
  const res = await getSkillPage(slug);
  if (!res.ok) {
    if (res.status === 404) notFound();
    return (
      <section className="card unavailable" aria-labelledby="unavailable-title">
        <h1 id="unavailable-title">Skill data is not available right now</h1>
        <p className="muted">
          {res.status === 503
            ? 'The nightly build has not finished its first run yet. Data appears after the first build.'
            : 'The read model did not answer. Try again in a few minutes.'}
        </p>
      </section>
    );
  }
  return <SkillView data={res.data} />;
}

function SkillView({ data }: { data: SkillPagePayload }) {
  const { label, primary } = data;
  const maxPeer = Math.max(1, ...data.peers.map((p) => p.open));
  const footnote = changeFootnote([data.change, ...data.companies.map((c) => c.change), ...data.pairs.map((p) => p.change)]);
  const namespace = skillNamespace(data.id);

  return (
    <div className="skill">
      {/* 1. Header and demand chart */}
      <section className="skill-hero" aria-labelledby="skill-title">
        <div className="skill-hero-left">
          <nav aria-label="Breadcrumb" className="crumbs">
            <ol>
              <li>
                <Link href="/">Market</Link>
              </li>
              <li>
                <Link href="/skills">Skills</Link>
              </li>
              <li aria-current="page">{label}</li>
            </ol>
          </nav>
          <div className="skill-title-row">
            <BrandMark src={logoSrc(data.domain)} name={label} size={46} kind="skill" namespace={namespace} />
            <h1 id="skill-title" className="skill-title">
              {label}
            </h1>
            <span className="tag">{data.category}</span>
          </div>
          <p className="skill-number">
            <span className="num skill-number-value">{fmtInt(primary.open)}</span>
            <span className="skill-number-unit">{primary.name} roles</span>
          </p>
          <MonthPill change={data.change} />
          {data.stale && (
            <p className="muted">
              Numbers as of <time dateTime={data.asOf}>{formatDayLong(data.asOf)}</time>: the latest build could not read this skill.
            </p>
          )}
        </div>
        <div className="skill-hero-chart">
          <SkillDemandChart
            series={data.series}
            firstObservedDay={data.firstObservedDay}
            skillLabel={label}
            scopeLabel={primary.name}
            note={data.seriesNote}
          />
        </div>
      </section>

      {/* 2. Share, professions, companies */}
      <div className="skill-row skill-row-3">
        <section className="card skill-card" aria-labelledby="share-title">
          <h2 id="share-title" className="skill-card-title">
            Named in <span className="accent num">{fmtPct(primary.share, 0)}</span> of {primary.name} roles
          </h2>
          <ul className="compare" aria-label={`Roles naming each skill in ${primary.name}`}>
            {data.peers.map((p) => (
              <li key={p.id} className={p.self ? 'is-self' : ''}>
                <BrandMark src={logoSrc(p.domain)} name={p.label} size={26} kind="skill" namespace={skillNamespace(p.id)} />
                <span className="compare-name">{p.slug && !p.self ? <Link href={`/skills/${p.slug}`}>{p.label}</Link> : p.label}</span>
                <span className="num compare-count">{fmtInt(p.open)}</span>
                <span className="compare-bar" aria-hidden="true">
                  <span style={{ width: `${(p.open / maxPeer) * 100}%` }} />
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="card skill-card" aria-labelledby="professions-title">
          <h2 id="professions-title" className="skill-card-title">
            Professions that want it
          </h2>
          <ol className="ranked">
            {data.professions.map((p, i) => (
              <li key={p.family}>
                <span className="muted num ranked-i">{i + 1}.</span>
                <span className="ranked-name" title={`${fmtInt(p.open)} roles`}>
                  {p.name}
                </span>
                <span className="ranked-bar" aria-hidden="true">
                  <span style={{ width: `${Math.max(2, p.share * 100)}%` }} />
                </span>
                <span className="num ranked-pct">{fmtPct(p.share)}</span>
              </li>
            ))}
          </ol>
        </section>

        <section className="card skill-card" aria-labelledby="companies-title">
          <h2 id="companies-title" className="skill-card-title">
            Companies that want it
          </h2>
          {data.companies.length === 0 ? (
            <p className="empty-note">No companies yet: the next build fills this table.</p>
          ) : (
            <table className="table skill-table">
              <caption className="sr-only">Companies with the most open roles naming {label}</caption>
              <thead>
                <tr>
                  <th scope="col">Company</th>
                  <th scope="col" className="r">
                    Roles naming {label}
                  </th>
                  <th scope="col" className="r">
                    1M change
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.companies.map((c) => (
                  <tr key={c.id}>
                    <th scope="row">
                      <span className="company-cell">
                        <BrandMark src={logoSrc(c.domain)} name={c.name} size={20} />
                        <Link href={`/companies/${c.id}`} className="plain-link">
                          {c.name}
                        </Link>
                      </span>
                    </th>
                    <td className="r num">{fmtInt(c.open)}</td>
                    <td className="r">
                      <MiniPill
                        change={c.change}
                        emptyTitle="The 1M change appears once Career Market holds a month of company counts for this skill"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>

      {/* 3. Often paired with, salary effect */}
      <div className="skill-row skill-row-2">
        <section className="card skill-card" aria-labelledby="paired-title">
          <h2 id="paired-title" className="skill-card-title">
            Often paired with
            <span className="info" tabIndex={0} role="note" aria-label="About paired skills">
              <span aria-hidden="true">i</span>
              <span className="info-tip">
                Skills named in the same roles as {label}: the share is the part of the {fmtInt(data.totalOpen)} open roles naming {label} that
                also name the other skill. The change compares that count on matched boards and appears after a month of daily counts.
              </span>
            </span>
          </h2>
          {data.pairs.length === 0 ? (
            <p className="empty-note">No paired skills yet: the next build fills this list.</p>
          ) : (
            <ul className="pairs">
              {data.pairs.map((p) => (
                <li key={p.id} className="pair">
                  <BrandMark src={logoSrc(p.domain)} name={p.label} size={30} kind="skill" namespace={skillNamespace(p.id)} />
                  <div className="pair-text">
                    <p className="pair-name">{p.slug ? <Link href={`/skills/${p.slug}`}>{p.label}</Link> : p.label}</p>
                    <p className="pair-share num">{fmtPct(p.share, 0)} of roles</p>
                  </div>
                  <MiniPill change={p.change} emptyTitle="The change appears once Career Market holds a month of daily counts for this pair" />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card skill-card salary" aria-labelledby="salary-title">
          <h2 id="salary-title" className="skill-card-title">
            Salary effect
            <span className="info" tabIndex={0} role="note" aria-label="About the salary effect">
              <span aria-hidden="true">i</span>
              <span className="info-tip">
                Listed pay only, and a correlation, not a cause: median of the pay-range midpoints of roles that name {label} against other
                roles in the same profession. {data.salaryEffect.available ? data.salaryEffect.scope : 'Shown where both sides have enough roles with listed pay.'}
              </span>
            </span>
          </h2>
          {data.salaryEffect.available ? (
            <SalaryEffect data={data} />
          ) : (
            <>
              <p className="salary-line">Roles naming {label} list a median</p>
              <p className="salary-big salary-big-empty" aria-label="not enough listed pay yet">
                —
              </p>
              <p className="salary-line muted">{data.salaryEffect.reason}</p>
            </>
          )}
        </section>
      </div>

      {/* 4. Latest roles */}
      <section className="card skill-card latest" aria-labelledby="latest-title">
        <h2 id="latest-title" className="skill-card-title">
          Latest roles naming {label}
        </h2>
        {data.latestRoles.length === 0 ? (
          <p className="empty-note">No roles listed yet: the next build fills this table.</p>
        ) : (
          <table className="table skill-table latest-table">
            <caption className="sr-only">The newest open roles naming {label}</caption>
            <thead>
              <tr>
                <th scope="col">Company</th>
                <th scope="col">Role</th>
                <th scope="col">Location</th>
                <th scope="col">Salary</th>
                <th scope="col">Age</th>
                <th scope="col">
                  <span className="sr-only">Open the role</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {data.latestRoles.map((r) => (
                <tr key={r.id}>
                  <th scope="row">
                    <span className="company-cell">
                      <BrandMark src={logoSrc(r.company.domain)} name={r.company.name} size={20} />
                      <Link href={`/companies/${r.company.id}`} className="plain-link">
                        {r.company.name}
                      </Link>
                    </span>
                  </th>
                  <td>{r.title}</td>
                  <td className="loc">{r.location ?? <span className="muted">—</span>}</td>
                  <td className="num">{r.salary ? salaryRange(r.salary) : <span className="muted">—</span>}</td>
                  <td className="num age">{ageLabel(r.ageDays)}</td>
                  <td className="r">
                    <Link href={jobHref(r.id, r.title)} className="view-btn" aria-label={`View ${r.title} at ${r.company.name}`}>
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {footnote && <p className="footnote skill-footnote">{footnote}</p>}
    </div>
  );
}

function SalaryEffect({ data }: { data: SkillPagePayload }) {
  const fx = data.salaryEffect;
  if (!fx.available) return null;
  const k = Math.round(Math.abs(fx.delta) / 1000);
  const sym = currencySymbol(fx.currency);
  const same = k === 0;
  return (
    <>
      <p className="salary-line">Roles naming {data.label} list a median</p>
      <p className={`salary-big${same ? ' is-flat' : fx.delta < 0 ? ' is-down' : ''}`}>
        {same ? 'about the same' : `${sym}${k}K ${fx.delta > 0 ? 'higher' : 'lower'}`}
      </p>
      <p className="salary-line">than {fx.familyName} roles without it.</p>
      <p className="salary-sub num">
        Median {sym}
        {fmtInt(fx.medianWith / 1000)}K against {sym}
        {fmtInt(fx.medianWithout / 1000)}K · {fmtInt(fx.nWith)} and {fmtInt(fx.nWithout)} roles
      </p>
    </>
  );
}

/** "▲ 5.2% (1M)" beside the headline number. */
function MonthPill({ change }: { change: Change | null }) {
  if (!change) {
    return (
      <span className="pill pill-lg pill-flat" title="The 1M change appears once a base day exists">
        <span aria-hidden="true">— (1M)</span>
        <span className="sr-only">no 1M change yet</span>
      </span>
    );
  }
  const up = isUp(change);
  const mark = change.partial || change.estimated ? '*' : '';
  const sentence = changeSentence(change, 'over 1 month');
  return (
    <span className={`pill pill-lg ${up ? 'pill-up' : 'pill-down'}`} title={sentence}>
      <span aria-hidden="true">
        {up ? '▲' : '▼'} {fmtPct(change.value)}
        {mark} ({change.partial ? `since ${formatDayShort(change.baseDate)}` : '1M'})
      </span>
      <span className="sr-only">{sentence}</span>
    </span>
  );
}

/** Small change pill for table rows and tiles. */
function MiniPill({ change, emptyTitle }: { change: Change | null; emptyTitle: string }) {
  if (!change) {
    return (
      <span className="pill pill-sm pill-flat" title={emptyTitle}>
        <span aria-hidden="true">—</span>
        <span className="sr-only">{emptyTitle}</span>
      </span>
    );
  }
  const up = isUp(change);
  return (
    <span className={`pill pill-sm ${up ? 'pill-up' : 'pill-down'}`} title={changeSentence(change, '1M')}>
      <span aria-hidden="true">
        {up ? '▲' : '▼'} {fmtPct(change.value)}
        {change.partial || change.estimated ? '*' : ''}
      </span>
      <span className="sr-only">{changeSentence(change, '1M')}</span>
    </span>
  );
}

function changeFootnote(changes: (Change | null)[]): string | null {
  const c = changes.find((x) => x && (x.partial || x.estimated));
  if (!c) return null;
  if (c.partial) return `* Since ${formatDayShort(c.baseDate)}: fewer than 30 comparable days so far.`;
  return '* Estimated: the base day comes from the back-cast.';
}

function currencySymbol(currency: string): string {
  return { USD: '$', EUR: '€', GBP: '£' }[currency] ?? `${currency} `;
}

function salaryRange(s: { min: number; max: number; currency: string }): string {
  const sym = currencySymbol(s.currency);
  const k = (n: number) => `${sym}${fmtInt(n / 1000)}K`;
  return s.min === s.max ? k(s.min) : `${k(s.min)} – ${k(s.max)}`;
}

function ageLabel(days: number): string {
  return days <= 0 ? 'today' : `${days}d ago`;
}
