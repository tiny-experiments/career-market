import { cn } from "@/lib/utils";

/** The mark alone: a rising step chart in a rounded square. Identity only, never a button. */
export function BrandMark({ className }: { readonly className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      aria-hidden="true"
      className={cn("size-7 shrink-0", className)}
    >
      <rect width="32" height="32" rx="8" className="fill-primary" />
      <path
        d="M6.5 22.5 H12.5 V16.5 H18.5 V10.5 H24.5 V26 H6.5 Z"
        fillOpacity="0.2"
        className="fill-primary-foreground"
      />
      <path
        d="M6.5 22.5 H12.5 V16.5 H18.5 V10.5 H24.5"
        fill="none"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="stroke-primary-foreground"
      />
      <circle cx="24.5" cy="10.5" r="3.5" className="fill-primary-foreground" />
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
