import { fmtInt } from '@/lib/format';

/**
 * Trend line with a soft gradient under it, for the market context cards. The
 * text alternative gives the first, last, lowest and highest value.
 */
export function AreaSpark({
  values,
  label,
  tone,
  id,
}: {
  values: number[];
  label: string;
  tone: 'blue' | 'green';
  /** Unique per instance: the gradient id. */
  id: string;
}) {
  const W = 240;
  const H = 62;
  if (values.length < 2) {
    return (
      <div className="area-spark area-spark-empty">
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={`${label}: the trend appears after more days of data`}>
          <line x1="4" x2={W - 4} y1={H / 2} y2={H / 2} strokeDasharray="3 4" />
        </svg>
        <p className="area-spark-note">Trend appears after more days</p>
      </div>
    );
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pad = 6;
  const step = (W - 2) / (values.length - 1);
  const pts = values.map((v, i) => [1 + i * step, H - pad - ((v - min) / span) * (H - pad * 2)] as const);
  const line = pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const area = `${line} ${W - 1},${H} 1,${H}`;
  const first = values[0] as number;
  const last = values.at(-1) as number;
  const alt = `${label}: ${values.length} days, from ${fmtInt(first)} to ${fmtInt(last)}, lowest ${fmtInt(min)}, highest ${fmtInt(max)}`;
  return (
    <div className={`area-spark area-spark-${tone}`}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={alt}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="currentColor" stopOpacity="0.32" />
            <stop offset="1" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points={area} fill={`url(#${id})`} />
        <polyline points={line} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  );
}
