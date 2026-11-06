import { formatDayLong } from '@cm/core/dates';
import { skillNamespace } from '@cm/core/skills';
import type { Metadata } from 'next';
import Link from 'next/link';
import { BrandMark } from '@/components/BrandMark';
import { ChangePill } from '@/components/ChangePill';
import { fmtInt } from '@/lib/format';
import { logoSrc } from '@/lib/logos';
import { getSkillIndex } from '@/lib/readApi';
import './skills.css';

export const metadata: Metadata = { title: 'Skills' };

export default async function SkillsPage() {
  const res = await getSkillIndex();
  if (!res.ok) {
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
  const { asOf, skills } = res.data;
  return (
    <div className="skills-index">
      <div className="skills-index-head">
        <h1>Skills</h1>
        <p>
          The {skills.length} skills named in the most open tech roles, as of <time dateTime={asOf}>{formatDayLong(asOf)}</time>. Open one to
          see its demand over time, the professions and companies asking for it, and the skills it is paired with.
        </p>
      </div>
      <ul className="skills-grid">
        {skills.map((s) => (
          <li key={s.id}>
            <Link href={`/skills/${s.slug}`} className="skills-tile">
              <BrandMark src={logoSrc(s.domain)} name={s.label} size={34} kind="skill" namespace={skillNamespace(s.id)} />
              <span className="skills-tile-name">{s.label}</span>
              <span className="skills-tile-count num">{fmtInt(s.open)}</span>
              <span className="skills-tile-meta">
                {s.category} · {fmtInt(s.primaryOpen)} in {s.primaryName}
              </span>
              <ChangePill change={s.change} window="1M" emptyTitle="Change appears after enough comparable days" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
