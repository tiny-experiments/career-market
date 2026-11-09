import { cn } from "@/lib/utils";

export interface LegendItem {
  readonly label: string;
  /** A background class from the series tokens: bg-chart-1, bg-primary/50. */
  readonly swatch: string;
  readonly dashed?: boolean;
}

/** Swatches with their names, under a chart or a stacked bar. */
export function Legend({
  items,
  className,
}: {
  readonly items: readonly LegendItem[];
  readonly className?: string;
}) {
  return (
    <ul
      className={cn(
        "flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground",
        className,
      )}
    >
      {items.map((item) => (
        <li key={item.label} className="inline-flex items-center gap-1.5">
          <span
            aria-hidden
            className={cn(
              "inline-block h-2.5 w-2.5 rounded-sm",
              item.swatch,
              item.dashed && "opacity-50",
            )}
          />
          {item.label}
        </li>
      ))}
    </ul>
  );
}
