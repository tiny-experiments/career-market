'use client';

import { formatDayLong, formatDayShort, isBootstrapDay } from '@cm/core/dates';
import type { CompanyTrendPoint } from '@cm/core/company';
import { useEffect, useMemo, useRef, useState } from 'react';
import { fmtCompact, fmtInt } from '@/lib/format';

const RANGES = [
  { id: '1M', days: 30 },
  { id: '3M', days: 91 },
  { id: '1Y', days: 365 },
] as const;
type RangeId = (typeof RANGES)[number]['id'];

const DAY_MS = 86_400_000;
const PAD = { left: 40, right: 10, top: 10, bottom: 22 };
/** More comparable days than this and the chart sums to weeks. */
const WEEKLY_AFTER = 45;

interface Bucket {
  from: string;
  to: string;
  opened: number;
  closed: number;
  /** Every day in the bucket was left out (bootstrap or first fetch). */
  excluded: boolean;
  /** Days in the bucket the company's board was added, dropped or fetched in bulk. */
  boardDays: string[];
  /** The bucket holds a krill bootstrap day. */
  bootstrap: boolean;
}

/** Why a bucket is left out, in words. */
function excludedNote(b: Bucket): string {
  if (b.boardDays.length > 0) return 'Board change excluded: a board was added, dropped or fetched in bulk, so this is not hiring';
  if (b.bootstrap) return 'Not counted: krill bootstrap day, when almost every role counted as new';
  return 'Not counted: no comparable roles yet';
}

function dayIndex(date: string): number {
  return Math.round(new Date(`${date}T00:00:00Z`).getTime() / DAY_MS);
}

/** A y-axis maximum that divides into four whole-number steps (1, 2, 5, 10 times a power of ten). */
function niceMax(v: number): number {
  if (v <= 0) return 4;
  const raw = v / 4;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = ([1, 2, 5, 10].map((m) => m * mag).find((m) => m >= raw) as number) || raw;
  return Math.max(4, step * 4);
}

/** Daily points, or weekly sums once there is a long history. Excluded days never count. */
export function bucketize(points: readonly CompanyTrendPoint[]): { buckets: Bucket[]; weekly: boolean } {
  const usable = points.filter((p) => !p.excluded).length;
  if (usable <= WEEKLY_AFTER) {
    return {
      weekly: false,
      buckets: points.map((p) => ({
        from: p.date,
        to: p.date,
        opened: p.opened,
        closed: p.closed,
        excluded: p.excluded,
        boardDays: p.boardChange ? [p.date] : [],
        bootstrap: isBootstrapDay(p.date),
      })),
    };
  }
  const weeks = new Map<number, Bucket>();
  for (const p of points) {
    const week = Math.floor((dayIndex(p.date) + 3) / 7); // weeks start on Monday
    const b = weeks.get(week) ?? { from: p.date, to: p.date, opened: 0, closed: 0, excluded: true, boardDays: [], bootstrap: false };
    if (p.boardChange) b.boardDays.push(p.date);
    if (isBootstrapDay(p.date)) b.bootstrap = true;
    if (!p.excluded) {
      b.opened += p.opened;
      b.closed += p.closed;
      b.excluded = false;
    }
    b.to = p.date;
    weeks.set(week, b);
  }
  return { weekly: true, buckets: [...weeks.values()] };
}

/**
 * Openings (green) and closings (red) as lines with the net change as bars
 * underneath. Days krill did not count as hiring (its bootstrap days and the
 * first fetch of a board) are drawn as gaps, never as zero.
 */
