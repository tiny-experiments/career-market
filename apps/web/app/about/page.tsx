import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'About' };

export default function Page() {
  return (
    <article className="card prose-card">
      <p className="eyebrow">About</p>
      <h1>Career Market</h1>
      <p>
        Career Market charts tech careers like market instruments: professions as tickers, companies as issuers and skills
        as commodities. It is not a job board. There are no accounts, no applications on this site and no paid listings;
        every Apply link opens the employer&apos;s own site.
      </p>
      <h2>Where the data comes from</h2>
      <p>
        Every number comes from{' '}
        <a href="https://krill.kurso.sh" rel="noreferrer">
          krill
        </a>
        , an open collector that reads company career boards every day and classifies each tech job with plain rules
        (profession, specialty, seniority, skills, location, pay).
      </p>
      <p>
        krill reads the public job boards of applicant tracking systems and employer career sites, including Greenhouse,
        Ashby, Lever, Workday, SmartRecruiters, Workable, Recruitee, Personio, Teamtailor, Pinpoint, Rippling,
        SuccessFactors, Oracle Recruiting, Eightfold and Gem, and the career sites of Amazon, Apple, Google, Meta and
        ByteDance. Postings belong to the employers that published them.
      </p>
      <h2>How it is built</h2>
      <p>
        Once a day, after krill finishes its pass, Career Market reads krill into its own read model and computes every
        derived number: the chain-linked Tech Hiring Index, changes over each range, the estimated history before
        2 Nov 2026 and the market notes. See the methodology for details.
      </p>
      <p>A Tiny Experiments project.</p>
    </article>
  );
}
