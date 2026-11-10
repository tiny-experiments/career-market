import { Info } from "lucide-react";
import { useState, type ReactNode } from "react";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { cn } from "@/lib/utils";

export interface MetricHoverCardProps {
  /** The figure's name, as its label shows it. */
  readonly title: string;
  /** One sentence on what the number is. Never where it comes from. */
  readonly children: ReactNode;
  /** The arithmetic, only when it is the reader's own: "Open roles now ÷ open roles a week ago". */
  readonly formula?: string;
  /** Something other than the (i) icon to hover: the label itself, a value. */
  readonly trigger?: ReactNode;
  readonly side?: "top" | "right" | "bottom" | "left";
  readonly className?: string;
}

/**
 * The one explanation surface. It opens at once on hover and on keyboard
 * focus, and a tap toggles it where there is no hover. The trigger is a real
 * button so it has a name and a focus ring.
 */
export function MetricHoverCard({
  title,
  children,
  formula,
  trigger,
  side = "bottom",
  className,
}: MetricHoverCardProps) {
  const [open, setOpen] = useState(false);

  return (
    <HoverCard open={open} onOpenChange={setOpen}>
      <HoverCardTrigger asChild>
        <button
          type="button"
          aria-label={`About ${title}`}
          aria-expanded={open}
          onPointerDown={(event) => {
            if (event.pointerType === "touch") {
              event.preventDefault();
              setOpen((current) => !current);
            }
          }}
          className={cn(
            "relative touch-target z-10 inline-flex items-center rounded-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
            // The icon alone is a 24 px target: the margin gives the room back.
            trigger === undefined && "-m-1 size-6 justify-center",
            className,
          )}
        >
          {trigger ?? <Info className="size-3.5" aria-hidden />}
        </button>
      </HoverCardTrigger>
      <HoverCardContent side={side} className="flex flex-col gap-1.5">
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-small text-muted-foreground">{children}</p>
        {formula === undefined ? null : (
          <p className="pt-1 font-mono text-eyebrow text-subtle">{formula}</p>
        )}
      </HoverCardContent>
    </HoverCard>
  );
}
