import { Link } from "react-router";
import { Delta } from "@/components/data/Delta";
import { cn } from "@/lib/utils";

export interface TickerItem {
  readonly label: string;
  readonly value: string;
  /** A ratio; omitted when the figure has no comparison. */
  readonly change?: number;
  readonly to?: string;
}

export interface TickerStripProps {
  readonly items: readonly TickerItem[];
  readonly className?: string;
}

/**
 * A thin strip of headline figures that slides left and pauses under the
 * pointer. The list is drawn twice so the loop is seamless; the copy is read
 * once by assistive tech.
 */
export function TickerStrip({ items, className }: TickerStripProps) {
  if (items.length === 0) return null;
  const duration = `${Math.max(30, items.length * 6)}s`;

  return (
    <div
      className={cn(
        "ticker-strip relative h-8 overflow-hidden border-b bg-card text-xs",
        className,
      )}
      style={{ "--ticker-duration": duration } as React.CSSProperties}
      aria-label="Market headline figures"
    >
      <div className="ticker-track flex h-full w-max items-center">
        {[0, 1].map((copy) => (
          <ul
            key={copy}
            aria-hidden={copy === 1}
            className="flex h-full items-center"
          >
            {items.map((item) => (
              <li key={item.label} className="flex items-center">
                <TickerEntry item={item} />
                <span aria-hidden className="mx-5 h-3 w-px bg-border" />
              </li>
            ))}
          </ul>
        ))}
      </div>
    </div>
  );
}

function TickerEntry({ item }: { readonly item: TickerItem }) {
  const body = (
    <>
      <span className="text-muted-foreground">{item.label}</span>
      <span className="font-semibold text-primary">{item.value}</span>
      {item.change === undefined ? null : (
        <Delta value={item.change} size="sm" />
      )}
    </>
  );
  const classes = "inline-flex items-center gap-1.5 whitespace-nowrap";
  return item.to ? (
    <Link to={item.to} className={cn(classes, "hover:underline")}>
      {body}
    </Link>
  ) : (
    <span className={classes}>{body}</span>
  );
}
