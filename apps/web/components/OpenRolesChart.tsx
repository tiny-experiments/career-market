'use client';

import { formatDayLong } from '@cm/core/dates';
import type { SeriesPoint } from '@cm/core/types';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { fmtCompact, fmtInt } from '@/lib/format';

const RANGES = [
  { id: '1W', days: 7 },
  { id: '1M', days: 30 },
  { id: '3M', days: 91 },
  { id: '1Y', days: 365 },
  { id: 'ALL', days: Infinity },
] as const;
type RangeId = (typeof RANGES)[number]['id'];

const DAY_MS = 86_400_000;
const PAD = { left: 46, right: 8, top: 10, bottom: 22 };
const BARS_H = 20;
const BARS_GAP = 6;

function niceTicks(min: number, max: number, count: number): number[] {
  const span = max - min || 1;
  const raw = span / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => span / s <= count) ?? 10 * mag;
  const ticks: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) ticks.push(v);
  return ticks;
}

function dayIndex(date: string): number {
  return Math.round(new Date(`${date}T00:00:00Z`).getTime() / DAY_MS);
}

function monthLabel(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
}

function shortLabel(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

/**
 * Open roles area chart with range toggles, plus new (green) and closed (red)
 * bars per day. The estimated part (back-cast) is dashed and lighter.
 */
export function OpenRolesChart({ series, firstObservedDay }: { series: SeriesPoint[]; firstObservedDay: string }) {
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

  const points = useMemo(() => {
    const days = RANGES.find((r) => r.id === range)?.days ?? Infinity;
    const last = series.at(-1);
    if (!last || !Number.isFinite(days)) return series;
    const from = dayIndex(last.date) - days;
    return series.filter((p) => dayIndex(p.date) > from);
  }, [series, range]);

  const height = 150;
  const plotW = width - PAD.left - PAD.right;
  const plotH = height - PAD.top - PAD.bottom;
  const totals = useMemo(() => {
    const counted = points.filter((p) => !p.bootstrap);
    return { new: counted.reduce((n, p) => n + p.new, 0), closed: counted.reduce((n, p) => n + p.closed, 0) };
  }, [points]);

  if (points.length === 0) return <p className="muted">No data yet.</p>;

  const values = points.map((p) => p.open);
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const padY = (hi - lo) * 0.12 || hi * 0.02 || 1;
  const ticks = niceTicks(lo - padY, hi + padY, 6);
  const yMin = Math.min(ticks[0] ?? lo, lo);
  const yMax = Math.max(ticks.at(-1) ?? hi, hi);
  const x0 = dayIndex((points[0] as SeriesPoint).date);
  const x1 = dayIndex((points.at(-1) as SeriesPoint).date);
  const xs = (date: string) => PAD.left + (x1 === x0 ? plotW / 2 : ((dayIndex(date) - x0) / (x1 - x0)) * plotW);
  const ys = (v: number) => PAD.top + plotH - ((v - yMin) / (yMax - yMin || 1)) * plotH;

  const path = (pts: SeriesPoint[]) => pts.map((p, i) => `${i ? 'L' : 'M'}${xs(p.date).toFixed(1)},${ys(p.open).toFixed(1)}`).join(' ');
  const est = points.filter((p) => p.estimated);
  const obs = points.filter((p) => !p.estimated);
  // Join the dashed estimate to the first observed point.
  const estLine = est.length && obs[0] ? [...est, obs[0]] : est;
  const area = (pts: SeriesPoint[]) =>
    pts.length ? `${path(pts)} L${xs((pts.at(-1) as SeriesPoint).date).toFixed(1)},${PAD.top + plotH} L${xs((pts[0] as SeriesPoint).date).toFixed(1)},${PAD.top + plotH} Z` : '';

  const spanDays = x1 - x0;
  const xLabels: { x: number; text: string }[] = [];
  if (spanDays > 62) {
    for (const p of points) if (p.date.endsWith('-01')) xLabels.push({ x: xs(p.date), text: monthLabel(p.date) });
  } else {
    const every = Math.max(1, Math.ceil(points.length / 7));
    points.forEach((p, i) => {
      if (i % every === 0 || i === points.length - 1) xLabels.push({ x: xs(p.date), text: shortLabel(p.date) });
    });
  }

  const barMax = Math.max(1, ...points.filter((p) => !p.bootstrap).map((p) => Math.max(p.new, p.closed)));
  const slot = points.length > 1 ? plotW / (points.length - 1) : plotW;
  const barW = Math.max(1, Math.min(8, slot * 0.36));
  const boundaryX = est.length && obs.length ? xs(firstObservedDay) : null;

  const hovered = hover === null ? null : points[hover];
  const onMove = (clientX: number, rect: DOMRect) => {
    const x = clientX - rect.left - PAD.left;
    const i = Math.round((x / plotW) * (points.length - 1));
    setHover(Math.min(points.length - 1, Math.max(0, i)));
  };

  const first = points[0] as SeriesPoint;
  const last = points.at(-1) as SeriesPoint;
  const summary = `Open roles from ${formatDayLong(first.date)} (${fmtInt(first.open)}${first.estimated ? ', estimated' : ''}) to ${formatDayLong(last.date)} (${fmtInt(last.open)}).${est.length ? ` Values before ${formatDayLong(firstObservedDay)} are estimated.` : ''} ${fmtInt(totals.new)} new roles and ${fmtInt(totals.closed)} closed roles in this range.`;

  return (
    <div className="chart-block">
      <div className="chart-head">
        <h2 className="chart-title">
          Open roles
          <span className="info" tabIndex={0} role="note" aria-label="About this chart">
            <span aria-hidden="true">i</span>
            <span className="info-tip">
              Open tech roles on today&apos;s boards. Daily changes are chain-linked on boards krill fetched on both
              days, so new boards do not count as growth.{est.length ? ' The dashed part before 2 Nov 2026 is an estimated back-cast.' : ''}
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
      <div className="chart-body">
        <div className="chart-plot" ref={wrap}>
          <svg
            width={width}
            height={height + BARS_GAP + BARS_H}
            role="img"
            aria-label={summary}
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
                  {fmtCompact(t)}
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
            <g transform={`translate(0, ${height + BARS_GAP})`} className="bars">
              {points.map((p) => {
                const cx = xs(p.date);
                const hn = Math.min(1, p.new / barMax) * BARS_H;
                const hc = Math.min(1, p.closed / barMax) * BARS_H;
                return (
                  <g key={p.date} opacity={p.estimated || p.bootstrap ? 0.45 : 1}>
                    <rect x={cx - barW} y={BARS_H - hn} width={barW} height={Math.max(0.5, hn)} className="bar-new" />
                    <rect x={cx} y={BARS_H - hc} width={barW} height={Math.max(0.5, hc)} className="bar-closed" />
                  </g>
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
              className="chart-tip"
              style={{ left: Math.min(width - 170, Math.max(0, xs(hovered.date) + 10)), top: 8 }}
              aria-hidden="true"
            >
              <strong>{formatDayLong(hovered.date)}</strong>
              {hovered.estimated && <em> · estimated</em>}
              {hovered.bootstrap && <em> · bootstrap day</em>}
              <span>
                Open <b className="num">{fmtInt(hovered.open)}</b>
              </span>
              <span>
                New <b className="num">{fmtInt(hovered.new)}</b> · Closed <b className="num">{fmtInt(hovered.closed)}</b>
              </span>
            </div>
          )}
        </div>
        <dl className="chart-legend">
          <div>
            <dt>
              <span className="dot-new" aria-hidden="true" /> New roles
            </dt>
            <dd className="num">{fmtInt(totals.new)}</dd>
          </div>
          <div>
            <dt>
              <span className="dot-closed" aria-hidden="true" /> Closed roles
            </dt>
            <dd className="num">{fmtInt(totals.closed)}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
