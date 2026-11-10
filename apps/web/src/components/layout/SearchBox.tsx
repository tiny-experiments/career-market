import { Search } from "lucide-react";
import { useEffect, useEffectEvent, useState, type ReactNode } from "react";
import { useNavigate } from "react-router";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { cn } from "@/lib/utils";

export interface SearchResult {
  readonly id: string;
  readonly label: string;
  /** A muted line after the label: the code, the domain, the company. */
  readonly hint?: string;
  readonly to: string;
  readonly logo?: ReactNode;
}

export interface SearchGroup {
  readonly heading: string;
  readonly items: readonly SearchResult[];
}

export interface SearchBoxProps {
  /** Results to show for the current query; the caller fetches, this draws. */
  readonly groups?: readonly SearchGroup[];
  readonly query?: string;
  readonly onQueryChange?: (query: string) => void;
  /** Results are on their way. */
  readonly loading?: boolean;
  /** Narrow `groups` by the query here; off when the server already matched them. */
  readonly filter?: boolean;
  readonly onOpenChange?: (open: boolean) => void;
  readonly className?: string;
}

const PLACEHOLDER = "Search professions, companies, skills, jobs";

/**
 * Global search: a field-shaped button in the nav that opens a command
 * dialog. `/` and ⌘K open it from anywhere; choosing a result navigates.
 */
export function SearchBox({
  groups = [],
  query,
  onQueryChange,
  loading = false,
  filter = true,
  onOpenChange,
  className,
}: SearchBoxProps) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const announceOpen = useEffectEvent((next: boolean) => onOpenChange?.(next));

  useEffect(() => {
    announceOpen(open);
  }, [open]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target?.isContentEditable === true;
      if (
        (event.key === "k" && (event.metaKey || event.ctrlKey)) ||
        (event.key === "/" && !typing)
      ) {
        event.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const hasResults = groups.some((group) => group.items.length > 0);
  const asked = hasResults || (query ?? "").trim() !== "";

  return (
    <>
      <Button
        variant="outline"
        aria-label={PLACEHOLDER}
        onClick={() => setOpen(true)}
        className={cn(
          "h-control w-full justify-start gap-2 pr-1.5 pl-2.5 font-normal text-muted-foreground",
          className,
        )}
      >
        <Search className="size-4 shrink-0" aria-hidden />
        <span className="hidden flex-1 truncate text-left text-small md:inline">
          {PLACEHOLDER}
        </span>
        <Kbd className="ml-auto hidden md:inline-flex">/</Kbd>
      </Button>
      <CommandDialog
        // On a phone the dialog sits at the top, above the keyboard.
        className="max-md:top-4"
        open={open}
        onOpenChange={setOpen}
        title="Search"
        description={PLACEHOLDER}
      >
        <Command shouldFilter={filter}>
          <CommandInput
            placeholder={PLACEHOLDER}
            {...(query === undefined ? {} : { value: query })}
            {...(onQueryChange ? { onValueChange: onQueryChange } : {})}
          />
          <CommandList>
            <CommandEmpty>
              {!asked
                ? "Start typing to search professions, companies, skills and jobs."
                : loading
                  ? "Searching…"
                  : "Nothing matches that yet."}
            </CommandEmpty>
            {groups.map((group) =>
              group.items.length === 0 ? null : (
                <CommandGroup key={group.heading} heading={group.heading}>
                  {group.items.map((item) => (
                    <CommandItem
                      key={item.id}
                      value={`${group.heading} ${item.label} ${item.hint ?? ""}`}
                      onSelect={() => {
                        setOpen(false);
                        void navigate(item.to);
                      }}
                    >
                      {item.logo}
                      <span className="min-w-0 flex-1 truncate font-medium">
                        {item.label}
                      </span>
                      {item.hint === undefined ? null : (
                        <span className="max-w-1/2 truncate text-xs text-muted-foreground">
                          {item.hint}
                        </span>
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              ),
            )}
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  );
}
