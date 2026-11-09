import { cn } from "@/lib/utils";

/** The mark alone: a rising line in a rounded square. Identity only, never a button. */
export function BrandMark({ className }: { readonly className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      aria-hidden="true"
      className={cn("size-7 shrink-0", className)}
    >
      <rect width="32" height="32" rx="8" className="fill-primary" />
      <path
        d="M7 22 L13 15 L18 19 L25 10"
        fill="none"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="stroke-primary-foreground"
      />
      <path
        d="M19 10 H25 V16"
        fill="none"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="stroke-primary-foreground"
      />
    </svg>
  );
}

/** Mark and name together, as the nav and footer show them. */
export function BrandLockup({ className }: { readonly className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <BrandMark />
      <span className="text-base font-bold tracking-tight">Career Market</span>
    </span>
  );
}
