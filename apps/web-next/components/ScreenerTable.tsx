import type { Change } from '@cm/core/types';
import {
  GROWTH_LABEL,
  MIN_SIGNAL_DAYS,
  screenerHref,
  type GrowthState,
  type JobSort,
  type ScreenerPayload,
  type ScreenerRow,
  type SortKey,
} from '@cm/core/screener';
import { ArrowUpDown, Info, Snowflake, TrendingDown, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { fmtInt } from '@/lib/format';
import { changeTitle, pct0, signedPct } from '@/lib/screenerFormat';
import { CompanyLogo } from './CompanyLogo';
import { Sparkline } from './Sparkline';

const SIGNAL_ICON: Record<GrowthState, React.ReactNode> = {
  ramping: <TrendingUp size={13} aria-hidden="true" />,
  steady: <TrendingUp size={13} aria-hidden="true" className="flat-icon" />,
  cooling: <TrendingDown size={13} aria-hidden="true" />,
  freezing: <Snowflake size={13} aria-hidden="true" />,
};

function Pct({ change, window }: { change: Change | null; window: string }) {
  if (!change) {
    return (
      <span className="pct pct-flat" title="Change appears after enough comparable days">
        <span aria-hidden="true">—</span>
        <span className="sr-only">no change yet</span>
      </span>
    );
  }
  const mark = change.partial || change.estimated ? '*' : '';
  return (
    <span className={`pct ${change.value >= 0 ? 'pct-up' : 'pct-down'}`} title={changeTitle(change, window)}>
      <span aria-hidden="true">
        {signedPct(change.value)}
        {mark}
      </span>
      <span className="sr-only">{changeTitle(change, window)}</span>
    </span>
  );
}

function SignalBadge({ signal }: { signal: GrowthState | null }) {
  if (!signal) {
    return (
      <span className="pct pct-flat" title={`A signal needs ${MIN_SIGNAL_DAYS} days of company history`}>
        <span aria-hidden="true">—</span>
        <span className="sr-only">no signal yet</span>
      </span>
    );
  }
  return (
    <span className={`signal signal-${signal}`}>
      {SIGNAL_ICON[signal]}
      {GROWTH_LABEL[signal].toUpperCase()}
    </span>
  );
}

function RemoteShare({ row }: { row: ScreenerRow }) {
  if (row.remoteShare === null) {
    return (
      <span className="pct pct-flat" title="No open role of this row states a work mode">
        <span aria-hidden="true">—</span>
        <span className="sr-only">not stated</span>
      </span>
    );
  }
  const stated = row.statedShare === null ? '' : ` Share of roles that state a work mode: ${pct0(row.statedShare)} of open roles.`;
  return (
    <span className="remote-share" title={`Remote share of roles that state a work mode.${stated}`}>
      <span className="num">{pct0(row.remoteShare)}</span>
      <span className="share-bar" aria-hidden="true">
        <span style={{ width: `${Math.round(row.remoteShare * 100)}%` }} />
      </span>
    </span>
  );
}

type Column = { key: string; label: string; sort?: SortKey; align?: 'r'; help?: string };

function columnsFor(mode: ScreenerPayload['mode']): Column[] {
  if (mode === 'companies') {
    return [
      { key: 'rank', label: '#', sort: 'open' },
      { key: 'logo', label: 'Logo' },
      { key: 'name', label: 'Company', sort: 'name' },
      { key: 'open', label: 'Open roles', sort: 'open', align: 'r' },
      { key: 'c1w', label: '1W %', sort: 'change1w', align: 'r' },
      { key: 'c1m', label: '1M %', sort: 'change1m', align: 'r' },
      {
        key: 'signal',
        label: 'Signal',
        help: `Net change in open roles over the company history krill holds (up to 30 days): +3% or more ramping, −3% or less cooling, −10% or less freezing, otherwise steady. Needs ${MIN_SIGNAL_DAYS} days.`,
      },
      { key: 'profession', label: 'Top profession' },
      { key: 'skills', label: 'Top skills (top 3)' },
      { key: 'remote', label: 'Remote share', sort: 'remote' },
      { key: 'trend', label: '30D trend' },
    ];
  }
  if (mode === 'professions') {
    return [
      { key: 'rank', label: '#', sort: 'open' },
      { key: 'code', label: 'Ticker' },
      { key: 'name', label: 'Profession', sort: 'name' },
      { key: 'open', label: 'Open roles', sort: 'open', align: 'r' },
      { key: 'c1w', label: '1W %', sort: 'change1w', align: 'r' },
      { key: 'c1m', label: '1M %', sort: 'change1m', align: 'r' },
      { key: 'salary', label: 'Median salary', help: 'Needs pay statistics from krill, which it does not serve yet.' },
      { key: 'skills', label: 'Top skills (top 3)' },
      { key: 'remote', label: 'Remote share', sort: 'remote' },
      { key: 'trend', label: '30D trend' },
    ];
  }
  return [
    { key: 'rank', label: '#', sort: 'open' },
    { key: 'name', label: 'Skill', sort: 'name' },
    { key: 'open', label: 'Roles naming it', sort: 'open', align: 'r' },
    { key: 'c1w', label: '1W %', sort: 'change1w', align: 'r' },
    { key: 'c1m', label: '1M %', sort: 'change1m', align: 'r' },
    { key: 'profession', label: 'Top profession' },
    { key: 'remote', label: 'Remote share', sort: 'remote' },
    { key: 'trend', label: '30D trend' },
  ];
}

function Cell({ col, row, rank, logo }: { col: Column; row: ScreenerRow; rank: number; logo: string | null }) {
  switch (col.key) {
    case 'rank':
      return <td className="muted num">{rank}</td>;
    case 'logo':
      return (
        <td>
          <CompanyLogo name={row.label} src={logo} size={20} />
        </td>
      );
    case 'code':
      return <td className="ticker-cell">{row.ticker}</td>;
    case 'name':
      return (
        <th scope="row" className="name-cell">
          <Link href={row.href}>{row.label}</Link>
        </th>
      );
    case 'open':
      return <td className="r num strong">{fmtInt(row.open)}</td>;
    case 'c1w':
      return (
        <td className="r">
          <Pct change={row.change1w} window="over 1 week" />
        </td>
      );
    case 'c1m':
      return (
        <td className="r">
          <Pct change={row.change1m} window="over 1 month" />
        </td>
      );
    case 'signal':
      return (
        <td>
          <SignalBadge signal={row.signal} />
        </td>
      );
    case 'profession':
      return <td>{row.topProfession ?? <span className="pct pct-flat">—</span>}</td>;
    case 'skills':
      return (
        <td>
          {row.topSkills.length === 0 ? (
            <span className="pct pct-flat">—</span>
          ) : (
            <ul className="chips">
              {row.topSkills.map((s) => (
                <li key={s.id}>{s.label}</li>
              ))}
            </ul>
          )}
        </td>
      );
    case 'salary':
      return (
        <td className="r">
          <span className="pct pct-flat" title={col.help}>
            <span aria-hidden="true">—</span>
            <span className="sr-only">not available yet</span>
          </span>
        </td>
      );
    case 'remote':
      return (
        <td>
          <RemoteShare row={row} />
        </td>
      );
    case 'trend':
      return (
        <td className="trend-cell">
          <Sparkline values={row.spark} width={112} height={24} label={`${row.label} open roles`} />
        </td>
      );
    default:
      return <td />;
  }
}

export function ScreenerTable({ data, logos, jobSort }: { data: ScreenerPayload; logos: Record<string, string | null>; jobSort: JobSort }) {
  const cols = columnsFor(data.mode);
  const nameOf = { companies: 'companies', professions: 'professions', skills: 'skills' }[data.mode];
  const partial = data.rows.some((r) => r.change1w?.partial || r.change1m?.partial);

  return (
    <section className="card scr-card" aria-labelledby="scr-table-title">
      <h2 id="scr-table-title" className="sr-only">
        Screener results: {nameOf}
      </h2>
      <div className="scr-scroll" tabIndex={0} role="region" aria-label={`Screener table, ${data.rowTotal} ${nameOf}`}>
        <table className="table scr-table">
          <caption className="sr-only">
            {data.rowTotal} {nameOf}, sorted by {data.sort} {data.dir === 'asc' ? 'ascending' : 'descending'}
            {data.rowTotal > data.rows.length ? `; the first ${data.rows.length} are shown` : ''}
          </caption>
          <thead>
            <tr>
              {cols.map((c) => {
                const active = c.sort === data.sort && c.key !== 'rank' ? true : c.key === 'rank' && data.sort === 'open';
                const nextDir = c.sort === data.sort ? (data.dir === 'desc' ? 'asc' : 'desc') : c.sort === 'name' ? 'asc' : 'desc';
                return (
                  <th
                    key={c.key}
                    scope="col"
                    className={c.align === 'r' ? 'r' : undefined}
                    aria-sort={c.sort && active ? (data.dir === 'asc' ? 'ascending' : 'descending') : undefined}
                  >
                    {c.sort ? (
                      <Link
                        href={screenerHref({ mode: data.mode, filters: data.filters, sort: c.sort, dir: nextDir, jobSort })}
                        className="sort-link"
                        scroll={false}
                      >
                        {c.label}
                        <ArrowUpDown size={12} aria-hidden="true" />
                      </Link>
                    ) : (
                      c.label
                    )}
                    {c.help && (
                      <span className="info" tabIndex={0} role="note" aria-label={`About ${c.label}`}>
                        <Info size={13} aria-hidden="true" />
                        <span className="info-tip">{c.help}</span>
                      </span>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row, i) => (
              <tr key={row.id}>
                {cols.map((c) => (
                  <Cell key={c.key} col={c} row={row} rank={i + 1} logo={logos[row.id] ?? null} />
                ))}
              </tr>
            ))}
            {data.rows.length === 0 && (
              <tr>
                <td colSpan={cols.length} className="scr-empty">
                  {data.liveError ?? data.growthUnavailable ?? 'Nothing matches these filters.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {(partial || data.notes.length > 0) && (
        <div className="scr-notes">
          {partial && <p className="footnote">* Since the first comparable day: fewer than the full range of days exist so far.</p>}
          {data.notes.map((n) => (
            <p key={n} className="footnote">
              {n}
            </p>
          ))}
        </div>
      )}
    </section>
  );
}
