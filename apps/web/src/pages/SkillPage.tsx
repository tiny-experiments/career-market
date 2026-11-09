import { useParams } from "react-router";
import { NotFoundState, PageSkeleton, ResourceView } from "@/components/common";
import { Logo } from "@/components/data";
import { PageContainer, PageHeader } from "@/components/layout";
import { useResource } from "@/hooks";
import { skillDetail } from "@/lib/api";
import { PageBodyPlaceholder } from "./PageBodyPlaceholder";

export function SkillPage() {
  const { slug = "" } = useParams();
  const skill = useResource(skillDetail(slug));

  return (
    <PageContainer>
      <ResourceView
        state={skill}
        skeleton={<PageSkeleton variant="detail" />}
        errorTitle="This skill could not be loaded"
        notFound={<NotFoundState />}
      >
        {(page) => (
          <>
            <PageHeader
              crumbs={[{ label: "Skills", to: "/skills" }]}
              logo={
                <Logo
                  name={page.label}
                  domain={page.domain}
                  shape="square"
                  size="lg"
                />
              }
              title={page.label}
            />
            <PageBodyPlaceholder />
          </>
        )}
      </ResourceView>
    </PageContainer>
  );
}
