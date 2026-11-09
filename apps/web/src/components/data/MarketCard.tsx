import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface MarketCardPager {
  readonly page: number;
  readonly pageCount: number;
  readonly onPrev: () => void;
  readonly onNext: () => void;
}

export interface MarketCardProps {
  readonly title: string;
  /** The page the card opens; the header is the door. */
  readonly to: string;
  readonly pager?: MarketCardPager;
  readonly children: ReactNode;
  readonly className?: string;
}

/**
 * A home-page card: a bold title that links to its own page, a small pager
 * when there is more than one screen, and whatever sits inside. Equal height
 * with its neighbours; no auto-rotate.
 */
export function MarketCard({
  title,
  to,
  pager,
  children,
  className,
}: MarketCardProps) {
  return (
    <Card className={cn("h-full gap-3", className)}>
      <div className="flex items-center justify-between gap-3 px-4">
        <Link
          to={to}
          className="group/door inline-flex items-center gap-1 rounded-sm text-h2 font-bold outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-ring"
        >
          {title}
          <ChevronRight
            className="size-4 translate-y-px text-muted-foreground transition-transform group-hover/door:translate-x-0.5 group-hover/door:text-primary"
            aria-hidden
          />
        </Link>
        {pager && pager.pageCount > 1 ? (
          <div className="inline-flex items-center gap-0.5 text-eyebrow text-muted-foreground">
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label={`Previous ${title.toLowerCase()}`}
              disabled={pager.page <= 1}
              onClick={pager.onPrev}
            >
              <ChevronLeft />
            </Button>
            <span className="min-w-6 text-center tabular-nums">
              {pager.page}/{pager.pageCount}
            </span>
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label={`Next ${title.toLowerCase()}`}
              disabled={pager.page >= pager.pageCount}
              onClick={pager.onNext}
            >
              <ChevronRight />
            </Button>
          </div>
        ) : null}
      </div>
      <CardContent className="flex flex-1 flex-col gap-3">
        {children}
      </CardContent>
    </Card>
  );
}
