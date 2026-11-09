import { Delta } from "@/components/data/Delta";
import { NO_FIGURE } from "@/content";

/** A change in a table cell; a dash when there is nothing to compare against. */
export function ChangeCell({ value }: { readonly value: number | null }) {
  return value === null ? (
    <span className="text-subtle">{NO_FIGURE}</span>
  ) : (
    <Delta value={value} />
  );
}
