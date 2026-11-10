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

const DAY_MS = 86_400_000;

/**
 * The ISO days of a daily series that ends on `end`, oldest first: every
 * sparkline is one point a day up to the day the numbers are from.
 */
export function daysEndingOn(end: string, count: number): string[] {
  const last = Date.parse(`${end.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(last) || count <= 0) return [];
  return Array.from({ length: count }, (_, index) =>
    new Date(last - (count - 1 - index) * DAY_MS).toISOString().slice(0, 10),
  );
}
