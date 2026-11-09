import { Search } from "lucide-react";
import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router";
import { CompaniesMarketRow, CompaniesTable } from "@/components/companies";
import { EmptyState, PageSkeleton, ResourceView } from "@/components/common";
import { ListSearch, Pager, type SortDirection } from "@/components/data";
import { PageContainer, PageHeader } from "@/components/layout";
import { DIRECTORY_COPY, EMPTY, ERROR, PAGES } from "@/content";
import { useListSort, usePagedList, useResource } from "@/hooks";
import { companiesList, companySignals } from "@/lib/api";
import { companiesFiltersFrom } from "@/lib/listFilters";
import { cn } from "@/lib/utils";

const DEFAULT_SORT = { key: "open", direction: "desc" as SortDirection };
const naturalDirection = (key: string): SortDirection =>
  key === "name" ? "asc" : "desc";

export function CompaniesPage() {
  const [params] = useSearchParams();
  const filters = useMemo(() => companiesFiltersFrom(params), [params]);
  const companies = usePagedList(companiesList, filters);
  const overview = useResource(companySignals());
  const { sort, onSort } = useListSort(DEFAULT_SORT, naturalDirection);

  const hrefFor = useCallback(
    (page: number) => {
      const next = new URLSearchParams(params);
      if (page <= 1) next.delete("page");
      else next.set("page", String(page));
      const query = next.toString();
      return query ? `/companies?${query}` : "/companies";
    },
    [params],
  );

  return (
    <PageContainer>
      <PageHeader
        title={PAGES.companies.title}
        description={PAGES.companies.description}
      />
      <CompaniesMarketRow overview={overview.data} />
      <section className="flex flex-col gap-4">
        <div className="flex justify-end">
          <ListSearch label={DIRECTORY_COPY.searchCompanies} />
        </div>
        <ResourceView
          state={companies}
          skeleton={<PageSkeleton withHeader={false} />}
          errorTitle={ERROR.companies.title}
          isEmpty={(page) => page.items.length === 0}
          empty={
            <EmptyState
              icon={Search}
              title={EMPTY.companies.title}
              description={EMPTY.companies.description}
            />
          }
        >
          {(page) => (
            <div
              className={cn(
                "-mx-gutter transition-opacity",
                companies.loading && "opacity-60",
              )}
            >
              <CompaniesTable rows={page.items} sort={sort} onSort={onSort} />
            </div>
          )}
        </ResourceView>
        <Pager
          page={companies.page}
          pageCount={companies.pageCount}
          hrefFor={hrefFor}
        />
      </section>
    </PageContainer>
  );
}
