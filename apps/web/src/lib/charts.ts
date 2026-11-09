export interface Point {
  readonly x: number;
  readonly y: number;
}

/** Values scaled into a box as points, with 2 px of padding so a line never clips its edge. */
export function sparklinePoints(
  values: readonly number[],
  width: number,
  height: number,
): Point[] {
  if (values.length === 0) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pad = 2;
  const stepX = values.length > 1 ? (width - pad * 2) / (values.length - 1) : 0;
  return values.map((value, index) => ({
    x: pad + index * stepX,
    y: pad + (height - pad * 2) * (1 - (value - min) / span),
  }));
}

/** An SVG path through the points. */
export function linePath(points: readonly Point[]): string {
  return points
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(" ");
}
