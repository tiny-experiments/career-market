import { useRef } from "react";
import { Link, useLocation } from "react-router";
import { UnderlineIndicator } from "@/components/layout/UnderlineIndicator";
import { useSlidingIndicator } from "@/hooks";
import { isTabActive, type SubBarTab } from "@/lib/nav";
import { cn } from "@/lib/utils";

export interface SubBarProps {
  readonly tabs: readonly SubBarTab[];
  readonly className?: string;
}

/**
 * The second level under the nav: a section's views as a 46 px row of links.
 * Same underline treatment as the nav, no fill; views live in the URL so a
 * link opens the same one.
 */
export function SubBar({ tabs, className }: SubBarProps) {
  const location = useLocation();
  const row = useRef<HTMLElement>(null);
  const indicator = useSlidingIndicator(
    row,
    '[aria-current="page"]',
    `${location.pathname}${location.search}`,
  );

  return (
    <nav
      ref={row}
      aria-label="Views"
      className={cn(
        "no-scrollbar relative flex h-subbar items-stretch gap-1 overflow-x-auto px-gutter",
        className,
      )}
    >
      {tabs.map((tab) => {
        const active = isTabActive(tab, location);
        return (
          <Link
            key={tab.to}
            to={tab.to}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex shrink-0 items-center px-3 text-sm font-medium whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring",
              active && "font-semibold text-foreground",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
      <UnderlineIndicator position={indicator} />
    </nav>
  );
}
