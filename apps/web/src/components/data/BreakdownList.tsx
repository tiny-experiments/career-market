import type { ReactNode } from "react";
import { Link } from "react-router";
import { ShareBar } from "@/components/data/ShareBar";
import { cn } from "@/lib/utils";

export interface BreakdownItem {
  readonly key: string;
  readonly label: string;
  readonly value: string;
  /** A ratio from 0 to 1, drawn as the bar under the row. */
  readonly share: number;
  /** A background class from the series tokens, when the list keys a chart. */
  readonly swatch?: string;
  readonly to?: string;
}

/** The parts of something, largest first: name, figure and a bar. Rows may link. */
export function BreakdownList({
  items,
  className,
}: {
  readonly items: readonly BreakdownItem[];
  readonly className?: string;
}) {
  return (
    <ul className={cn("flex flex-col gap-1", className)}>
      {items.map((item) => (
        <li key={item.key}>
          <Row item={item} />
        </li>
      ))}
    </ul>
  );
}

function Row({ item }: { readonly item: BreakdownItem }) {
  const body: ReactNode = (
    <>
      <span className="flex items-baseline justify-between gap-3 text-sm">
        <span className="inline-flex min-w-0 items-center gap-2">
          {item.swatch === undefined ? null : (
            <span
              aria-hidden
              className={cn("size-2.5 shrink-0 rounded-sm", item.swatch)}
            />
          )}
          <span className="truncate font-semibold">{item.label}</span>
        </span>
        <span className="shrink-0 font-medium">{item.value}</span>
      </span>
      <ShareBar value={item.share} />
    </>
  );
  const classes = "-mx-2 flex flex-col gap-1.5 rounded-lg px-2 py-2";
  return item.to === undefined ? (
    <div className={classes}>{body}</div>
  ) : (
    <Link
      to={item.to}
      className={cn(
        classes,
        "outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring",
      )}
    >
      {body}
    </Link>
  );
}
