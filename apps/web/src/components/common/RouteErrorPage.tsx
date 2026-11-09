import { ErrorState } from "@/components/common/ErrorState";
import { PageContainer } from "@/components/layout/PageContainer";

/**
 * A page that could not be drawn or whose code could not load, usually an old
 * tab after a release. Reloading picks up the current version.
 */
export function RouteErrorPage() {
  return (
    <PageContainer className="justify-center">
      <ErrorState
        title="This page could not be opened"
        onRetry={() => window.location.reload()}
      />
    </PageContainer>
  );
}
