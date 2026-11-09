import { Search } from "lucide-react";
import { useMemo } from "react";
import { useSearchParams } from "react-router";
import { EmptyState, PageSkeleton, ResourceView } from "@/components/common";
import { PageContainer, PageHeader } from "@/components/layout";
import { usePagedList } from "@/hooks";
import { companiesList } from "@/lib/api";
import { companiesFiltersFrom } from "@/lib/listFilters";
import { PageBodyPlaceholder } from "./PageBodyPlaceholder";

export function CompaniesPage() {
  const [params] = useSearchParams();
  const filters = useMemo(() => companiesFiltersFrom(params), [params]);
  const companies = usePagedList(companiesList, filters);

  return (
    <PageContainer>
      <PageHeader
        title="Companies"
        description="Every company with open tech roles, from ramping to freezing."
      />
      <ResourceView
        state={companies}
        skeleton={<PageSkeleton withHeader={false} />}
        errorTitle="Companies could not be loaded"
        isEmpty={(page) => page.items.length === 0}
        empty={<EmptyState icon={Search} title="No companies match that" />}
      >
        {() => <PageBodyPlaceholder />}
      </ResourceView>
    </PageContainer>
  );
}
