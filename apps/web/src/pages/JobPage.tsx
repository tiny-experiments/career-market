import { useParams } from "react-router";
import { NotFoundState, PageSkeleton, ResourceView } from "@/components/common";
import { PageContainer, PageHeader } from "@/components/layout";
import { useResource } from "@/hooks";
import { jobDetail } from "@/lib/api";
import { PageBodyPlaceholder } from "./PageBodyPlaceholder";

const CRUMBS = [{ label: "Jobs", to: "/jobs" }];

export function JobPage() {
  const { id = "" } = useParams();
  const job = useResource(jobDetail(id));

  return (
    <PageContainer>
      <ResourceView
        state={job}
        skeleton={<PageSkeleton variant="detail" />}
        errorTitle="This job could not be loaded"
        notFound={<NotFoundState />}
      >
        {(page) => (
          <>
            <PageHeader
              crumbs={CRUMBS}
              title={
                page.status === "open" ? page.job.title : "This role has closed"
              }
              {...(page.status === "open"
                ? { description: page.job.company.name }
                : {})}
            />
            <PageBodyPlaceholder />
          </>
        )}
      </ResourceView>
    </PageContainer>
  );
}
