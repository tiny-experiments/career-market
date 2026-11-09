import { Search } from "lucide-react";
import { useMemo } from "react";
import { useSearchParams } from "react-router";
import { EmptyState, PageSkeleton, ResourceView } from "@/components/common";
import { ListSearch } from "@/components/data";
import { PageContainer, PageHeader } from "@/components/layout";
import { SkillsMarketRow, SkillsTable } from "@/components/skills";
import { DIRECTORY_COPY, EMPTY, ERROR, PAGES } from "@/content";
import { useListSort, useResource } from "@/hooks";
import { skillsIndex, type SkillIndexRow } from "@/lib/api";
import {
  filterSkills,
  naturalSkillDirection,
  SKILL_SORT_KEYS,
  skillViewFrom,
  sortSkills,
  viewSort,
  type SkillSortKey,
  type SkillView,
} from "@/lib/skillViews";

/** The tabs narrow the list to the skills that carry the view's figure. */
function inView(rows: readonly SkillIndexRow[], view: SkillView) {
  switch (view) {
    case "all":
      return rows;
    case "growing":
      return rows.filter((row) => row.change !== null);
    case "best-paid":
      return rows.filter((row) => row.pay !== null);
    case "paired":
      return rows.filter((row) => row.topPair !== null);
    case "remote":
      return rows.filter((row) => row.remoteShare !== null);
  }
}

function SkillsBody({ skills }: { readonly skills: readonly SkillIndexRow[] }) {
  const [params] = useSearchParams();
  const view = skillViewFrom(params);
  const { sort, onSort } = useListSort(viewSort(view), naturalSkillDirection);
  const key = SKILL_SORT_KEYS.includes(sort.key as SkillSortKey)
    ? (sort.key as SkillSortKey)
    : viewSort(view).key;
  const rank = useMemo(
    () => new Map(skills.map((row, index) => [row.id, index + 1])),
    [skills],
  );
  const rows = useMemo(
    () =>
      sortSkills(
        filterSkills(inView(skills, view), params.get("q") ?? ""),
        key,
        sort.direction,
      ),
    [skills, view, params, key, sort.direction],
  );

  return (
    <>
      <SkillsMarketRow skills={skills} />
      <section className="flex flex-col gap-4">
        <div className="flex justify-end">
          <ListSearch label={DIRECTORY_COPY.searchSkills} />
        </div>
        {rows.length === 0 ? (
          <EmptyState
            icon={Search}
            title={EMPTY.skills.title}
            description={EMPTY.skills.description}
          />
        ) : (
          <div className="-mx-gutter">
            <SkillsTable
              rows={rows}
              rank={rank}
              sort={{ key, direction: sort.direction }}
              onSort={onSort}
            />
          </div>
        )}
      </section>
    </>
  );
}

export function SkillsPage() {
  const skills = useResource(skillsIndex());

  return (
    <PageContainer>
      <PageHeader
        title={PAGES.skills.title}
        description={PAGES.skills.description}
      />
      <ResourceView
        state={skills}
        skeleton={<PageSkeleton withHeader={false} />}
        errorTitle={ERROR.skills.title}
      >
        {(page) => <SkillsBody skills={page.skills} />}
      </ResourceView>
    </PageContainer>
  );
}
