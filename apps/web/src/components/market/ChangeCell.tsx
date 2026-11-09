import { Delta } from "@/components/data/Delta";

/** A change in a table cell; a dash when there is nothing to compare against. */
export function ChangeCell({ value }: { readonly value: number | null }) {
  return value === null ? (
    <span className="text-subtle">—</span>
  ) : (
    <Delta value={value} />
  );
}
