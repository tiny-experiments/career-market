import { PageSkeleton, ResourceView } from "@/components/common";
import { PageContainer, PageHeader } from "@/components/layout";
import { useResource } from "@/hooks";
import { skillsIndex } from "@/lib/api";
import { PageBodyPlaceholder } from "./PageBodyPlaceholder";

export function SkillsPage() {
  const skills = useResource(skillsIndex());

  return (
    <PageContainer>
      <PageHeader
        title="Skills"
        description="The skills roles ask for, what they pay and which pair together."
      />
      <ResourceView
        state={skills}
        skeleton={<PageSkeleton withHeader={false} />}
        errorTitle="Skills could not be loaded"
      >
        {() => <PageBodyPlaceholder />}
      </ResourceView>
    </PageContainer>
  );
}
