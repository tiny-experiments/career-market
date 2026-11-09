import { Hourglass } from "lucide-react";
import { EmptyState } from "@/components/common";

/** Holds the place of a page body until that page is built. */
export function PageBodyPlaceholder() {
  return (
    <EmptyState
      icon={Hourglass}
      title="This page is on its way"
      description="It will open here as soon as it is ready."
      className="rounded-xl bg-card shadow-card"
    />
  );
}
