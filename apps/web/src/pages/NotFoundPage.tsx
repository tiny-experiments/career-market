import { Compass } from "lucide-react";
import { Link } from "react-router";
import { EmptyState } from "@/components/common";
import { PageContainer } from "@/components/layout";
import { Button } from "@/components/ui/button";

export function NotFoundPage() {
  return (
    <PageContainer className="justify-center">
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
    </PageContainer>
  );
}
