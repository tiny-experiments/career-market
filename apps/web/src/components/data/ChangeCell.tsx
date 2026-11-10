import { Delta } from "@/components/data/Delta";
import { NO_FIGURE } from "@/content";

/** A change in a table cell: the figure, or a quiet dash until there is one. */
export function ChangeCell({
  change,
  size = "md",
}: {
  readonly change: { readonly value: number } | null;
  /** Small for the line under a figure on a phone. */
  readonly size?: "sm" | "md";
}) {
  if (change === null) {
    return <span className="text-subtle">{NO_FIGURE}</span>;
  }
  return <Delta value={change.value} size={size} />;
}
