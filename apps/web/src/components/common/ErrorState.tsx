import { RotateCw, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * A read that failed: what could not be loaded, in plain words, and a way to
 * try again. Announced, because it replaces content the reader was waiting on.
 */
export interface ErrorStateProps {
  /** What could not be loaded: "Companies could not be loaded". */
  readonly title: string;
  readonly message?: string;
  readonly onRetry?: () => void;
  readonly className?: string;
}

export function ErrorState({
  title,
  message = "Something went wrong on our side. Trying again usually works.",
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center gap-3 px-4 py-16 text-center",
        className,
      )}
    >
      <TriangleAlert className="size-6 text-destructive" aria-hidden />
      <div className="flex flex-col gap-1">
        <p className="text-sm font-semibold">{title}</p>
        <p className="max-w-md text-small text-muted-foreground">{message}</p>
      </div>
      {onRetry === undefined ? null : (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RotateCw />
          Try again
        </Button>
      )}
    </div>
  );
}
