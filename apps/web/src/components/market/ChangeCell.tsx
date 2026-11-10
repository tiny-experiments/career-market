import { Delta } from "@/components/data/Delta";
import { NO_FIGURE } from "@/content";

/** A change in a table cell; a dash when there is nothing to compare against. */
export function ChangeCell({
  value,
  size = "md",
}: {
  readonly value: number | null;
  /** Small for the line under a figure on a phone. */
  readonly size?: "sm" | "md";
}) {
  return value === null ? (
    <span className="text-subtle">{NO_FIGURE}</span>
  ) : (
    <Delta value={value} size={size} />
  );
}
