import { Check, Clock, Infinity as EverOpen, Repeat } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { MetricHoverCard } from "@/components/common";
import { Badge } from "@/components/ui/badge";
import {
  JOB_PAGE,
  VERDICT_HINT,
  VERDICT_LABEL,
  type VerdictKind,
} from "@/content";
import { cn } from "@/lib/utils";

export type Verdict = VerdictKind;

const VERDICTS: Record<
  Verdict,
  {
    readonly icon: LucideIcon;
    readonly variant: "up" | "flat" | "warn" | "down";
    readonly band: string;
    readonly disc: string;
  }
> = {
  "first-time": {
    icon: Check,
    variant: "up",
    band: "bg-up-soft",
    disc: "bg-up",
  },
  reposted: {
    icon: Repeat,
    variant: "warn",
    band: "bg-warn-soft",
    disc: "bg-warn",
  },
  evergreen: {
    icon: EverOpen,
    variant: "flat",
    band: "bg-flat-soft",
    disc: "bg-flat",
  },
  "closing-soon": {
    icon: Clock,
    variant: "down",
    band: "bg-down-soft",
    disc: "bg-down",
  },
};

export interface VerdictCardProps {
  readonly verdict: Verdict;
  /** The bold line: "First time posted · 5 days ago". */
  readonly headline?: string;
  /** The one-line read of this posting. */
  readonly summary: string;
  /** Short facts under it: times reposted, typical window, days open. */
  readonly facts?: readonly {
    readonly label: string;
    readonly value: string;
  }[];
  /** Beside the words on wide screens: the posting against its window. */
  readonly children?: ReactNode;
  readonly className?: string;
}

/** The first thing on a job page: what kind of posting this is, in a sentence. */
export function VerdictCard({
  verdict,
  headline,
  summary,
  facts,
  children,
  className,
}: VerdictCardProps) {
  const { icon: Icon, variant, band, disc } = VERDICTS[verdict];
  const label = VERDICT_LABEL[verdict];
  return (
    <section
      aria-label={JOB_PAGE.verdictRegion}
      className={cn(
        "flex flex-col gap-5 rounded-xl p-5 lg:flex-row lg:items-center lg:gap-10",
        band,
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 items-start gap-4">
        <span
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-full text-background",
            disc,
          )}
        >
          <Icon className="size-5" aria-hidden />
        </span>
        <div className="flex min-w-0 flex-col gap-1.5">
          <div className="flex items-center gap-2">
            {headline === undefined ? (
              <Badge variant={variant} size="md" className="bg-card">
                {label}
              </Badge>
            ) : (
              <p className="text-h2 font-bold">{headline}</p>
            )}
            <MetricHoverCard title={label}>
              {VERDICT_HINT[verdict]}
            </MetricHoverCard>
          </div>
          <p className="text-body text-subtle">{summary}</p>
          {facts && facts.length > 0 ? (
            <dl className="mt-1 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {facts.map((fact) => (
                <div
                  key={fact.label}
                  className="flex flex-col gap-0.5 rounded-lg bg-card px-3 py-2"
                >
                  <dt className="text-eyebrow font-semibold text-muted-foreground">
                    {fact.label}
                  </dt>
                  <dd className="text-sm font-bold">{fact.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
        </div>
      </div>
      {children === undefined ? null : (
        <div className="w-full shrink-0 lg:w-96">{children}</div>
      )}
    </section>
  );
}
