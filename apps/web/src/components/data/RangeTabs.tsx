import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

export interface RangeOption<Value extends string> {
  readonly value: Value;
  readonly label: string;
}

export interface RangeTabsProps<Value extends string> {
  readonly value: Value;
  readonly onChange: (value: Value) => void;
  readonly options: readonly RangeOption<Value>[];
  readonly label?: string;
  readonly className?: string;
}

/** A chart's range as a 32 px segmented control: the chosen range lifts as a tile. */
export function RangeTabs<Value extends string>({
  value,
  onChange,
  options,
  label = "Range",
  className,
}: RangeTabsProps<Value>) {
  return (
    <Tabs
      value={value}
      onValueChange={(next) => onChange(next as Value)}
      className={cn("w-fit", className)}
    >
      <TabsList aria-label={label}>
        {options.map((option) => (
          <TabsTrigger
            key={option.value}
            value={option.value}
            className="px-2.5 text-xs font-semibold"
          >
            {option.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
