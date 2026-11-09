import type { IndicatorPosition } from "@/hooks";

/** The 2 px bar under the active link of a row; it slides when the row's active item changes. */
export function UnderlineIndicator({
  position,
}: {
  readonly position: IndicatorPosition | null;
}) {
  return (
    <span
      aria-hidden
      data-slot="underline-indicator"
      className="pointer-events-none absolute bottom-0 h-0.5 rounded-full bg-primary transition-all duration-200 ease-out"
      style={
        position
          ? { left: position.left, width: position.width, opacity: 1 }
          : { left: 0, width: 0, opacity: 0 }
      }
    />
  );
}
