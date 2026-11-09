import { CalendarClock, History, Repeat, Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type Verdict = "first-time" | "reposted" | "evergreen" | "closing-soon";

const VERDICTS: Record<
  Verdict,
  {
    readonly label: string;
    readonly icon: LucideIcon;
    readonly variant: "up" | "flat" | "warn" | "down";
  }
> = {
  "first-time": { label: "First time posted", icon: Sparkles, variant: "up" },
  reposted: { label: "Reposted", icon: Repeat, variant: "warn" },
  evergreen: { label: "Likely evergreen", icon: History, variant: "flat" },
  "closing-soon": {
    label: "Closing soon",
    icon: CalendarClock,
    variant: "down",
  },
};

export interface VerdictCardProps {
  readonly verdict: Verdict;
  /** The one-line read of this posting: "Posted 3 days ago, first time we have seen it." */
  readonly summary: string;
  /** Short facts under it: times reposted, typical window, days open. */
  readonly facts?: readonly {
    readonly label: string;
    readonly value: string;
  }[];
  readonly className?: string;
}

/** The first thing on a job page: what kind of posting this is, in a sentence, with its facts. */
export function VerdictCard({
  verdict,
  summary,
  facts,
  className,
}: VerdictCardProps) {
  const { label, icon: Icon, variant } = VERDICTS[verdict];
  return (
    <Card className={cn("gap-3", className)}>
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Icon className="size-4 text-muted-foreground" aria-hidden />
          <Badge variant={variant} size="md">
            {label}
          </Badge>
        </div>
        <p className="text-body font-medium">{summary}</p>
        {facts && facts.length > 0 ? (
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {facts.map((fact) => (
              <div
                key={fact.label}
                className="flex flex-col gap-0.5 rounded-lg bg-tile px-3 py-2"
              >
                <dt className="text-eyebrow font-semibold text-muted-foreground">
                  {fact.label}
                </dt>
                <dd className="text-sm font-bold">{fact.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
      </CardContent>
    </Card>
  );
}
