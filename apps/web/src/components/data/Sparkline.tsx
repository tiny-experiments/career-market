import { linePath, sparklinePoints } from "@/lib/charts";
import { direction, type Direction } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface SparklineProps {
  readonly values: readonly number[];
  /** Points before this index are estimated and drawn dashed. */
  readonly estimatedUntil?: number;
  readonly width?: number;
  readonly height?: number;
  readonly className?: string;
}

const STROKE: Record<Direction, string> = {
  up: "stroke-up",
  down: "stroke-down",
  flat: "stroke-subtle",
};

/**
 * A 120×34 line coloured by where it ends against where it starts. Decorative:
 * the number beside it carries the meaning.
 */
export function Sparkline({
  values,
  estimatedUntil = 0,
  width = 120,
  height = 34,
  className,
}: SparklineProps) {
  const points = sparklinePoints(values, width, height);
  const first = values[0] ?? 0;
  const last = values[values.length - 1] ?? 0;
  const tone = direction(first === 0 ? 0 : (last - first) / Math.abs(first));
  const cut = Math.min(Math.max(estimatedUntil, 0), points.length);
  const estimated = cut > 1 ? points.slice(0, cut) : [];
  const actual = cut > 0 ? points.slice(cut - 1) : points;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
      data-direction={tone}
      className={cn("shrink-0 overflow-visible", STROKE[tone], className)}
    >
      {estimated.length > 1 ? (
        <path
          d={linePath(estimated)}
          fill="none"
          strokeWidth={1.6}
          strokeDasharray="3 3"
          strokeLinecap="round"
          data-segment="estimated"
        />
      ) : null}
      {actual.length > 1 ? (
        <path
          d={linePath(actual)}
          fill="none"
          strokeWidth={1.6}
          strokeLinecap="round"
          strokeLinejoin="round"
          data-segment="actual"
        />
      ) : null}
    </svg>
  );
}
