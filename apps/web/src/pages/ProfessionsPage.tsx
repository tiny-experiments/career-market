import { PageSkeleton, ResourceView } from "@/components/common";
import { PageContainer, PageHeader } from "@/components/layout";
import { useResource } from "@/hooks";
import { professionsIndex } from "@/lib/api";
import { PageBodyPlaceholder } from "./PageBodyPlaceholder";

export function ProfessionsPage() {
  const professions = useResource(professionsIndex());

  return (
    <PageContainer>
      <PageHeader
        title="Professions"
        description="Every profession with its open roles, pay range and how demand is moving."
      />
      <ResourceView
        state={professions}
        skeleton={<PageSkeleton withHeader={false} />}
        errorTitle="Professions could not be loaded"
      >
        {() => <PageBodyPlaceholder />}
      </ResourceView>
    </PageContainer>
  );
}
