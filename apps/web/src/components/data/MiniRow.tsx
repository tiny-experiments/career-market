import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * On a phone, one line of mini tiles that runs edge to edge of the screen,
 * scrolls sideways and snaps tile by tile; the next tile peeking at the edge
 * says there is more. From `md` up it has no layout of its own, so a desktop
 * grid passed as `className` (`grid grid-cols-2 gap-2`) stays exactly as it was.
 */
export function MiniRow({
  label,
  children,
  className,
}: {
  /** What the row holds, for assistive tech: "Market at a glance". */
  readonly label?: string;
  readonly children: ReactNode;
  readonly className?: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        className,
        "max-md:-mx-gutter max-md:flex max-md:snap-x max-md:snap-mandatory max-md:scroll-px-gutter max-md:gap-2 max-md:overflow-x-auto max-md:overscroll-x-contain max-md:px-gutter max-md:scrollbar-none max-md:*:shrink-0 max-md:*:snap-start",
      )}
    >
      {children}
    </div>
  );
}
