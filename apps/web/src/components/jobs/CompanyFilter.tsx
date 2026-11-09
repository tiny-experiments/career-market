import { Building2, Check } from "lucide-react";
import { useEffect, useState } from "react";
import { Logo } from "@/components/data/Logo";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { JOBS_LIST } from "@/content";
import { useResource } from "@/hooks";
import { companySearch, SEARCH_MIN_LENGTH } from "@/lib/api";
import { formatCount } from "@/lib/format";

const TYPING_PAUSE_MS = 150;

/** Pick an employer by name; anything typed that names none still filters by those words. */
export function CompanyFilter({
  value,
  label,
  onChange,
}: {
  /** What the address holds: a company's slug, or words typed. */
  readonly value: string | null;
  /** How the reader knows the selected company. */
  readonly label: string | null;
  readonly onChange: (company: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [settled, setSettled] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setSettled(query.trim()), TYPING_PAUSE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  const asking = settled.length >= SEARCH_MIN_LENGTH;
  const results = useResource(asking ? companySearch(settled) : null);
  const hits =
    results.data?.groups.find((group) => group.kind === "company")?.hits ?? [];
  const typed = query.trim();

  const choose = (company: string | null) => {
    onChange(company);
    setQuery("");
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          aria-label={value ? `Company: ${label ?? value}` : "Choose a company"}
          className="w-full justify-start font-normal"
        >
          <Building2 className="text-muted-foreground" aria-hidden />
          <span
            className={value ? "truncate" : "truncate text-muted-foreground"}
          >
            {value ? (label ?? value) : "Search company name"}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-0">
        <Command shouldFilter={false}>
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder="Search company name"
          />
          <CommandList>
            {asking && hits.length === 0 && !results.loading ? (
              <CommandEmpty>{JOBS_LIST.noCompany}</CommandEmpty>
            ) : null}
            {value ? (
              <CommandGroup>
                <CommandItem value="__clear" onSelect={() => choose(null)}>
                  {JOBS_LIST.anyCompany}
                </CommandItem>
              </CommandGroup>
            ) : null}
            {hits.length > 0 ? (
              <CommandGroup heading="Companies">
                {hits.map((hit) => (
                  <CommandItem
                    key={hit.id}
                    value={hit.id}
                    onSelect={() => choose(hit.slug)}
                  >
                    <Logo name={hit.label} domain={hit.domain} size="sm" />
                    <span className="min-w-0 flex-1 truncate font-medium">
                      {hit.label}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatCount(hit.open)}
                    </span>
                    {value === hit.slug ? <Check aria-hidden /> : null}
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}
            {typed.length >= SEARCH_MIN_LENGTH ? (
              <CommandGroup>
                <CommandItem value="__typed" onSelect={() => choose(typed)}>
                  {JOBS_LIST.companyContaining(typed)}
                </CommandItem>
              </CommandGroup>
            ) : null}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
