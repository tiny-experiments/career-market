import type { ClosedJobPayload } from '@cm/core/job';
import { formatDayLong } from '@cm/core/dates';
import Link from 'next/link';

/** A role krill saw close. Its text is gone by design; the page says so and points to the market. */
export function ClosedJobView({ job }: { job: ClosedJobPayload }) {
  return (
    <section className="card prose-card closed-job" aria-labelledby="closed-title">
      <p className="eyebrow">Role closed</p>
      <h1 id="closed-title">
        This role closed on <time dateTime={job.closedAt}>{formatDayLong(job.closedAt)}</time>
      </h1>
      <p>
        It was {job.openedSource === 'posted' ? 'posted' : 'first seen'} on <time dateTime={job.openedAt}>{formatDayLong(job.openedAt)}</time>
        {job.familyName ? ` in ${job.familyName}` : ''}. Career Market keeps no text of closed roles.
      </p>
      <p>
        <Link href="/screener" className="link">
          Find similar open roles in the Screener <span aria-hidden="true">→</span>
        </Link>
      </p>
      <p>
        <Link href="/" className="link">
          ← Back to the Market overview
        </Link>
      </p>
    </section>
  );
}
