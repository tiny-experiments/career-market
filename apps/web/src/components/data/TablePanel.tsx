import type { ReactNode } from "react";
import { Panel } from "@/components/data/Panel";
import { cn } from "@/lib/utils";

export interface TablePanelProps {
  readonly title: ReactNode;
  readonly action?: ReactNode;
  readonly children: ReactNode;
  readonly className?: string;
}

/** A `Panel` for a full-width `DataTable`: the table runs edge to edge of the card. */
export function TablePanel({
  title,
  action,
  children,
  className,
}: TablePanelProps) {
  return (
    <Panel
      title={title}
      action={action}
      className={cn("[--card-spacing:--spacing(6)]", className)}
      contentClassName="-mb-6 px-0"
    >
      {children}
    </Panel>
  );
}
