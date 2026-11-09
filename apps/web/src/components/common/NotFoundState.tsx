import { Compass } from "lucide-react";
import { Link } from "react-router";
import { EmptyState } from "@/components/common/EmptyState";
import { Button } from "@/components/ui/button";
import { BACK_TO_MARKET, EMPTY } from "@/content";

/** An address with nothing behind it, and the way back. */
export function NotFoundState() {
  return (
    <EmptyState
      icon={Compass}
      title={EMPTY.notFound.title}
      description={EMPTY.notFound.description}
      action={
        <Button asChild variant="outline">
          <Link to="/">{BACK_TO_MARKET}</Link>
        </Button>
      }
    />
  );
}
