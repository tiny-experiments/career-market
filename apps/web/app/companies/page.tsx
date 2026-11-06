import type { Metadata } from 'next';
import Link from 'next/link';
import { ChangeText } from '@/components/ChangePill';
import { CompanyLogo } from '@/components/CompanyLogo';
import { Sparkline } from '@/components/Sparkline';
import { fmtInt } from '@/lib/format';
import { logoUrl } from '@/lib/logo';
import { getCompanies } from '@/lib/readApi';
import './company.css';

export const metadata: Metadata = { title: 'Companies' };

const STATE_LABEL = { RAMPING: 'Ramping', STEADY: 'Steady', COOLING: 'Cooling', FREEZING: 'Freezing' } as const;

/** The largest companies by open tech roles; each row opens its Company page. */
export default async function CompaniesPage() {
  const res = await getCompanies();
  if (!res.ok) {
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
  return (
    <section className="card co-index" aria-labelledby="companies-title">
      <p className="eyebrow">Companies</p>
      <h1 id="companies-title" className="hero-title">
        Who is hiring
      </h1>
      <p className="muted">The {res.data.length} companies with the most open tech roles. Open one to see whether it is ramping or freezing.</p>
      <table className="table">
        <caption className="sr-only">Companies ranked by open tech roles</caption>
        <thead>
          <tr>
            <th scope="col">#</th>
            <th scope="col">Company</th>
            <th scope="col" className="r">
              Open roles
            </th>
            <th scope="col" className="r">
              Change (7D)
            </th>
            <th scope="col">Signal</th>
            <th scope="col">
              <span className="sr-only">Trend</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {res.data.map((c) => (
            <tr key={c.slug}>
              <td className="muted num">{c.rank}</td>
              <th scope="row">
                <Link href={`/companies/${c.slug}`} className="co-name-cell">
                  <CompanyLogo name={c.name} src={logoUrl(c.domain)} size={26} />
                  {c.name}
                </Link>
              </th>
              <td className="r num">{fmtInt(c.open)}</td>
              <td className="r">
                <ChangeText change={c.change} window="7D" />
              </td>
              <td>{c.state ? STATE_LABEL[c.state] : <span className="muted">—</span>}</td>
              <td className="spark-cell">
                <Sparkline values={c.spark} label={`${c.name} open roles`} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
