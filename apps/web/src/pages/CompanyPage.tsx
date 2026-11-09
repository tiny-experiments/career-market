import { useParams } from "react-router";
import { NotFoundState, PageSkeleton, ResourceView } from "@/components/common";
import { Logo } from "@/components/data";
import { PageContainer, PageHeader } from "@/components/layout";
import { useResource } from "@/hooks";
import { companyDetail, companyJobs } from "@/lib/api";
import { COMPANY_JOBS_PREVIEW } from "@/routes";
import { PageBodyPlaceholder } from "./PageBodyPlaceholder";

export function CompanyPage() {
  const { slug = "" } = useParams();
  const company = useResource(companyDetail(slug));
  // Read now so the roles list has its answer when the page body arrives.
  useResource(companyJobs(slug, { page: 1, pageSize: COMPANY_JOBS_PREVIEW }));

  return (
    <PageContainer>
      <ResourceView
        state={company}
        skeleton={<PageSkeleton variant="detail" />}
        errorTitle="This company could not be loaded"
        notFound={<NotFoundState />}
      >
        {(page) => (
          <>
            <PageHeader
              crumbs={[{ label: "Companies", to: "/companies" }]}
              logo={
                <Logo
                  name={page.company.name}
                  domain={page.company.domain}
                  size="lg"
                />
              }
              title={page.company.name}
            />
            <PageBodyPlaceholder />
          </>
        )}
      </ResourceView>
    </PageContainer>
  );
}
