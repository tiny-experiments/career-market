import { Menu } from "lucide-react";
import { useRef, useState } from "react";
import { Link, NavLink, useLocation } from "react-router";
import { BrandLockup } from "@/components/layout/BrandMark";
import { SearchBox, type SearchGroup } from "@/components/layout/SearchBox";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { UnderlineIndicator } from "@/components/layout/UnderlineIndicator";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useSlidingIndicator } from "@/hooks";
import { SECTIONS } from "@/lib/nav";
import { cn } from "@/lib/utils";

export interface TopNavProps {
  readonly searchGroups?: readonly SearchGroup[];
}

/**
 * The 56 px bar across the whole width: mark, the five sections, search and
 * the theme toggle. The active section is ink with a 2 px underline that
 * slides; nothing is filled. Under `md` the sections move into a sheet.
 */
export function TopNav({ searchGroups }: TopNavProps) {
  const location = useLocation();
  const row = useRef<HTMLElement>(null);
  const indicator = useSlidingIndicator(
    row,
    '[aria-current="page"]',
    location.pathname,
  );
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="flex h-nav items-center gap-4 px-gutter">
      <Link
        to="/"
        className="shrink-0 rounded-md"
        aria-label="Career Market home"
      >
        <BrandLockup />
      </Link>

      <nav
        ref={row}
        aria-label="Sections"
        className="relative hidden h-full items-stretch gap-1 md:flex"
      >
        {SECTIONS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            className={({ isActive }) =>
              cn(
                "inline-flex items-center px-3 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring",
                isActive && "text-foreground",
              )
            }
          >
            {item.label}
          </NavLink>
        ))}
        <UnderlineIndicator position={indicator} />
      </nav>

      <div className="ml-auto flex items-center gap-2">
        <SearchBox
          className="w-9 md:w-72 lg:w-96"
          {...(searchGroups ? { groups: searchGroups } : {})}
        />
        <ThemeToggle />
        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              aria-label="Open sections"
            >
              <Menu />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-72">
            <SheetHeader>
              <SheetTitle>Career Market</SheetTitle>
            </SheetHeader>
            <nav aria-label="Sections" className="flex flex-col px-2">
              {SECTIONS.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === "/"}
                  onClick={() => setMenuOpen(false)}
                  className={({ isActive }) =>
                    cn(
                      "rounded-lg px-3 py-2.5 text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-foreground",
                      isActive && "text-foreground",
                    )
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}
