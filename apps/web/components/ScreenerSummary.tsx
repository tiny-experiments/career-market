import type { MixRow, ScreenerPayload } from '@cm/core/screener';
import { Globe, Laptop, Users } from 'lucide-react';
import { fmtInt } from '@/lib/format';
import { Flag } from './Flag';

function Mix({ rows, showCount }: { rows: MixRow[]; showCount: boolean }) {
  const max = Math.max(0.0001, ...rows.map((r) => r.share));
  return (
    <table className="mix">
      <tbody>
        {rows.map((r) => (
          <tr key={r.key}>
            <th scope="row">{r.label}</th>
            <td className="r num">{(r.share * 100).toFixed(1)}%</td>
            {showCount && <td className="r num muted">{fmtInt(r.count)}</td>}
            <td className="mix-bar" aria-hidden="true">
              <span className="share-bar">
                <span style={{ width: `${(r.share / max) * 100}%` }} />
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Seniority mix, work-mode split and top countries for the current filters. */
export function ScreenerSummary({ summary, growthOn = false }: { summary: ScreenerPayload['summary']; growthOn?: boolean }) {
  if ('available' in summary) {
    return (
      <section className="scr-summary" aria-label="Result summary">
        <p className="card scr-note" role="status">
          {summary.reason}
        </p>
      </section>
    );
  }
  const seniority = summary.levels.filter((l) => l.count > 0);
  return (
    <section className="scr-summary" aria-label="Result summary">
      <div className="card sum-card">
        <div className="sum-head">
          <Users size={26} aria-hidden="true" />
          <h2>Seniority mix</h2>
          <p className="muted num">{fmtInt(summary.open)} open roles</p>
        </div>
        <Mix rows={seniority} showCount={false} />
      </div>
      <div className="card sum-card">
        <div className="sum-head">
          <Laptop size={26} aria-hidden="true" />
          <h2>Work-mode split</h2>
          <p className="muted num">{fmtInt(summary.open)} open roles</p>
        </div>
        <Mix rows={summary.workModes} showCount />
        {summary.workModeUnstated > 0 && (
          <p className="footnote sum-foot">Of roles that state a mode; {fmtInt(summary.workModeUnstated)} do not.</p>
        )}
      </div>
      <div className="card sum-card">
        <div className="sum-head">
          <Globe size={26} aria-hidden="true" />
          <h2>Top countries</h2>
        </div>
        <table className="mix">
          <tbody>
            {summary.countries.map((c) => (
              <tr key={c.code}>
                <th scope="row">
                  <Flag code={c.code} /> {c.name}
                </th>
                <td className="r num">{fmtInt(c.count)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {growthOn && <p className="footnote scr-growth-note">The summary follows the filters other than Growth, which applies to the company table only.</p>}
    </section>
  );
}
