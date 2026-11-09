import type { ComponentProps } from "react";
import { Button } from "@/components/ui/button";

export interface ChipProps extends Omit<
  ComponentProps<typeof Button>,
  "variant" | "size"
> {
  /** Whether the filter is on; the chip announces it as pressed. */
  readonly pressed: boolean;
}

/** A filter toggle above a table: outlined when off, tinted in the one blue when on. */
export function Chip({ pressed, type = "button", ...props }: ChipProps) {
  return (
    <Button variant="chip" type={type} aria-pressed={pressed} {...props} />
  );
}
