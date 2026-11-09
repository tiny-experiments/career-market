import { useSearchParams } from "react-router";
import { PageSkeleton, ResourceView } from "@/components/common";
import { PageContainer, PageHeader } from "@/components/layout";
import { ProfessionListCard, ProfessionsTable } from "@/components/market";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useResource } from "@/hooks";
import { professionsIndex } from "@/lib/api";
import { formatCount, formatPayRange } from "@/lib/format";
import {
  bestPaidProfessions,
  coolingProfessions,
  gainingProfessions,
  PROFESSION_REGIONS,
  professionRegionFrom,
  professionViewFrom,
} from "@/lib/professions";

const WORLDWIDE = "worldwide";

export function ProfessionsPage() {
  const [search, setSearch] = useSearchParams();
  const region = professionRegionFrom(search);
  const view = professionViewFrom(search);
  const professions = useResource(professionsIndex(region));

  const chooseRegion = (next: string) =>
    setSearch((current) => {
      const params = new URLSearchParams(current);
      if (next === WORLDWIDE) params.delete("region");
      else params.set("region", next);
      return params;
    });

  const viewLink = (name: string) => {
    const params = new URLSearchParams({ view: name });
    if (region) params.set("region", region);
    return `/professions?${params.toString()}`;
  };

  return (
    <PageContainer>
      <PageHeader
        title="Professions"
        aside={
          <Select value={region ?? WORLDWIDE} onValueChange={chooseRegion}>
            <SelectTrigger aria-label="Region" className="h-control w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={WORLDWIDE}>Worldwide</SelectItem>
              {PROFESSION_REGIONS.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />
      <ResourceView
        state={professions}
        skeleton={<PageSkeleton withHeader={false} />}
        errorTitle="Professions could not be loaded"
      >
        {({ rows }) => (
          <>
            <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
              <ProfessionListCard
                title="Gaining"
                to={viewLink("gaining")}
                rows={gainingProfessions(rows)}
                value={(row) => formatCount(row.open)}
                change={(row) => row.change?.value}
                empty="No profession grew this week."
              />
              <ProfessionListCard
                title="Cooling"
                to={viewLink("cooling")}
                rows={coolingProfessions(rows)}
                value={(row) => formatCount(row.open)}
                change={(row) => row.change?.value}
                empty="No profession shrank this week."
              />
              <ProfessionListCard
                title="Best paid"
                to={viewLink("best-paid")}
                rows={bestPaidProfessions(rows)}
                value={(row) =>
                  row.pay ? formatPayRange(row.pay.low, row.pay.high) : "—"
                }
                empty="Pay ranges will show here."
              />
            </div>
            <ProfessionsTable
              key={view}
              rows={rows}
              view={view}
              regional={region !== undefined}
            />
          </>
        )}
      </ResourceView>
    </PageContainer>
  );
}
