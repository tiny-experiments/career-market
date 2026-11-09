import { MetricHoverCard } from "@/components/common";
import { usualWindow, type JobVerdict } from "@/content";
import { formatDays } from "@/lib/format";
import { cn } from "@/lib/utils";

const percent = (value: number, end: number) =>
  `${Math.min(100, Math.max(0, (value / end) * 100))}%`;

/** Where this posting sits on the usual life of a role like it. */
export function TypicalWindowBar({
  ageDays,
  typical,
  className,
}: {
  readonly ageDays: number;
  readonly typical: NonNullable<JobVerdict["typical"]>;
  readonly className?: string;
}) {
  const { p25Days, p75Days, medianDays } = typical;
  const end = Math.max(p75Days * 1.4, ageDays * 1.1, 1);
  const usual = usualWindow(p25Days, p75Days);
  return (
    <figure className={cn("flex flex-col gap-2.5", className)}>
      <figcaption className="flex items-center justify-between gap-3 text-xs font-medium text-subtle">
        <span className="inline-flex items-center gap-1.5">
          Open for {formatDays(ageDays)}
          <MetricHoverCard title="Usual time open">
            {usual.hint}
          </MetricHoverCard>
        </span>
        <span>{usual.label}</span>
      </figcaption>
      <div
        role="img"
        aria-label={`Open for ${formatDays(ageDays)}. ${usual.hint}`}
        className="relative h-2 rounded-full bg-card"
      >
        <span
          className="absolute inset-y-0 rounded-full bg-muted-foreground/40"
          style={{
            left: percent(p25Days, end),
            width: percent(p75Days - p25Days, end),
          }}
        />
        <span
          className="absolute -inset-y-0.5 w-px bg-muted-foreground"
          style={{ left: percent(medianDays, end) }}
        />
        <span
          className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card bg-foreground"
          style={{ left: percent(ageDays, end) }}
        />
      </div>
    </figure>
  );
}
