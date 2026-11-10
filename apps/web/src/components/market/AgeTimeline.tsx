import { MARKET_COPY } from "@/content";

/**
 * A role's life so far as a line from the day it was posted to today, so an
 * age reads as time passed rather than a bare number of days.
 */
export function AgeTimeline() {
  return (
    <div aria-hidden className="mt-1 flex flex-col gap-1">
      <div className="relative flex h-2 items-center">
        <span className="h-0.5 w-full rounded-full bg-primary/50" />
        <span className="absolute left-0 size-2 rounded-full bg-primary" />
        <span className="absolute right-0 size-2 rounded-full border-2 border-primary bg-tile" />
      </div>
      <div className="flex justify-between text-eyebrow text-muted-foreground">
        <span>{MARKET_COPY.posted}</span>
        <span>{MARKET_COPY.today}</span>
      </div>
    </div>
  );
}
