import { PageSkeleton, ResourceView } from "@/components/common";
import { PageContainer, PageHeader } from "@/components/layout";
import { useResource } from "@/hooks";
import { marketOverview } from "@/lib/api";
import { PageBodyPlaceholder } from "./PageBodyPlaceholder";

export function MarketPage() {
  const market = useResource(marketOverview());

  return (
    <PageContainer>
      <PageHeader
        title="Market"
        description="Open tech roles across every profession, company and skill, and how they move."
      />
      <ResourceView
        state={market}
        skeleton={<PageSkeleton withHeader={false} />}
        errorTitle="The market could not be loaded"
      >
        {() => <PageBodyPlaceholder />}
      </ResourceView>
    </PageContainer>
  );
}
