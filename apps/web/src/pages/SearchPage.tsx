import { Search } from "lucide-react";
import { Link, useSearchParams } from "react-router";
import { EmptyState, PageSkeleton, ResourceView } from "@/components/common";
import { Logo, Panel, RankedList } from "@/components/data";
import { JobsTable } from "@/components/jobs";
import { PageContainer, PageHeader } from "@/components/layout";
import { Card } from "@/components/ui/card";
import { ERROR, SEARCH_PAGE, nothingFound, seeAll } from "@/content";
import { useResource } from "@/hooks";
import {
  SEARCH_MIN_LENGTH,
  siteSearch,
  type SiteSearchResults,
} from "@/lib/api";
import { formatCount } from "@/lib/format";
import { jobRowFromHit } from "@/lib/jobRows";
import { SEARCH_PAGE_LIMIT } from "@/routes";

function Results({
  found,
  q,
}: {
  readonly found: SiteSearchResults;
  readonly q: string;
}) {
  const rows = found.roles.map(jobRowFromHit);
  return (
    <>
      {found.groups.length > 0 ? (
        <div className="grid gap-4 lg:grid-cols-3">
          {found.groups.map((group) => (
            <Panel key={group.kind} title={group.title}>
              <RankedList
                items={group.hits.map((hit, index) => ({
                  rank: index + 1,
                  name: hit.label,
                  value: `${formatCount(hit.open)} open`,
                  to: hit.href,
                  ...(hit.sublabel === null ? {} : { code: hit.sublabel }),
                  logo: (
                    <Logo
                      name={hit.label}
                      domain={hit.domain}
                      size="sm"
                      shape={hit.kind === "company" ? "round" : "square"}
                    />
                  ),
                }))}
              />
            </Panel>
          ))}
        </div>
      ) : null}
      {rows.length > 0 ? (
        <section aria-label="Jobs" className="flex flex-col gap-4">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="text-h2 font-bold">Jobs</h2>
            <Link
              to={`/jobs?q=${encodeURIComponent(q)}`}
              className="text-small font-semibold text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
            >
              {seeAll(found.rolesTotal)}
            </Link>
          </div>
          <Card className="gap-0 overflow-hidden py-0">
            <JobsTable rows={rows} />
          </Card>
        </section>
      ) : null}
    </>
  );
}

export function SearchPage() {
  const [params] = useSearchParams();
  const q = params.get("q")?.trim() ?? "";
  const asking = q.length >= SEARCH_MIN_LENGTH;
  const results = useResource(asking ? siteSearch(q, SEARCH_PAGE_LIMIT) : null);

  return (
    <PageContainer>
      <PageHeader
        title={asking ? SEARCH_PAGE.results(q) : SEARCH_PAGE.title}
        {...(asking
          ? {}
          : {
              description: SEARCH_PAGE.prompt,
            })}
      />
      <ResourceView
        state={results}
        skeleton={<PageSkeleton withHeader={false} />}
        errorTitle={ERROR.search.title}
        isEmpty={(found) =>
          found.roles.length === 0 &&
          found.groups.every((group) => group.hits.length === 0)
        }
        empty={
          <EmptyState
            icon={Search}
            title={asking ? nothingFound(q).title : SEARCH_PAGE.blankTitle}
            description={nothingFound(q).description}
            className="rounded-xl bg-card shadow-card"
          />
        }
      >
        {(found) => <Results found={found} q={q} />}
      </ResourceView>
    </PageContainer>
  );
}
