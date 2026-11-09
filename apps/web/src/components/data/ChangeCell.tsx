import { Delta } from "@/components/data/Delta";
import { NO_FIGURE } from "@/content";

/** A change in a table cell: the figure, or a quiet dash until there is one. */
export function ChangeCell({
  change,
}: {
  readonly change: { readonly value: number } | null;
}) {
  if (change === null) {
    return <span className="text-subtle">{NO_FIGURE}</span>;
  }
  return <Delta value={change.value} />;
}
