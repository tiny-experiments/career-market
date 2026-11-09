import { Search } from "lucide-react";
import { useMemo } from "react";
import { useSearchParams } from "react-router";
import { EmptyState, PageSkeleton, ResourceView } from "@/components/common";
import { PageContainer, PageHeader } from "@/components/layout";
import { usePagedList } from "@/hooks";
import { jobsList } from "@/lib/api";
import { jobsFiltersFrom } from "@/lib/listFilters";
import { PageBodyPlaceholder } from "./PageBodyPlaceholder";

export function JobsPage() {
  const [params] = useSearchParams();
  const filters = useMemo(() => jobsFiltersFrom(params), [params]);
  const jobs = usePagedList(jobsList, filters);

  return (
    <PageContainer>
      <PageHeader
        title="Jobs"
        description="Open roles, filtered by profession, company, place, work mode and pay."
      />
      <ResourceView
        state={jobs}
        skeleton={<PageSkeleton withHeader={false} />}
        errorTitle="Jobs could not be loaded"
        isEmpty={(page) => page.items.length === 0}
        empty={<EmptyState icon={Search} title="No jobs match that" />}
      >
        {() => <PageBodyPlaceholder />}
      </ResourceView>
    </PageContainer>
  );
}
