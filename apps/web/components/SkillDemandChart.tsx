'use client';

import { formatDayLong } from '@cm/core/dates';
import { SKILL_CHART_RANGES, type SkillSeriesPoint } from '@cm/core/skills';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { fmtCompact, fmtInt } from '@/lib/format';

type RangeId = (typeof SKILL_CHART_RANGES)[number];
const RANGE_DAYS: Record<RangeId, number> = { '1W': 7, '1M': 30, '3M': 91 };

const DAY_MS = 86_400_000;
const PAD = { left: 46, right: 8, top: 10, bottom: 24 };
const HEIGHT = 168;

function niceTicks(min: number, max: number, count: number): number[] {
  const span = max - min || 1;
  const raw = span / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => span / s <= count) ?? 10 * mag;
  const ticks: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) ticks.push(v);
  return ticks;
}

const dayIndex = (date: string) => Math.round(new Date(`${date}T00:00:00Z`).getTime() / DAY_MS);
const monthLabel = (date: string) => new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
const shortLabel = (date: string) => new Date(`${date}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });

/**
 * Roles naming one skill over time: an area chart with a 1W / 1M / 3M toggle.
 * Days before the first observed count are estimated (a back-cast) and drawn
 * dashed and lighter, with the boundary labelled.
 */
export function SkillDemandChart({
  series,
  firstObservedDay,
  skillLabel,
  scopeLabel,
  note,
}: {
  series: SkillSeriesPoint[];
  firstObservedDay: string;
  skillLabel: string;
  /** The profession the count is inside, e.g. "AI & ML". */
  scopeLabel: string;
  note: string;
}) {
  const [range, setRange] = useState<RangeId>('3M');
  const [hover, setHover] = useState<number | null>(null);
  const [width, setWidth] = useState(960);
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
    const last = series.at(-1);
    if (!last) return [];
    const from = dayIndex(last.date) - RANGE_DAYS[range];
    return series.filter((p) => dayIndex(p.date) > from);
  }, [series, range]);

  const plotW = width - PAD.left - PAD.right;
  const plotH = HEIGHT - PAD.top - PAD.bottom;

  const toggle = (
    <div className="range-toggle" role="group" aria-label="Chart range">
      {SKILL_CHART_RANGES.map((r) => (
        <button key={r} type="button" aria-pressed={range === r} className={range === r ? 'is-active' : ''} onClick={() => setRange(r)}>
          {r}
        </button>
      ))}
    </div>
  );
  const head = (
    <div className="skill-chart-head">
      <h2 className="chart-title">
        Roles naming {skillLabel}
        <span className="info" tabIndex={0} role="note" aria-label={`About the ${skillLabel} chart`}>
          <span aria-hidden="true">i</span>
          <span className="info-tip">
            Open {scopeLabel} roles that name {skillLabel}, on today&apos;s boards: daily moves are chain-linked on boards krill fetched on both
            days, so new boards do not count as growth. The dashed part is an estimated back-cast.
          </span>
        </span>
      </h2>
      {toggle}
    </div>
  );

  if (points.length === 0) {
    return (
      <div className="chart-block">
        {head}
        <p className="muted">No data yet.</p>
      </div>
    );
  }

  const values = points.map((p) => p.open);
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const padY = (hi - lo) * 0.12 || hi * 0.02 || 1;
  const ticks = niceTicks(lo - padY, hi + padY, 6);
  const yMin = Math.min(ticks[0] ?? lo, lo);
  const yMax = Math.max(ticks.at(-1) ?? hi, hi);
  const x0 = dayIndex((points[0] as SkillSeriesPoint).date);
  const x1 = dayIndex((points.at(-1) as SkillSeriesPoint).date);
  const xs = (date: string) => PAD.left + (x1 === x0 ? plotW / 2 : ((dayIndex(date) - x0) / (x1 - x0)) * plotW);
  const ys = (v: number) => PAD.top + plotH - ((v - yMin) / (yMax - yMin || 1)) * plotH;

  const path = (pts: SkillSeriesPoint[]) => pts.map((p, i) => `${i ? 'L' : 'M'}${xs(p.date).toFixed(1)},${ys(p.open).toFixed(1)}`).join(' ');
  const est = points.filter((p) => p.estimated);
  const obs = points.filter((p) => !p.estimated);
  const estLine = est.length && obs[0] ? [...est, obs[0]] : est;
  const area = (pts: SkillSeriesPoint[]) =>
    pts.length ? `${path(pts)} L${xs((pts.at(-1) as SkillSeriesPoint).date).toFixed(1)},${PAD.top + plotH} L${xs((pts[0] as SkillSeriesPoint).date).toFixed(1)},${PAD.top + plotH} Z` : '';

  const xLabels: { x: number; text: string }[] = [];
  if (x1 - x0 > 62) {
    for (const p of points) if (p.date.endsWith('-01')) xLabels.push({ x: xs(p.date), text: monthLabel(p.date) });
  } else {
    const every = Math.max(1, Math.ceil(points.length / 7));
    points.forEach((p, i) => {
      if (i % every === 0 || i === points.length - 1) xLabels.push({ x: xs(p.date), text: shortLabel(p.date) });
    });
  }

  const boundaryX = est.length && obs.length ? xs(firstObservedDay) : null;
  const hovered = hover === null ? null : points[hover];
  const onMove = (clientX: number, rect: DOMRect) => {
    const i = Math.round(((clientX - rect.left - PAD.left) / plotW) * (points.length - 1));
    setHover(Math.min(points.length - 1, Math.max(0, i)));
  };

  const first = points[0] as SkillSeriesPoint;
  const last = points.at(-1) as SkillSeriesPoint;
  const summary = `${scopeLabel} roles naming ${skillLabel}, from ${formatDayLong(first.date)} (${fmtInt(first.open)}${first.estimated ? ', estimated' : ''}) to ${formatDayLong(last.date)} (${fmtInt(last.open)}). Lowest ${fmtInt(lo)}, highest ${fmtInt(hi)}.${est.length ? ` Values before ${formatDayLong(firstObservedDay)} are estimated.` : ''}`;

  return (
    <div className="chart-block">
      {head}
      <div className="chart-plot skill-chart-plot" ref={wrap}>
        <svg
          width={width}
          height={HEIGHT}
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
          {obs.length === 1 && <circle cx={xs((obs[0] as SkillSeriesPoint).date)} cy={ys((obs[0] as SkillSeriesPoint).open)} r="3" className="dot" />}
          {xLabels.map((l) => (
            <text key={`${l.x}-${l.text}`} x={l.x} y={HEIGHT - 6} textAnchor="middle" className="axis-x">
              {l.text}
            </text>
          ))}
          {hovered && (
            <g className="crosshair" pointerEvents="none">
              <line x1={xs(hovered.date)} x2={xs(hovered.date)} y1={PAD.top} y2={PAD.top + plotH} />
              <circle cx={xs(hovered.date)} cy={ys(hovered.open)} r="4" />
            </g>
          )}
        </svg>
        {hovered && (
          <div className="chart-tip" style={{ left: Math.min(width - 170, Math.max(0, xs(hovered.date) + 10)), top: 8 }} aria-hidden="true">
            <strong>{formatDayLong(hovered.date)}</strong>
            {hovered.estimated && <em> · estimated</em>}
            <span>
              Roles <b className="num">{fmtInt(hovered.open)}</b>
            </span>
          </div>
        )}
      </div>
      <p className="chart-note skill-chart-note">{note}</p>
    </div>
  );
}
