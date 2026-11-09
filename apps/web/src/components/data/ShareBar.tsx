import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

/** A 4 px bar under a percentage: the share as a length, the number above as the fact. */
export function ShareBar({
  value,
  className,
}: {
  /** A ratio from 0 to 1. */
  readonly value: number;
  readonly className?: string;
}) {
  return (
    <Progress
      value={Math.round(Math.min(Math.max(value, 0), 1) * 100)}
      aria-hidden
      className={cn("h-1 w-full bg-border", className)}
      indicatorClassName="bg-muted-foreground"
    />
  );
}
