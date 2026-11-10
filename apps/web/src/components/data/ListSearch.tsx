import { Search } from "lucide-react";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { useListSearch } from "@/hooks/useListSearch";
import { cn } from "@/lib/utils";

/** The box above a list that narrows it by name. */
export function ListSearch({
  label,
  className,
}: {
  /** The placeholder and the field's name: "Search companies". */
  readonly label: string;
  readonly className?: string;
}) {
  const [value, setValue] = useListSearch();
  return (
    <InputGroup
      className={cn("h-control w-full max-md:h-touch sm:w-72", className)}
    >
      <InputGroupAddon>
        <Search aria-hidden />
      </InputGroupAddon>
      <InputGroupInput
        type="search"
        className="max-md:h-full"
        aria-label={label}
        placeholder={label}
        value={value}
        onChange={(event) => setValue(event.target.value)}
      />
    </InputGroup>
  );
}
