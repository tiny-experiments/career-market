import { useSearchParams } from "react-router";
import { PageSkeleton, ResourceView } from "@/components/common";
import { PageContainer } from "@/components/layout";
import {
  CompaniesRampingCard,
  MarketStatusCard,
  ProfessionListCard,
  ProfessionsTable,
  WhereJobsPanel,
} from "@/components/market";
import { useResource } from "@/hooks";
import { marketOverview, professionsIndex } from "@/lib/api";
import { formatCount } from "@/lib/format";
import { gainingProfessions, professionViewFrom } from "@/lib/professions";

const skeleton = <PageSkeleton withHeader={false} />;

export function MarketPage() {
  const market = useResource(marketOverview());
  const professions = useResource(professionsIndex());
  const [search] = useSearchParams();
  const view = professionViewFrom(search);

  return (
    <PageContainer>
      <h1 className="sr-only">Market</h1>
      <ResourceView
        state={market}
        skeleton={skeleton}
        errorTitle="The market could not be loaded"
      >
        {(overview) => (
          <ResourceView
            state={professions}
            skeleton={skeleton}
            errorTitle="The market could not be loaded"
          >
            {({ rows }) => (
              <>
                <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
                  <MarketStatusCard market={overview} professions={rows} />
                  <ProfessionListCard
                    title="Professions gaining"
                    to="/professions?view=gaining"
                    rows={gainingProfessions(rows)}
                    value={(row) => formatCount(row.open)}
                    change={(row) => row.change?.value}
                    empty="No profession grew this week."
                    comfortable
                  />
                  <CompaniesRampingCard market={overview} />
                </div>
                <section className="flex flex-col gap-4">
                  <h2 className="text-h2 font-bold">Professions</h2>
                  <ProfessionsTable key={view} rows={rows} view={view} />
                </section>
                <WhereJobsPanel countries={overview.countries} />
              </>
            )}
          </ResourceView>
        )}
      </ResourceView>
    </PageContainer>
  );
}
