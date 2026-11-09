import { PageSkeleton } from "@/components/common/PageSkeleton";
import { PageContainer } from "@/components/layout/PageContainer";

/** What sits under the nav while the first page's code arrives. */
export function RouteFallback() {
  return (
    <PageContainer>
      <PageSkeleton />
    </PageContainer>
  );
}
