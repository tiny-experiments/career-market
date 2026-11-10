import { SlidersHorizontal, Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import { EmptyState, Chip, ErrorState } from "@/components/common";
import { Pager } from "@/components/data";
import {
  JobFiltersRail,
  JobsPulseStrip,
  JobsQuickFilters,
  JobsTable,
} from "@/components/jobs";
import { PageContainer, PageHeader } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { EMPTY, ERROR, JOBS_LIST, PAGES, jobsFound } from "@/content";
import { useJobFilters, usePagedList, useResource } from "@/hooks";
import { jobFacets, jobsList } from "@/lib/api";
import { formatCount } from "@/lib/format";
import { filterChips, SORT_OPTIONS } from "@/lib/jobFilters";
import { jobRowFromList } from "@/lib/jobRows";
import { jobsFiltersFrom } from "@/lib/listFilters";
import { cn } from "@/lib/utils";

/** "182,278" → "180,000": a count we only estimated reads as a round figure. */
function roundedFigure(total: number): string {
  const magnitude = 10 ** Math.max(0, String(Math.round(total)).length - 2);
  return formatCount(Math.round(total / magnitude) * magnitude);
}

function resultCount(total: number, estimate: boolean): string {
  return jobsFound(
    estimate ? roundedFigure(total) : formatCount(total),
    total === 1,
    estimate,
  );
}

export function JobsPage() {
  const filters = useJobFilters();
  const { params, update, clear, hrefFor } = filters;
  const query = useMemo(() => jobsFiltersFrom(params), [params]);
  const jobs = usePagedList(jobsList, query);
  const facets = useResource(jobFacets()).data?.facets;
  const [filtersOpen, setFiltersOpen] = useState(false);

  const named = jobs.data?.filterCompany;
  const companyParam = params.get("company");
  const companyName =
    named && (named.slug === companyParam || named.id === companyParam)
      ? named.name
      : null;
  const chips = filterChips(params, facets, companyName);
  const rows = useMemo(() => jobs.items.map(jobRowFromList), [jobs.items]);
  const first = jobs.data === null && jobs.error === null;
  const sort = params.get("sort") ?? "newest";

  const noMatch = (
    <EmptyState
      icon={Search}
      title={EMPTY.jobs.title}
      description={EMPTY.jobs.description}
      action={
        chips.length > 0 ? (
          <Button variant="outline" onClick={clear}>
            {JOBS_LIST.clearAllFilters}
          </Button>
        ) : undefined
      }
    />
  );

  return (
    <PageContainer>
      <PageHeader
        title={PAGES.jobs.title}
        description={PAGES.jobs.description}
      />
      <JobsPulseStrip />
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-6">
        <aside
          aria-label="Filters"
          className="hidden w-68 shrink-0 lg:sticky lg:top-chrome lg:-m-2 lg:block lg:max-h-rail-h lg:overflow-y-auto lg:p-2"
        >
          <JobFiltersRail
            filters={filters}
            facets={facets}
            companyName={companyName}
          />
        </aside>
        <section
          aria-label="Results"
          className="flex min-w-0 flex-1 flex-col gap-4"
        >
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="mr-2 text-h2 font-bold" aria-live="polite">
              {jobs.data === null
                ? "Jobs"
                : resultCount(jobs.total, jobs.data.totalIsEstimate === true)}
            </h2>
            {chips.map((chip) => (
              <Chip
                key={chip.key}
                pressed
                aria-label={`Remove filter: ${chip.label}`}
                onClick={() => update(chip.patch)}
              >
                {chip.label}
                <X aria-hidden />
              </Chip>
            ))}
            {chips.length > 1 ? (
              <Button variant="ghost" size="sm" onClick={clear}>
                {JOBS_LIST.clearAll}
              </Button>
            ) : null}
            <div className="ml-auto flex items-center gap-2">
              <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
                <SheetTrigger asChild>
                  <Button variant="outline" className="lg:hidden">
                    <SlidersHorizontal aria-hidden />
                    Filters
                    {chips.length > 0 ? ` (${chips.length})` : ""}
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="overflow-y-auto">
                  <SheetHeader>
                    <SheetTitle>Filters</SheetTitle>
                  </SheetHeader>
                  <div className="px-4 pb-6">
                    <JobFiltersRail
                      filters={filters}
                      facets={facets}
                      companyName={companyName}
                    />
                  </div>
                </SheetContent>
              </Sheet>
              <Select
                value={sort}
                onValueChange={(value) =>
                  update({ sort: value === "newest" ? null : value })
                }
              >
                <SelectTrigger aria-label="Sort jobs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent align="end">
                  {SORT_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <JobsQuickFilters filters={filters} />
          <Card className="gap-0 overflow-hidden py-0">
            {jobs.error !== null && jobs.data === null ? (
              <ErrorState
                title={ERROR.jobs.title}
                onRetry={jobs.reload}
                {...(jobs.error.message === undefined
                  ? {}
                  : { message: jobs.error.message })}
              />
            ) : (
              <JobsTable
                rows={rows}
                loading={first}
                empty={noMatch}
                className={cn(
                  "transition-opacity",
                  jobs.loading && !first && "opacity-60",
                )}
              />
            )}
          </Card>
          <Pager
            page={jobs.page}
            pageCount={jobs.pageCount}
            hrefFor={hrefFor}
          />
        </section>
      </div>
    </PageContainer>
  );
}
