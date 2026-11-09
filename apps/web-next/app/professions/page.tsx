import type { Metadata } from 'next';
import Link from 'next/link';
import { professionHref } from '@cm/core/professions';
import { ChangeText } from '@/components/ChangePill';
import { Sparkline } from '@/components/Sparkline';
import { fmtInt } from '@/lib/format';
import { getProfessionIndex } from '@/lib/readApi';

export const metadata: Metadata = { title: 'Professions' };

export default async function Page() {
  const res = await getProfessionIndex();
  if (!res.ok) {
    return (
      <section className="card unavailable" aria-labelledby="unavailable-title">
        <h1 id="unavailable-title">Professions are not available right now</h1>
        <p className="muted">
          {res.status === 503
            ? 'The nightly build has not finished its first run yet. Data appears after the first build.'
            : 'The read model did not answer. Try again in a few minutes.'}
        </p>
      </section>
    );
  }
  return (
    <section className="card pf-index" aria-labelledby="professions-title">
      <h1 id="professions-title" className="card-title">
        Professions
      </h1>
      <p className="muted pf-index-lead">Follow one profession the way you follow a stock. Open roles, one-week change and a 30-day trend.</p>
      <table className="table pf-table">
        <caption className="sr-only">Every profession with its open roles and one-week change</caption>
        <thead>
          <tr>
            <th scope="col">Profession</th>
            <th scope="col">Ticker</th>
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
          {res.data.rows.map((r) => (
            <tr key={r.family}>
              <th scope="row">
                <Link href={professionHref(r.family)}>{r.longName}</Link>
              </th>
              <td className="muted">{r.code}</td>
              <td className="r num">{fmtInt(r.open)}</td>
              <td className="r">
                <ChangeText change={r.change} window="7D" />
              </td>
              <td className="spark-cell">
                <Sparkline values={r.spark} label={`${r.name} open roles`} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
