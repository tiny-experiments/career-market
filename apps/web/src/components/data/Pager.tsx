import { ChevronLeft, ChevronRight } from "lucide-react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
} from "@/components/ui/pagination";
import { pageWindow } from "@/lib/paging";
import { cn } from "@/lib/utils";

export interface PagerProps {
  readonly page: number;
  readonly pageCount: number;
  readonly hrefFor: (page: number) => string;
  readonly className?: string;
}

/** 50 a page, compact numbers, every control a real link so pages share and open in new tabs. */
export function Pager({ page, pageCount, hrefFor, className }: PagerProps) {
  if (pageCount <= 1) return null;
  const items = pageWindow(page, pageCount);

  return (
    <Pagination className={cn("justify-end", className)}>
      <PaginationContent>
        <PaginationItem>
          <PagerLink
            to={page > 1 ? hrefFor(page - 1) : null}
            label="Previous page"
          >
            <ChevronLeft />
          </PagerLink>
        </PaginationItem>
        {items.map((item, index) =>
          item === null ? (
            <PaginationItem key={`gap-${index}`}>
              <PaginationEllipsis />
            </PaginationItem>
          ) : (
            <PaginationItem key={item}>
              <PagerLink
                to={hrefFor(item)}
                label={`Page ${item}`}
                current={item === page}
              >
                {item}
              </PagerLink>
            </PaginationItem>
          ),
        )}
        <PaginationItem>
          <PagerLink
            to={page < pageCount ? hrefFor(page + 1) : null}
            label="Next page"
          >
            <ChevronRight />
          </PagerLink>
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}

function PagerLink({
  to,
  label,
  current = false,
  children,
}: {
  readonly to: string | null;
  readonly label: string;
  readonly current?: boolean;
  readonly children: React.ReactNode;
}) {
  if (to === null) {
    return (
      <Button variant="ghost" size="icon" disabled aria-label={label}>
        {children}
      </Button>
    );
  }
  return (
    <Button asChild variant={current ? "outline" : "ghost"} size="icon">
      <Link
        to={to}
        aria-label={label}
        aria-current={current ? "page" : undefined}
      >
        {children}
      </Link>
    </Button>
  );
}
