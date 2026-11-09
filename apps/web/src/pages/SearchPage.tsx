import { Search } from "lucide-react";
import { useSearchParams } from "react-router";
import { EmptyState, PageSkeleton, ResourceView } from "@/components/common";
import { PageContainer, PageHeader } from "@/components/layout";
import { useResource } from "@/hooks";
import { SEARCH_MIN_LENGTH, siteSearch } from "@/lib/api";
import { SEARCH_PAGE_LIMIT } from "@/routes";
import { PageBodyPlaceholder } from "./PageBodyPlaceholder";

export function SearchPage() {
  const [params] = useSearchParams();
  const q = params.get("q")?.trim() ?? "";
  const results = useResource(
    q.length >= SEARCH_MIN_LENGTH ? siteSearch(q, SEARCH_PAGE_LIMIT) : null,
  );

  return (
    <PageContainer>
      <PageHeader
        title="Search"
        {...(q === "" ? {} : { description: `Results for “${q}”` })}
      />
      <ResourceView
        state={results}
        skeleton={<PageSkeleton withHeader={false} />}
        errorTitle="Search could not be completed"
        isEmpty={(found) =>
          found.roles.length === 0 &&
          found.groups.every((group) => group.hits.length === 0)
        }
        empty={<EmptyState icon={Search} title="Nothing matches that yet" />}
      >
        {() => <PageBodyPlaceholder />}
      </ResourceView>
    </PageContainer>
  );
}
