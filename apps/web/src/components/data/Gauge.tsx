import type { Direction } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface GaugeProps {
  /** Where the needle sits, 0 to 1. */
  readonly value: number;
  readonly tone?: Direction;
  readonly className?: string;
}

const STROKE: Record<Direction, string> = {
  up: "stroke-up",
  down: "stroke-down",
  flat: "stroke-subtle",
};

/**
 * A half ring filled to the value, with a dot at the end: the market's
 * temperature at a glance. The fill never passes half a turn, so the arc flag
 * stays small whatever the value.
 */
export function Gauge({ value, tone = "flat", className }: GaugeProps) {
  const clamped = Math.min(Math.max(value, 0), 1);
  const cx = 59;
  const cy = 60;
  const r = 51;
  const angle = Math.PI * (1 - clamped);
  const x = cx + r * Math.cos(angle);
  const y = cy - r * Math.sin(angle);

  return (
    <svg
      width={118}
      height={66}
      viewBox="0 0 118 66"
      aria-hidden="true"
      className={cn("overflow-visible", className)}
    >
      <path
        d={`M${cx - r} ${cy} A${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        fill="none"
        strokeWidth={9}
        strokeLinecap="round"
        className="stroke-border"
      />
      {clamped > 0 ? (
        <path
          d={`M${cx - r} ${cy} A${r} ${r} 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)}`}
          fill="none"
          strokeWidth={9}
          strokeLinecap="round"
          className={STROKE[tone]}
        />
      ) : null}
      <circle
        cx={x.toFixed(2)}
        cy={y.toFixed(2)}
        r={5}
        className="fill-foreground"
      />
    </svg>
  );
}
