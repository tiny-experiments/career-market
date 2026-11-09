import { useParams } from "react-router";
import { NotFoundState, PageSkeleton, ResourceView } from "@/components/common";
import { PageContainer, PageHeader } from "@/components/layout";
import { useResource } from "@/hooks";
import { professionDetail } from "@/lib/api";
import { PageBodyPlaceholder } from "./PageBodyPlaceholder";

export function ProfessionPage() {
  const { code = "" } = useParams();
  const profession = useResource(professionDetail(code));

  return (
    <PageContainer>
      <ResourceView
        state={profession}
        skeleton={<PageSkeleton variant="detail" />}
        errorTitle="This profession could not be loaded"
        notFound={<NotFoundState />}
      >
        {(page) => (
          <>
            <PageHeader
              crumbs={[{ label: "Professions", to: "/professions" }]}
              title={page.name}
              code={page.code}
            />
            <PageBodyPlaceholder />
          </>
        )}
      </ResourceView>
    </PageContainer>
  );
}
