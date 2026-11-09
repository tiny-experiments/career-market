import { Badge } from "@/components/ui/badge";

export type Signal = "ramping" | "steady" | "cooling" | "freezing";

const SIGNALS = {
  ramping: { label: "Ramping", variant: "up" },
  steady: { label: "Steady", variant: "flat" },
  cooling: { label: "Cooling", variant: "warn" },
  freezing: { label: "Freezing", variant: "down" },
} as const;

/** A company's hiring signal as a word in its colour; never a bare dot. */
export function SignalBadge({
  signal,
  className,
}: {
  readonly signal: Signal;
  readonly className?: string;
}) {
  const { label, variant } = SIGNALS[signal];
  return (
    <Badge variant={variant} size="md" className={className}>
      {label}
    </Badge>
  );
}
