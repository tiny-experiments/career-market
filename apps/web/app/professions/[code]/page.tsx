import { familyByCode } from '@cm/core/professions';
import type { Metadata } from 'next';
import { Code2, FlaskConical, Layers } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChangePill } from '@/components/ChangePill';
import { KeyStats, LatestRoles, SeniorityMix, TopCompanies, TopCountries, TopSkills } from '@/components/ProfessionBlocks';
import { ProfessionChart } from '@/components/ProfessionChart';
import { fmtInt } from '@/lib/format';
import { getProfessionPage } from '@/lib/readApi';
import '@/styles/screener.css';
import { familyInfo } from '@cm/core/codes';

type Props = { params: Promise<{ code: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { code } = await params;
  const family = familyByCode(code);
  return { title: family ? `${familyInfo(family).name} (${familyInfo(family).code})` : 'Profession' };
}

const SPECIALTY_ICONS = [Layers, Code2, FlaskConical];

export default async function ProfessionPage({ params }: Props) {
  const { code } = await params;
  if (!familyByCode(code)) notFound();
  const res = await getProfessionPage(code);
  if (!res.ok) {
    if (res.status === 404) notFound();
    return (
      <section className="card unavailable" aria-labelledby="unavailable-title">
        <h1 id="unavailable-title">This profession is not available right now</h1>
        <p className="muted">
          {res.status === 503
            ? 'The nightly build has not finished its first run yet. Data appears after the first build.'
            : 'The read model did not answer. Try again in a few minutes.'}
        </p>
      </section>
    );
  }
  const page = res.data;

  return (
    <div className="pf">
      <div className="pf-top">
        <div className="pf-head">
          <nav aria-label="Breadcrumb" className="pf-crumbs">
            <ol>
              <li>
                <Link href="/">Market</Link>
              </li>
              <li>
                <Link href="/professions">Professions</Link>
              </li>
              <li aria-current="page">
                {page.longName} ({page.code})
              </li>
            </ol>
          </nav>
          <h1 className="pf-title">
            <span className="code-badge">{page.code}</span>
            {page.longName}
          </h1>
          <div className="pf-headline">
            <p className="pf-open num" aria-label={`${fmtInt(page.open)} open roles`}>
              {fmtInt(page.open)}
            </p>
            <p className="pf-open-unit">open roles</p>
            <ChangePill change={page.changes['1W']} window="(1W)" size="lg" showWindow emptyTitle="1W change appears after 7 comparable days" />
          </div>
        </div>
        {page.specialties.length > 0 && (
          <ul className="pf-specialties" aria-label="Specialties">
            {page.specialties.slice(0, 3).map((s, i) => {
              const Icon = SPECIALTY_ICONS[i % SPECIALTY_ICONS.length] as typeof Layers;
              return (
                <li key={s.id} className="card pf-specialty">
                  <span className="stat-icon" aria-hidden="true">
                    <Icon size={22} />
                  </span>
                  <div>
                    <p className="stat-label">{s.label}</p>
                    <p className="stat-value num">{fmtInt(s.open)}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <section className="card pf-chart-card" aria-label={`Open ${page.name} roles over time`}>
        <ProfessionChart
          code={page.code}
          series={page.series}
          firstObservedDay={page.firstObservedDay}
          note={page.backcast.note}
          changes={page.changes}
        />
      </section>
      {(page.changes['1W']?.partial || page.changes['1M']?.partial || page.changes['3M']?.partial || page.changes['1M']?.estimated || page.changes['3M']?.estimated) && (
        <p className="footnote pf-footnote">
          * {page.changes['1M']?.estimated || page.changes['3M']?.estimated ? 'Estimated: the base day comes from the back-cast. ' : ''}
          {page.changes['1W']?.partial ? 'Shorter than a week of comparable days so far (2–3 Nov were krill’s bootstrap days). ' : ''}
        </p>
      )}

      <KeyStats page={page} />

      <div className="pf-grid">
        <SeniorityMix page={page} />
        <TopCountries page={page} />
        <TopCompanies page={page} />
        <TopSkills page={page} />
      </div>

      <LatestRoles page={page} />
    </div>
  );
}
