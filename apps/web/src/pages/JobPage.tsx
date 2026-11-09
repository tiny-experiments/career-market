import { useParams } from "react-router";
import { NotFoundState, PageSkeleton, ResourceView } from "@/components/common";
import { ClosedJob, JobView } from "@/components/jobs";
import { PageContainer } from "@/components/layout";
import { ERROR } from "@/content";
import { useResource } from "@/hooks";
import { jobDetail } from "@/lib/api";

export function JobPage() {
  const { id = "" } = useParams();
  const job = useResource(jobDetail(id));

  return (
    <PageContainer>
      <ResourceView
        state={job}
        skeleton={<PageSkeleton variant="detail" />}
        errorTitle={ERROR.job.title}
        notFound={<NotFoundState />}
      >
        {(page) =>
          page.status === "open" ? (
            <JobView page={page} />
          ) : (
            <ClosedJob job={page} />
          )
        }
      </ResourceView>
    </PageContainer>
  );
}
