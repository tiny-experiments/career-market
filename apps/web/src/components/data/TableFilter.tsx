import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

/** On a phone a row of chips stays on one line that scrolls sideways, edge to edge. */
export const PHONE_CHIP_ROW =
  "max-md:-mx-gutter max-md:w-auto max-md:flex-nowrap max-md:overflow-x-auto max-md:px-gutter max-md:scrollbar-none";

export interface TableFilterOption<T extends string> {
  readonly value: T;
  readonly label: string;
  /** What the table shows with this choice, in one line under the row. */
  readonly description?: string;
}

export interface TableFilterProps<T extends string> {
  /** The group's accessible name: "Show professions". */
  readonly label: string;
  readonly options: readonly TableFilterOption<T>[];
  readonly value: T;
  readonly onChange: (next: T) => void;
  readonly className?: string;
}

/**
 * The choices that narrow the table right under them: a row of chips, one on
 * at a time, with a line that says what the chosen one shows. It sits on the
 * table it filters, never above the page. On a phone the row is one line
 * that scrolls sideways.
 */
export function TableFilter<T extends string>({
  label,
  options,
  value,
  onChange,
  className,
}: TableFilterProps<T>) {
  const description = options.find(
    (option) => option.value === value,
  )?.description;

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <ToggleGroup
        type="single"
        variant="chip"
        aria-label={label}
        value={value}
        onValueChange={(next) => {
          const chosen = options.find((option) => option.value === next);
          if (chosen) onChange(chosen.value);
        }}
        className={cn("w-full flex-wrap", PHONE_CHIP_ROW)}
      >
        {options.map((option) => (
          <ToggleGroupItem key={option.value} value={option.value}>
            {option.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      {description ? (
        <p className="text-small text-muted-foreground" aria-live="polite">
          {description}
        </p>
      ) : null}
    </div>
  );
}
