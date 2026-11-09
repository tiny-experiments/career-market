import { Badge } from "@/components/ui/badge";
import { direction, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface DeltaProps {
  /** A ratio: 0.037 is 3.7% more than the comparison. */
  readonly value: number;
  /** In words, what it is compared with: "this week". Never a date. */
  readonly suffix?: string;
  /** Plain coloured text, or a soft pill. */
  readonly variant?: "text" | "pill";
  readonly size?: "sm" | "md";
  readonly className?: string;
}

const CARET = { up: "▲", down: "▼", flat: "" } as const;

/**
 * A change: caret, number, and the comparison in words. Up is green, down is
 * red, no movement is grey without a caret.
 */
export function Delta({
  value,
  suffix,
  variant = "text",
  size = "md",
  className,
}: DeltaProps) {
  const tone = direction(value);
  const text =
    `${CARET[tone]} ${formatPercent(value)}${suffix ? ` ${suffix}` : ""}`.trim();
  const label = `${tone === "up" ? "Up" : tone === "down" ? "Down" : "Unchanged,"} ${formatPercent(value)}${suffix ? ` ${suffix}` : ""}`;

  if (variant === "pill") {
    return (
      <Badge
        variant={tone}
        size={size === "md" ? "md" : "default"}
        aria-label={label}
        className={className}
      >
        {text}
      </Badge>
    );
  }

  return (
    <span
      aria-label={label}
      data-direction={tone}
      className={cn(
        "font-semibold whitespace-nowrap",
        size === "sm" ? "text-xs" : "text-sm",
        tone === "up" && "text-up",
        tone === "down" && "text-down",
        tone === "flat" && "text-subtle",
        className,
      )}
    >
      {text}
    </span>
  );
}
