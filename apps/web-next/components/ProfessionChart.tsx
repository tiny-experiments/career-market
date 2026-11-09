'use client';

import { formatDayLong } from '@cm/core/dates';
import type { Change, SeriesPoint } from '@cm/core/types';
import { Info } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { dayIndex, monthLabel, niceTicks, shortLabel } from '@/lib/chart';
import { fmtAxis, fmtInt, fmtPct } from '@/lib/format';

const RANGES = [
  { id: '1W', days: 7 },
  { id: '1M', days: 30 },
  { id: '3M', days: 91 },
] as const;
type RangeId = (typeof RANGES)[number]['id'];

const PAD = { left: 46, right: 8, top: 10, bottom: 22 };
const BARS_H = 16;
const BARS_GAP = 4;
const LABEL_W = 0;

/** Open roles of one profession with 1W/1M/3M toggles, a crosshair and a strip of daily postings. */
export function ProfessionChart({
  code,
  series,
  firstObservedDay,
  note,
  changes,
}: {
  code: string;
  series: SeriesPoint[];
  firstObservedDay: string;
  note: string;
  changes: { '1W': Change | null; '1M': Change | null; '3M': Change | null };
}) {
  const [range, setRange] = useState<RangeId>('3M');
  const [hover, setHover] = useState<number | null>(null);
  const [width, setWidth] = useState(900);
  const wrap = useRef<HTMLDivElement>(null);
  const gradId = useId().replace(/:/g, '');

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      if (entry) setWidth(Math.max(280, Math.floor(entry.contentRect.width)));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const byDay = useMemo(() => new Map(series.map((p) => [dayIndex(p.date), p])), [series]);
  const points = useMemo(() => {
    const days = RANGES.find((r) => r.id === range)?.days ?? 91;
    const last = series.at(-1);
    if (!last) return series;
    const from = dayIndex(last.date) - days;
    return series.filter((p) => dayIndex(p.date) > from);
  }, [series, range]);

  const height = 108;
  const plotW = width - PAD.left - PAD.right - LABEL_W;
  const plotH = height - PAD.top - PAD.bottom;

  if (points.length === 0) return <p className="muted">No data yet.</p>;

  const values = points.map((p) => p.open);
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const padY = (hi - lo) * 0.12 || hi * 0.02 || 1;
  const ticks = niceTicks(lo - padY, hi + padY, 5);
  const yMin = Math.min(ticks[0] ?? lo, lo);
  const yMax = Math.max(ticks.at(-1) ?? hi, hi);
  const x0 = dayIndex((points[0] as SeriesPoint).date);
  const x1 = dayIndex((points.at(-1) as SeriesPoint).date);
  const xs = (date: string) => PAD.left + (x1 === x0 ? plotW / 2 : ((dayIndex(date) - x0) / (x1 - x0)) * plotW);
  const ys = (v: number) => PAD.top + plotH - ((v - yMin) / (yMax - yMin || 1)) * plotH;

  const path = (pts: SeriesPoint[]) => pts.map((p, i) => `${i ? 'L' : 'M'}${xs(p.date).toFixed(1)},${ys(p.open).toFixed(1)}`).join(' ');
  const est = points.filter((p) => p.estimated);
  const obs = points.filter((p) => !p.estimated);
  const estLine = est.length && obs[0] ? [...est, obs[0]] : est;
  const area = (pts: SeriesPoint[]) =>
    pts.length ? `${path(pts)} L${xs((pts.at(-1) as SeriesPoint).date).toFixed(1)},${PAD.top + plotH} L${xs((pts[0] as SeriesPoint).date).toFixed(1)},${PAD.top + plotH} Z` : '';

  const spanDays = x1 - x0;
  const xLabels: { x: number; text: string }[] = [];
  if (spanDays > 62) {
    for (const p of points) if (p.date.endsWith('-01')) xLabels.push({ x: xs(p.date), text: monthLabel(p.date) });
  } else {
    const every = Math.max(1, Math.ceil(points.length / 6));
    points.forEach((p, i) => {
      if (i % every === 0 || i === points.length - 1) xLabels.push({ x: xs(p.date), text: shortLabel(p.date) });
    });
  }

  const barMax = Math.max(1, ...points.filter((p) => !p.bootstrap).map((p) => p.new));
  const slot = points.length > 1 ? plotW / (points.length - 1) : plotW;
  const barW = Math.max(1, Math.min(7, slot * 0.55));
  const boundaryX = est.length && obs.length ? xs(firstObservedDay) : null;

  const hovered = hover === null ? null : points[hover];
  const hoverChange = (() => {
    if (!hovered) return null;
    const base = byDay.get(dayIndex(hovered.date) - 30);
    if (!base || base.open <= 0) return null;
    return { value: hovered.open / base.open - 1, estimated: hovered.estimated || base.estimated };
  })();
  const onMove = (clientX: number, rect: DOMRect) => {
    const x = clientX - rect.left - PAD.left;
    const i = Math.round((x / plotW) * (points.length - 1));
    setHover(Math.min(points.length - 1, Math.max(0, i)));
  };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      const step = e.key === 'ArrowLeft' ? -1 : 1;
      setHover((h) => Math.min(points.length - 1, Math.max(0, (h ?? points.length - 1) + step)));
    } else if (e.key === 'Escape') setHover(null);
  };

  const first = points[0] as SeriesPoint;
  const last = points.at(-1) as SeriesPoint;
  const newTotal = points.filter((p) => !p.bootstrap).reduce((n, p) => n + p.new, 0);
  const summary = `Open ${code} roles from ${formatDayLong(first.date)} (${fmtInt(first.open)}${first.estimated ? ', estimated' : ''}) to ${formatDayLong(last.date)} (${fmtInt(last.open)}). ${fmtInt(newTotal)} roles opened in this range.${est.length ? ` Values before ${formatDayLong(firstObservedDay)} are estimated.` : ''} Use the left and right arrow keys to read single days.`;
  const live = hovered
    ? `${formatDayLong(hovered.date)}: ${fmtInt(hovered.open)} open roles${hovered.estimated ? ' (estimated)' : ''}, ${fmtInt(hovered.new)} opened, ${fmtInt(hovered.closed)} closed`
    : '';

  return (
    <div className="pf-chart">
      <div className="pf-chart-head">
        <h2 className="chart-title">
          Open roles ({code})
          <span className="info" tabIndex={0} role="note" aria-label="About this chart">
            <Info size={14} aria-hidden="true" />
            <span className="info-tip">
              Open roles in this profession on today&apos;s boards. Daily changes are chain-linked on boards krill fetched on both
              days, so new boards do not count as growth. {note}
            </span>
          </span>
        </h2>
        <div className="range-toggle" role="group" aria-label="Chart range">
          {RANGES.map((r) => (
            <button key={r.id} type="button" aria-pressed={range === r.id} className={range === r.id ? 'is-active' : ''} onClick={() => setRange(r.id)}>
              {r.id}
            </button>
          ))}
        </div>
      </div>
      <div className="pf-chart-body">
        <div className="chart-plot" ref={wrap}>
          <svg
            width={width}
            height={height + BARS_GAP + BARS_H}
            role="img"
            tabIndex={0}
            aria-label={summary}
            onKeyDown={onKey}
            onBlur={() => setHover(null)}
            onMouseMove={(e) => onMove(e.clientX, e.currentTarget.getBoundingClientRect())}
            onMouseLeave={() => setHover(null)}
          >
            <defs>
              <linearGradient id={`g${gradId}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="var(--chart-line)" stopOpacity="0.42" />
                <stop offset="1" stopColor="var(--chart-line)" stopOpacity="0.02" />
              </linearGradient>
            </defs>
            {ticks.map((t) => (
              <g key={t} className="axis">
                <line x1={PAD.left} x2={width - PAD.right} y1={ys(t)} y2={ys(t)} className="grid" />
                <text x={PAD.left - 8} y={ys(t)} dy="0.32em" textAnchor="end">
                  {fmtAxis(t)}
                </text>
              </g>
            ))}
            {boundaryX !== null && (
              <g className="est-boundary">
                <rect x={PAD.left} y={PAD.top} width={Math.max(0, boundaryX - PAD.left)} height={plotH} className="est-zone" />
                <line x1={boundaryX} x2={boundaryX} y1={PAD.top} y2={PAD.top + plotH} />
                <text x={boundaryX - 6} y={PAD.top + 12} textAnchor="end">
                  estimated
                </text>
              </g>
            )}
            {est.length > 0 && <path d={area(estLine)} fill={`url(#g${gradId})`} opacity="0.45" />}
            {obs.length > 0 && <path d={area(obs)} fill={`url(#g${gradId})`} />}
            {est.length > 0 && <path d={path(estLine)} className="line line-est" />}
            {obs.length > 0 && <path d={path(obs)} className="line" />}
            {obs.length === 1 && <circle cx={xs((obs[0] as SeriesPoint).date)} cy={ys((obs[0] as SeriesPoint).open)} r="3" className="dot" />}
            {xLabels.map((l) => (
              <text key={`${l.x}-${l.text}`} x={l.x} y={height - 4} textAnchor="middle" className="axis-x">
                {l.text}
              </text>
            ))}
            <text x={0} y={height + BARS_GAP + BARS_H - 11} className="strip-label" aria-hidden="true">
              Daily
            </text>
            <text x={0} y={height + BARS_GAP + BARS_H - 1} className="strip-label" aria-hidden="true">
              postings
            </text>
            <g transform={`translate(0, ${height + BARS_GAP})`} className="bars">
              {points.map((p) => {
                const h = Math.min(1, p.new / barMax) * BARS_H;
                return (
                  <rect
                    key={p.date}
                    x={xs(p.date) - barW / 2}
                    y={BARS_H - h}
                    width={barW}
                    height={Math.max(0.5, h)}
                    className="bar-new"
                    opacity={p.estimated || p.bootstrap ? 0.45 : 1}
                  />
                );
              })}
            </g>
            {hovered && (
              <g className="crosshair" pointerEvents="none">
                <line x1={xs(hovered.date)} x2={xs(hovered.date)} y1={PAD.top} y2={height + BARS_GAP + BARS_H} />
                <circle cx={xs(hovered.date)} cy={ys(hovered.open)} r="4" />
              </g>
            )}
          </svg>
          {hovered && (
            <div
              className="chart-tip pf-tip"
              style={{ left: Math.min(width - 190, Math.max(0, xs(hovered.date) + 10)), top: 6 }}
              aria-hidden="true"
            >
              <strong>{formatDayLong(hovered.date)}</strong>
              {hovered.estimated && <em> · estimated</em>}
              {hovered.bootstrap && <em> · bootstrap day</em>}
              <span className="pf-tip-row">
                <span className="dot-open" /> Open roles <b className="num">{fmtInt(hovered.open)}</b>
              </span>
              {hoverChange && (
                <span className={`pf-tip-row ${hoverChange.value >= 0 ? 'chg-up' : 'chg-down'}`}>
                  {hoverChange.value >= 0 ? '▲' : '▼'} {hoverChange.value >= 0 ? '+' : '−'}
                  {fmtPct(hoverChange.value)} (1M){hoverChange.estimated ? '*' : ''}
                </span>
              )}
              <span className="pf-tip-row muted">
                New <b className="num">{fmtInt(hovered.new)}</b> · Closed <b className="num">{fmtInt(hovered.closed)}</b>
              </span>
            </div>
          )}
          <p className="sr-only" aria-live="polite">
            {live}
          </p>
          <table className="sr-only">
            <caption>Open roles per day in the selected range</caption>
            <thead>
              <tr>
                <th scope="col">Day</th>
                <th scope="col">Open roles</th>
                <th scope="col">Opened</th>
                <th scope="col">Closed</th>
              </tr>
            </thead>
            <tbody>
              {points.map((p) => (
                <tr key={p.date}>
                  <th scope="row">
                    {formatDayLong(p.date)}
                    {p.estimated ? ' (estimated)' : ''}
                  </th>
                  <td>{fmtInt(p.open)}</td>
                  <td>{fmtInt(p.new)}</td>
                  <td>{fmtInt(p.closed)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <dl className="pf-changes">
          {(['1W', '1M', '3M'] as const).map((r) => (
            <ChangeRow key={r} range={r} change={changes[r]} />
          ))}
        </dl>
      </div>
    </div>
  );
}

function ChangeRow({ range, change }: { range: '1W' | '1M' | '3M'; change: Change | null }) {
  return (
    <div>
      <dt>{range} change</dt>
      <dd>
        {change ? (
          <span className={`chg ${change.value >= 0 ? 'chg-up' : 'chg-down'}`}>
            <span aria-hidden="true">
              {change.value >= 0 ? '▲' : '▼'} {change.value >= 0 ? '+' : '−'}
              {fmtPct(change.value)}
              {change.partial || change.estimated ? '*' : ''}
            </span>
            <span className="sr-only">
              {change.value >= 0 ? 'up' : 'down'} {fmtPct(change.value)}
              {change.partial ? ` since ${shortLabel(change.baseDate)}` : change.estimated ? ' (estimated)' : ''}
            </span>
            {change.partial && (
              <small className="pf-since" aria-hidden="true">
                since {shortLabel(change.baseDate)}
              </small>
            )}
          </span>
        ) : (
          <span className="chg chg-flat" title="Needs more comparable days">
            <span aria-hidden="true">—</span>
            <span className="sr-only">not available yet</span>
          </span>
        )}
      </dd>
    </div>
  );
}
