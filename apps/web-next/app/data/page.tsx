import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Data' };

export default function Page() {
  return (
    <article className="card prose-card">
      <p className="eyebrow">Data</p>
      <h1>What the read model holds</h1>
      <p>
        Career Market keeps its own read model, rebuilt from krill&apos;s public API once a day. Every table can be rebuilt
        from krill at any time.
      </p>
      <ul>
        <li>market_daily: open, new, opened and closed roles per day, panel matches and the chain-linked index.</li>
        <li>profession_daily: krill&apos;s daily statistics by profession, specialty, seniority and country.</li>
        <li>family_daily: profession series with their share-adjusted index.</li>
        <li>skill_daily: open roles per skill and profession on each build day.</li>
        <li>company_daily: open roles at the largest companies on each build day.</li>
        <li>market_change: 1W, 1M, 3M, 1Y and ALL changes for the market, professions and skills.</li>
        <li>open_age_cut, closing_sample, survival_curve: inputs and fit of the estimated history.</li>
        <li>market_note: the rule-written notes of each day.</li>
      </ul>
      <p>
        Source:{' '}
        <a href="https://krill.kurso.sh" rel="noreferrer">
          krill
        </a>{' '}
        (MIT-licensed API). Postings belong to the employers that published them.
      </p>
    </article>
  );
}
