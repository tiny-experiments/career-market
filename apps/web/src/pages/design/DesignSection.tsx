import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** One chapter of the design page: a bold title, a line on the rule, the examples. */
export function DesignSection({
  id,
  title,
  description,
  children,
  className,
}: {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly children: ReactNode;
  readonly className?: string;
}) {
  return (
    <section
      id={id}
      className={cn(
        "flex scroll-mt-32 flex-col gap-6 border-t pt-10",
        className,
      )}
    >
      <div className="flex flex-col gap-1.5">
        <h2 className="text-h1 font-extrabold">{title}</h2>
        <p className="max-w-2xl text-body text-muted-foreground">
          {description}
        </p>
      </div>
      {children}
    </section>
  );
}

/** A labelled example inside a section. */
export function Example({
  title,
  note,
  children,
  className,
}: {
  readonly title: string;
  readonly note?: string;
  readonly children: ReactNode;
  readonly className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h3 className="text-sm font-semibold">{title}</h3>
        {note === undefined ? null : (
          <p className="text-small text-muted-foreground">{note}</p>
        )}
      </div>
      {children}
    </div>
  );
}

export interface SwatchSpec {
  readonly name: string;
  readonly className: string;
  readonly token: string;
}

/** A colour with its utility and token names under it. */
export function Swatch({ name, className, token }: SwatchSpec) {
  return (
    <div className="min-w-0">
      <div
        className={cn("h-12 w-full rounded-lg border border-border", className)}
      />
      <p className="mt-1.5 truncate text-xs font-semibold">{name}</p>
      <p className="truncate font-mono text-eyebrow text-muted-foreground">
        {token}
      </p>
    </div>
  );
}

export function SwatchGrid({
  items,
}: {
  readonly items: readonly SwatchSpec[];
}) {
  return (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
      {items.map((item) => (
        <Swatch key={item.name} {...item} />
      ))}
    </div>
  );
}
