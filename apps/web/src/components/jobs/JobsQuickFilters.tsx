import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { FILTER_LABEL, JOB_QUICK_FILTERS } from "@/content";
import type { JobFiltersState } from "@/hooks";
import { quickFilterPatch, quickFiltersOn } from "@/lib/jobFilters";
import { cn } from "@/lib/utils";

/**
 * One-click filters on the Jobs table: posted today, remote, pay listed. Each
 * is the same filter the rail sets, so either place turns it on or off.
 */
export function JobsQuickFilters({
  filters,
  className,
}: {
  readonly filters: JobFiltersState;
  readonly className?: string;
}) {
  const { params, update } = filters;
  return (
    <ToggleGroup
      type="multiple"
      variant="chip"
      aria-label={FILTER_LABEL.jobs}
      value={quickFiltersOn(params)}
      onValueChange={(on) => update(quickFilterPatch(params, on))}
      className={cn("flex-wrap", className)}
    >
      {JOB_QUICK_FILTERS.map((filter) => (
        <ToggleGroupItem key={filter.value} value={filter.value}>
          {filter.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
