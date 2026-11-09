import type { ReactNode } from "react";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface PanelProps {
  readonly title: ReactNode;
  /** Range tabs, a link, a menu: whatever sits at the header's right. */
  readonly action?: ReactNode;
  readonly children: ReactNode;
  readonly className?: string;
  readonly contentClassName?: string;
}

/** A section card: a bold title, an action on the right, and room to breathe. */
export function Panel({
  title,
  action,
  children,
  className,
  contentClassName,
}: PanelProps) {
  return (
    <Card className={cn("gap-4", className)}>
      <CardHeader className="items-center">
        <CardTitle>{title}</CardTitle>
        {action ? (
          <CardAction className="row-span-1 self-center">{action}</CardAction>
        ) : null}
      </CardHeader>
      <CardContent className={contentClassName}>{children}</CardContent>
    </Card>
  );
}
