import { Legend } from "@/components/data/Legend";
import { formatShare } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface Segment {
  readonly label: string;
  /** A ratio; the segments should sum to about 1. */
  readonly share: number;
  /** A background class from the series tokens. */
  readonly swatch: string;
}

/** Parts of a whole as one bar, with the legend carrying each part's share. */
export function SegmentBar({
  segments,
  className,
}: {
  readonly segments: readonly Segment[];
  readonly className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div
        className="flex h-2.5 w-full overflow-hidden rounded-full bg-border"
        aria-hidden
      >
        {segments.map((segment) => (
          <span
            key={segment.label}
            className={cn("h-full", segment.swatch)}
            style={{ width: `${Math.max(segment.share, 0) * 100}%` }}
          />
        ))}
      </div>
      <Legend
        items={segments.map((segment) => ({
          label: `${segment.label} ${formatShare(segment.share)}`,
          swatch: segment.swatch,
        }))}
      />
    </div>
  );
}