export function HiringTrendChart({ series, companyName }: { series: CompanyTrendPoint[]; companyName: string }) {
  const [range, setRange] = useState<RangeId>('3M');
  const [hover, setHover] = useState<number | null>(null);
  const [width, setWidth] = useState(640);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      if (entry) setWidth(Math.max(260, Math.floor(entry.contentRect.width)));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { buckets, weekly } = useMemo(() => {
    const days = RANGES.find((r) => r.id === range)?.days ?? 365;
    const last = series.at(-1);
    const inRange = last ? series.filter((p) => dayIndex(p.date) > dayIndex(last.date) - days) : series;
    // Leading days before the first real day add nothing but empty space.
    const firstReal = inRange.findIndex((p) => !p.excluded);
    return bucketize(firstReal > 0 ? inRange.slice(Math.max(0, firstReal - 1)) : inRange);
  }, [series, range]);

  const real = buckets.filter((b) => !b.excluded);
  const boardChanged = buckets.filter((b) => b.boardDays.length > 0);
  const height = 190;
  const plotW = width - PAD.left - PAD.right;
  const lineH = 118;
  const barsTop = PAD.top + lineH + 16;
  const barsH = height - barsTop - PAD.bottom;

  const max = niceMax(Math.max(1, ...real.map((b) => Math.max(b.opened, b.closed))));
  const netMax = Math.max(1, ...real.map((b) => Math.abs(b.opened - b.closed)));
  const n = buckets.length;
  const xs = (i: number) => PAD.left + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const ys = (v: number) => PAD.top + lineH - (v / max) * lineH;

  const lineOf = (pick: (b: Bucket) => number) => {
    const segments: string[] = [];
    let current = '';
    buckets.forEach((b, i) => {
      if (b.excluded) {
        if (current) segments.push(current);
        current = '';
        return;
      }
      current += `${current ? 'L' : 'M'}${xs(i).toFixed(1)},${ys(pick(b)).toFixed(1)} `;
    });
    if (current) segments.push(current);
    return segments;
  };
  const openedLine = lineOf((b) => b.opened);
  const closedLine = lineOf((b) => b.closed);

  const ticks = [0, 1, 2, 3, 4].map((i) => (i * max) / 4);
  const labelEvery = Math.max(1, Math.ceil(n / 6));
  const slot = n > 1 ? plotW / (n - 1) : plotW;
  const barW = Math.max(2, Math.min(14, slot * 0.5));
  const label = (b: Bucket) => (weekly ? `Week of ${formatDayShort(b.from)}` : formatDayLong(b.from));

  const totals = { opened: real.reduce((a, b) => a + b.opened, 0), closed: real.reduce((a, b) => a + b.closed, 0) };
  const summary = real.length
    ? `Openings and closings of ${companyName} ${weekly ? 'by week' : 'by day'} from ${formatDayLong((real[0] as Bucket).from)} to ${formatDayLong((real.at(-1) as Bucket).to)}: ${fmtInt(totals.opened)} openings and ${fmtInt(totals.closed)} closings, net ${totals.opened - totals.closed >= 0 ? '+' : '−'}${fmtInt(Math.abs(totals.opened - totals.closed))}.`
    : `No comparable days of openings and closings for ${companyName} yet.`;

  const hovered = hover === null ? null : buckets[hover];
  const onMove = (clientX: number, rect: DOMRect) => {
    const x = clientX - rect.left - PAD.left;
    const i = n <= 1 ? 0 : Math.round((x / plotW) * (n - 1));
    setHover(Math.min(n - 1, Math.max(0, i)));
  };

  return (
    <div className="co-chart">
      <div className="co-chart-head">
        <h2 className="chart-title">
          Hiring trend
          <span className="info" tabIndex={0} role="note" aria-label="About the hiring trend">
            <span aria-hidden="true">i</span>
            <span className="info-tip">
              Openings are the roles krill first saw that day; closings are the roles it saw disappear. Krill&apos;s bootstrap days
              (2–3 Nov) are left out, and so are board-change days, when a board is added or dropped and hundreds of roles move at
              once (marked with a dashed line).
            </span>
          </span>
        </h2>
        <ul className="co-legend" aria-label="Chart legend">
          <li>
            <span className="co-dot co-dot-open" aria-hidden="true" /> Openings
          </li>
          <li>
            <span className="co-dot co-dot-close" aria-hidden="true" /> Closings
          </li>
          <li>
            <span className="co-dot co-dot-net" aria-hidden="true" /> Net change
          </li>
          {boardChanged.length > 0 && (
            <li>
              <span className="co-dot co-dot-board" aria-hidden="true" /> Board change excluded
            </li>
          )}
        </ul>
        <div className="range-toggle" role="group" aria-label="Chart range">
          {RANGES.map((r) => (
            <button key={r.id} type="button" aria-pressed={range === r.id} className={range === r.id ? 'is-active' : ''} onClick={() => setRange(r.id)}>
              {r.id}
            </button>
          ))}
        </div>
      </div>
      <div className="chart-plot co-plot" ref={wrap}>
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={summary}
          onMouseMove={(e) => onMove(e.clientX, e.currentTarget.getBoundingClientRect())}
          onMouseLeave={() => setHover(null)}
        >
          {ticks.map((t) => (
            <g key={t} className="axis">
              <line x1={PAD.left} x2={width - PAD.right} y1={ys(t)} y2={ys(t)} className="grid" />
              <text x={PAD.left - 8} y={ys(t)} dy="0.32em" textAnchor="end">
                {fmtCompact(t)}
              </text>
            </g>
          ))}
          {buckets.map((b, i) =>
            b.excluded ? (
              <rect
                key={`x${b.from}`}
                x={Math.max(PAD.left, xs(i) - slot / 2)}
                y={PAD.top}
                width={Math.max(0, Math.min(width - PAD.right, xs(i) + slot / 2) - Math.max(PAD.left, xs(i) - slot / 2))}
                height={lineH}
                className="co-gap"
              />
            ) : null,
          )}
          {boardChanged.map((b) => (
            <line key={`m${b.from}`} x1={xs(buckets.indexOf(b))} x2={xs(buckets.indexOf(b))} y1={PAD.top} y2={barsTop + barsH} className="co-board-mark" />
          ))}
          {openedLine.map((d) => (
            <path key={`o${d}`} d={d} className="co-line co-line-open" />
          ))}
          {closedLine.map((d) => (
            <path key={`c${d}`} d={d} className="co-line co-line-close" />
          ))}
          {real.length > 0 &&
            real.length <= 12 &&
            buckets.map((b, i) =>
              b.excluded ? null : (
                <g key={`p${b.from}`}>
                  <circle cx={xs(i)} cy={ys(b.opened)} r="3" className="co-pt co-pt-open" />
                  <circle cx={xs(i)} cy={ys(b.closed)} r="3" className="co-pt co-pt-close" />
                </g>
              ),
            )}
          <g className="bars">
            {buckets.map((b, i) => {
              if (b.excluded) return null;
              const net = b.opened - b.closed;
              const h = Math.max(1, (Math.abs(net) / netMax) * (barsH / 2));
              const mid = barsTop + barsH / 2;
              return (
                <rect
                  key={`b${b.from}`}
                  x={xs(i) - barW / 2}
                  y={net >= 0 ? mid - h : mid}
                  width={barW}
                  height={h}
                  className={net >= 0 ? 'co-bar-up' : 'co-bar-down'}
                />
              );
            })}
            <line x1={PAD.left} x2={width - PAD.right} y1={barsTop + barsH / 2} y2={barsTop + barsH / 2} className="grid" />
          </g>
          {buckets.map((b, i) =>
            i % labelEvery === 0 || i === n - 1 ? (
              <text key={`l${b.from}`} x={xs(i)} y={height - 5} textAnchor="middle" className="axis-x">
                {formatDayShort(b.from)}
              </text>
            ) : null,
          )}
          {hovered && !hovered.excluded && (
            <g className="crosshair" pointerEvents="none">
              <line x1={xs(hover as number)} x2={xs(hover as number)} y1={PAD.top} y2={barsTop + barsH} />
            </g>
          )}
        </svg>
        {real.length === 0 && (
          <p className="co-chart-empty">
            No comparable days yet. krill counted every role on 2–3 Nov as new, and days a board is added or dropped are left out too.
          </p>
        )}
        {hovered && (
          <div className="chart-tip" style={{ left: Math.min(width - 190, Math.max(0, xs(hover as number) + 10)), top: 8 }} aria-hidden="true">
            <strong>{label(hovered)}</strong>
            {hovered.excluded ? (
              <em> · {excludedNote(hovered)}</em>
            ) : (
              <>
                <span>
                  Openings <b className="num">{fmtInt(hovered.opened)}</b> · Closings <b className="num">{fmtInt(hovered.closed)}</b>
                </span>
                <span>
                  Net <b className="num">{hovered.opened - hovered.closed >= 0 ? '+' : '−'}{fmtInt(Math.abs(hovered.opened - hovered.closed))}</b>
                </span>
                {hovered.boardDays.length > 0 && <em>Board change excluded on {hovered.boardDays.map((d) => formatDayShort(d)).join(', ')}</em>}
              </>
            )}
          </div>
        )}
      </div>
      <table className="sr-only">
        <caption>{summary}</caption>
        <thead>
          <tr>
            <th scope="col">{weekly ? 'Week' : 'Day'}</th>
            <th scope="col">Openings</th>
            <th scope="col">Closings</th>
            <th scope="col">Net change</th>
          </tr>
        </thead>
        <tbody>
          {buckets.map((b) => (
            <tr key={b.from}>
              <th scope="row">
                {label(b)}
                {!b.excluded && b.boardDays.length > 0 && ` (board change excluded on ${b.boardDays.map((d) => formatDayShort(d)).join(', ')})`}
              </th>
              {b.excluded ? (
                <td colSpan={3}>{excludedNote(b)}</td>
              ) : (
                <>
                  <td>{b.opened}</td>
                  <td>{b.closed}</td>
                  <td>{b.opened - b.closed}</td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
