import { Briefcase, CircleDollarSign, ExternalLink, Info, Laptop, Layers, MapPin } from 'lucide-react';
import Link from 'next/link';
import { salaryLabel, type JobPagePayload, type JobPosting } from '@cm/core/job';
import { titleCase } from '@cm/core/codes';
import { companyHref } from '@/lib/links';
import { logoUrl } from '@/lib/logo';
import { CompanyLogo } from './CompanyLogo';
import { CopyLinkButton } from './CopyLinkButton';
import { JobDescription } from './JobDescription';
import { MarketContext } from './MarketContext';

const MAX_SKILLS = 14;

export function JobView({ payload }: { payload: JobPagePayload }) {
  const { job, context } = payload;
  return (
    <div className="job-page">
      <div className="job-grid">
        <article className="job-main" aria-labelledby="job-title">
          <Breadcrumb job={job} />
          <div className="job-company">
            <CompanyLogo name={job.company.name} src={logoUrl(job.company.domain)} size="lg" />
            <Link href={companyHref(job.company.id)} className="job-company-name">
              {job.company.name}
            </Link>
          </div>
          <h1 id="job-title" className="job-title">
            {job.title}
          </h1>
          <Tags job={job} />
          <div className="job-actions">
            <ApplyButton job={job} />
            <CopyLinkButton />
          </div>
          {job.description ? (
            <JobDescription text={job.description} />
          ) : (
            <p className="job-text-missing">
              The employer&apos;s text for this role is not available here. Read it on {job.company.name}&apos;s site.
            </p>
          )}
          <Skills job={job} />
          <div className="job-actions job-actions-end">
            <ApplyButton job={job} />
          </div>
        </article>
        <MarketContext job={job} context={context} logo={logoUrl} />
      </div>
    </div>
  );
}

function Breadcrumb({ job }: { job: JobPosting }) {
  return (
    <nav aria-label="Breadcrumb" className="crumbs">
      <ol>
        <li>
          <Link href="/">Market</Link>
        </li>
        <li>
          <Link href="/companies">Companies</Link>
        </li>
        <li>
          <Link href={companyHref(job.company.id)}>{job.company.name}</Link>
        </li>
        <li>
          <Link href={`${companyHref(job.company.id)}#current-roles`}>Jobs</Link>
        </li>
        <li aria-current="page">{job.title}</li>
      </ol>
    </nav>
  );
}

function Tags({ job }: { job: JobPosting }) {
  const pay = salaryLabel(job.salary);
  const location = job.location ? (job.moreLocations > 0 ? `${job.location} (+${job.moreLocations} more)` : job.location) : null;
  const tags = [
    location && { key: 'location', label: 'Location', icon: <MapPin size={18} aria-hidden="true" />, text: location },
    job.level && { key: 'level', label: 'Seniority', icon: <Layers size={18} aria-hidden="true" />, text: titleCase(job.level) },
    job.employmentType && { key: 'type', label: 'Employment type', icon: <Briefcase size={18} aria-hidden="true" />, text: job.employmentType },
    job.workMode && { key: 'mode', label: 'Work mode', icon: <Laptop size={18} aria-hidden="true" />, text: job.workMode },
    pay && { key: 'pay', label: 'Pay', icon: <CircleDollarSign size={18} aria-hidden="true" />, text: pay },
  ].filter((t): t is { key: string; label: string; icon: React.ReactElement; text: string } => Boolean(t));
  if (tags.length === 0) return null;
  return (
    <ul className="job-tags">
      {tags.map((t) => (
        <li key={t.key}>
          {t.icon}
          <span className="sr-only">{t.label}: </span>
          <span>{t.text}</span>
        </li>
      ))}
    </ul>
  );
}

function ApplyButton({ job }: { job: JobPosting }) {
  if (!job.applyUrl) return null;
  return (
    <a className="btn btn-primary" href={job.applyUrl} target="_blank" rel="noopener noreferrer">
      Apply on {job.company.name}&apos;s site <ExternalLink size={17} aria-hidden="true" />
      <span className="sr-only"> (opens the employer&apos;s site in a new tab)</span>
    </a>
  );
}

function Skills({ job }: { job: JobPosting }) {
  if (job.skills.length === 0) return null;
  const shown = job.skills.slice(0, MAX_SKILLS);
  const rest = job.skills.slice(MAX_SKILLS);
  return (
    <section className="job-skills" aria-labelledby="skills-title">
      <h2 id="skills-title" className="job-skills-title">
        Skills detected
        <span className="info" tabIndex={0} role="note" aria-label="How skills are detected">
          <Info size={15} aria-hidden="true" />
          <span className="info-tip">Skills krill finds in the posting text with fixed rules, most mentioned first. A skill the text does not name is not listed.</span>
        </span>
      </h2>
      <ul className="chips">
        {shown.map((s) => (
          <li key={s.id} className="chip">
            {s.label}
          </li>
        ))}
        {rest.length > 0 && (
          <li className="chip-more">
            <details>
              <summary>+{rest.length} more</summary>
              <ul className="chips chips-rest">
                {rest.map((s) => (
                  <li key={s.id} className="chip">
                    {s.label}
                  </li>
                ))}
              </ul>
            </details>
          </li>
        )}
      </ul>
    </section>
  );
}
