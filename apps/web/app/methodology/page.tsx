import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Methodology' };

export default function Page() {
  return (
    <article className="card prose-card">
      <p className="eyebrow">Methodology</p>
      <h1>How the numbers are made</h1>
      <h2>Open roles and the Tech Hiring Index</h2>
      <p>
        krill adds new career boards every day, so a raw count of open roles grows even when hiring does not. The Tech
        Hiring Index measures each day&apos;s change only on boards krill fetched on both days, then multiplies the day
        changes (a chain-linked index). The chart shows open roles on today&apos;s boards: today&apos;s count, with each
        earlier day placed by the index.
      </p>
      <h2>New and closed roles</h2>
      <p>
        A role is new on its opened day: the posted day when the employer gives one, otherwise the day krill first saw
        it. A role closes on the day krill detects that it is gone. Because krill sometimes finds a role a day after it was
        posted, a day&apos;s new count can still grow for a day or two.
      </p>
      <h2>Bootstrap days</h2>
      <p>
        On 2 and 3 Nov 2026 krill saw almost every job for the first time. Both days are excluded from every change
        number. Until a full week of comparable days exists, a one-week change is shown since 3 Nov and marked with an
        asterisk. Changes over a month or more may start on an estimated day; they are marked as estimated.
      </p>
      <h2>Professions and skills</h2>
      <p>
        A profession is a krill job family. Its change follows the market index scaled by the profession&apos;s share of
        open roles, so new boards that join with the usual mix do not count as growth. Skills use the same rule on their
        daily counts, which Career Market stores from its first build.
      </p>
      <h2>Estimated history before 2 Nov 2026</h2>
      <p>
        krill knows the posted day of most open roles. Roles that opened in the past and already closed are missing from
        today&apos;s open set. A survival curve, the share of postings still open a given number of days after posting, is
        fitted from a daily sample of the closings krill detects. Dividing today&apos;s open roles of each posted day by
        that curve estimates how many roles were posted that day, and the curve then rebuilds how many were open on each
        past day. Roles without a posted day are scaled in rather than placed on their first-seen day. The estimate is drawn
        dashed and labelled; it assumes today&apos;s closing pattern held in the past, so it cannot show a past freeze or
        burst. Observed days replace estimated days as they arrive, and the curve firms up as weeks of closings
        accumulate.
      </p>
      <h2>Median days open</h2>
      <p>The median age of open tech roles, counted from their opened day.</p>
      <h2>Job pages</h2>
      <p>
        A job page shows one posting as krill read it from the employer&apos;s career board, and always sends you to the
        employer&apos;s site to apply. <strong>Days open</strong> counts from the opened day; the gauge follows krill&apos;s
        stale score (age up to 60 days, plus reposts). <strong>Posting health</strong> reads &ldquo;Possible ghost job&rdquo;
        when a role has been open 120 days or more, or was reposted twice or more; otherwise &ldquo;Looks active&rdquo;. When
        enough closings were sampled, it also says how long similar roles stayed open before they closed.
      </p>
      <p>
        <strong>Salary vs. band</strong> compares the role&apos;s pay midpoint with the middle half (25th to 75th percentile) of
        listed pay for the same profession, seniority and, when the sample is large enough, specialty. The band comes from the
        newest open US roles that list pay in USD (up to 500 per profession) and needs at least 30 of them. Other markets list
        pay too rarely for a fair band, and many postings list none. <strong>Company trend</strong> shows open roles from
        krill&apos;s company history; its signal (ramping, steady, cooling or freezing) appears after 30 days of history.
        <strong> Similar roles</strong> are open roles with the same specialty, seniority and country that name the same
        top skills; there is no similarity model.
      </p>
      <h2>Market notes</h2>
      <p>The notes under &ldquo;State of tech hiring&rdquo; are written by fixed rules from the day&apos;s numbers. No language model writes them.</p>
    </article>
  );
}
