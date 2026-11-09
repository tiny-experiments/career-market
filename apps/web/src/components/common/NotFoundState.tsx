import { Compass } from "lucide-react";
import { Link } from "react-router";
import { EmptyState } from "@/components/common/EmptyState";
import { Button } from "@/components/ui/button";

/** An address with nothing behind it, and the way back. */
export function NotFoundState() {
  return (
    <EmptyState
      icon={Compass}
      title="We couldn't find that page"
      description="The link may be old, or the page may have moved."
      action={
        <Button asChild variant="outline">
          <Link to="/">Back to the market</Link>
        </Button>
      }
    />
  );
}
