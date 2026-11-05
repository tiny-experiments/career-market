/** Small trend line for table rows. Green when the series ends higher than it starts, red when lower. */
export function Sparkline({ values, width = 64, height = 22, label }: { values: number[]; width?: number; height?: number; label: string }) {
  if (values.length < 2) {
    return (
      <svg width={width} height={height} role="img" aria-label={`${label}: trend appears after more days`} className="spark spark-flat">
        <line x1="2" x2={width - 2} y1={height / 2} y2={height / 2} strokeDasharray="2 3" />
      </svg>
    );
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const step = (width - 4) / (values.length - 1);
  const points = values.map((v, i) => `${(2 + i * step).toFixed(1)},${(height - 3 - ((v - min) / span) * (height - 6)).toFixed(1)}`);
  const up = (values.at(-1) as number) >= (values[0] as number);
  return (
    <svg width={width} height={height} role="img" aria-label={`${label}: ${up ? 'rising' : 'falling'} over ${values.length} days`} className={`spark ${up ? 'spark-up' : 'spark-down'}`}>
      <polyline points={points.join(' ')} />
    </svg>
  );
}
