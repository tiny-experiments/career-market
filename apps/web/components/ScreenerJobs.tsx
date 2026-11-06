import { screenerHref, type JobSort, type ScreenerPayload } from '@cm/core/screener';
import { Briefcase, ChevronDown, ExternalLink, MapPin } from 'lucide-react';
import Link from 'next/link';
import { fmtInt } from '@/lib/format';
import { ageLabel } from '@/lib/screenerFormat';
import { CollapsePanel } from './CollapsePanel';
import { CompanyLogo } from './CompanyLogo';

const SORTS: { key: JobSort; label: string }[] = [
  { key: 'newest', label: 'Newest' },
  { key: 'opened', label: 'Posted' },
  { key: 'salary', label: 'Salary' },
];
const WORK_LABEL = { remote: 'Remote', hybrid: 'Hybrid', onsite: 'On-site' } as const;

function slugOf(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'role';
}

/** "N roles match": the matching roles, newest first by default, with a sort and a next page. */
export function ScreenerJobs({ data, logos }: { data: ScreenerPayload; logos: Record<string, string | null> }) {
  const jobs = data.jobs;
  const href = (over: Partial<{ jobSort: JobSort; cursor: string | null }>) =>
    screenerHref({ mode: data.mode, filters: data.filters, sort: data.sort, dir: data.dir, jobSort: over.jobSort ?? 'newest', cursor: over.cursor ?? null });
  const growthOn = data.filters.growth !== null;
  const current = jobs.available ? jobs.sort : 'newest';

  return (
    <CollapsePanel
      label="matching roles"
      header={
        <>
          <Briefcase size={24} aria-hidden="true" />
          <h2 className="jobs-title">
            <span className="num">{fmtInt(data.matches)}</span> roles match{growthOn ? ' the other filters' : ''}
          </h2>
          {growthOn && <span className="footnote jobs-growth-note">Growth applies to the company table only.</span>}
          <span className="jobs-sort">
            <span id="jobs-sort-label">Sort by:</span>
            <span role="group" aria-labelledby="jobs-sort-label" className="jobs-sort-group">
              {SORTS.map((s) => (
                <Link
                  key={s.key}
                  href={href({ jobSort: s.key })}
                  scroll={false}
                  className={`jobs-sort-btn${current === s.key ? ' is-active' : ''}`}
                  aria-current={current === s.key ? 'true' : undefined}
                >
                  {s.label}
                  {s.key !== 'newest' && <ChevronDown size={14} aria-hidden="true" />}
                </Link>
              ))}
            </span>
          </span>
        </>
      }
    >
      {!jobs.available ? (
        <p className="scr-note" role="status">
          {jobs.reason}
        </p>
      ) : (
        <>
          <div className="scr-scroll" tabIndex={0} role="region" aria-label="Matching roles">
            <table className="table jobs-table">
              <caption className="sr-only">
                Roles matching {growthOn ? 'the filters other than Growth' : 'the filters'}, {SORTS.find((s) => s.key === jobs.sort)?.label.toLowerCase()} first
                {jobs.sort === 'salary' ? ` (listed pay in ${jobs.salaryCurrency} only)` : ''}
              </caption>
              <thead>
                <tr>
                  <th scope="col">
                    <span className="sr-only">Employer site</span>
                  </th>
                  <th scope="col">Job title</th>
                  <th scope="col">Company</th>
                  <th scope="col">Location</th>
                  <th scope="col">Work mode</th>
                  <th scope="col">Seniority</th>
                  <th scope="col">Salary</th>
                  <th scope="col">Posted</th>
                </tr>
              </thead>
              <tbody>
                {jobs.jobs.map((j) => (
                  <tr key={j.id}>
                    <td className="job-ext">
                      <a href={j.url} target="_blank" rel="noopener noreferrer" aria-label={`Open ${j.title} on the employer's site (new tab)`}>
                        <ExternalLink size={16} aria-hidden="true" />
                      </a>
                    </td>
                    <th scope="row" className="job-title">
                      <Link href={`/job/${j.id}/${slugOf(j.title)}`}>{j.title}</Link>
                    </th>
                    <td className="job-company">
                      <CompanyLogo name={j.company.name} src={logos[j.company.id] ?? null} size={22} />
                      <span>{j.company.name}</span>
                    </td>
                    <td className="job-loc">
                      {j.location ? (
                        <>
                          <MapPin size={14} aria-hidden="true" /> {j.location}
                        </>
                      ) : (
                        <span className="muted">Not stated</span>
                      )}
                    </td>
                    <td>{j.workMode ? <span className={`tag wm-${j.workMode}`}>{WORK_LABEL[j.workMode]}</span> : <span className="muted">Not stated</span>}</td>
                    <td>{j.levelLabel ? <span className={`tag lvl-${j.level === 'staff' || j.level === 'principal' ? 'staff' : j.level}`}>{j.levelLabel}</span> : <span className="muted">—</span>}</td>
                    <td className="num">{j.salary ?? <span className="muted">Not listed</span>}</td>
                    <td className="num" title={`Opened ${j.openedAt}`}>
                      {ageLabel(j.ageDays)}
                    </td>
                  </tr>
                ))}
                {jobs.jobs.length === 0 && (
                  <tr>
                    <td colSpan={8} className="scr-empty">
                      No open roles match these filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <nav className="jobs-pager" aria-label="Matching roles pages">
            {data.mode && jobs.nextCursor !== null && (
              <Link href={href({ jobSort: jobs.sort, cursor: jobs.nextCursor })} scroll={false} className="link">
                Next {jobs.jobs.length} roles <span aria-hidden="true">→</span>
              </Link>
            )}
            {jobs.sort === 'salary' && <span className="footnote">Salary order lists roles with pay in {jobs.salaryCurrency}.</span>}
          </nav>
        </>
      )}
    </CollapsePanel>
  );
}
