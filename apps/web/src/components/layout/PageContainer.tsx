import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * The page's column: fluid to 1920 px with 24 px gutters, 20 px under the
 * chrome, sections 32–48 px apart (UI-RULEBOOK.md §3–4).
 */
export function PageContainer({
  children,
  className,
}: {
  readonly children: ReactNode;
  readonly className?: string;
}) {
  return (
    <div
      className={cn(
        "mx-auto flex w-full max-w-page flex-col gap-8 px-gutter pt-5 pb-16 lg:gap-12",
        className,
      )}
    >
      {children}
    </div>
  );
}
